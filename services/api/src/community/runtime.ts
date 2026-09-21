import {randomUUID} from 'node:crypto';
import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import type {CommunityStore,Document} from './store.js';
import type {JobQueue,CommunityJob} from './jobs.js';
import type {ProviderSettings} from './settings.js';
import type {LocalMedia} from './media.js';
import {FalProvider,providerInput} from './providers.js';
import {renderCommunityMovie} from '../../../worker/src/community-render.js';
import {workstationSchema} from '@flowbar/gen-contracts';
import type {MediaFile} from '../../../worker/src/media.js';
type Provider=Pick<FalProvider,'submit'|'poll'|'download'>;
export const storyboardSchema=z.object({title:z.string().min(1).max(160),aspectRatio:z.enum(['16:9','9:16']).optional(),resolution:z.enum(['720p','1080p']).optional(),template:z.enum(['product','feature','social']).optional(),shots:z.array(z.object({id:z.string().uuid().optional(),prompt:z.string().min(1).max(5000),narration:z.string().max(2000),caption:z.string().max(1000),durationMs:z.number().int().min(1000).max(30000),assetId:z.string().uuid().optional(),voiceAssetId:z.string().uuid().optional()})).min(1).max(8)});
export class CommunityWorker {
 constructor(readonly store:CommunityStore,readonly queue:JobQueue,readonly settings:ProviderSettings,readonly media:LocalMedia,readonly provider:(key:string)=>Provider=key=>new FalProvider(key)){}
 private async ownedMedia(owner:string,id:string){const doc=await this.store.document(owner,'asset',id);if(!doc||doc.data.deleted)throw new Error('asset_not_found');return doc;}
 async tick(){
  // Durable receipts allow recovery after the provider replied but the database write failed.
  const uncertain=(await this.store.db.query<CommunityJob>("SELECT * FROM community_jobs WHERE state='reconciling' AND provider IS NULL LIMIT 20")).rows;
  for(const job of uncertain){try{const receipt=JSON.parse(await readFile(join(this.media.root,'receipts',`${job.id}.json`),'utf8'));await this.store.db.query("UPDATE community_jobs SET state='polling',provider=$2::jsonb,lease_until=NULL WHERE id=$1 AND state='reconciling'",[job.id,JSON.stringify(receipt)]);}catch{/* No receipt means manual reconciliation, never a second submission. */}}
  const job=await this.queue.claim();if(!job)return false;
  let submissionStarted=false;
  const timer=setInterval(()=>{void this.queue.heartbeat(job.id,job.lease_token).catch(()=>{});},60000);
  try{
   const existing=await this.store.document(job.owner,'asset',job.id);
   if(existing){await this.queue.finish(job.id,job.lease_token,'ready',{assetId:existing.id});return true;}
   if(job.kind==='render'){
    const manifest=workstationSchema.parse(job.input.manifest);const sources=[];
    for(const id of new Set(manifest.clips.map(c=>c.sourceAssetId))){const doc=await this.ownedMedia(job.owner,id);sources.push({id,media:{...doc.data,path:await this.media.path(String(doc.data.mediaId)),directory:this.media.root} as unknown as MediaFile});}
    const output=await renderCommunityMovie(manifest,sources,this.media);await this.recordMedia(job,output,'local-ffmpeg');return true;
   }
   const key=await this.settings.key(job.owner);if(!key)throw new Error('configure_provider');const client=this.provider(key);
   if(!job.provider){
    const request=providerInput(job.kind,job.input);
    if(job.kind==='image-video'){
     const reference=await this.ownedMedia(job.owner,String(job.input.referenceAssetId));if(reference.data.kind!=='image')throw new Error('image_reference_required');
     const bytes=await this.media.bytes(String(reference.data.mediaId));if(bytes.length>15*1024*1024)throw new Error('reference_image_too_large');
     request.input.image_url=`data:${reference.data.contentType};base64,${bytes.toString('base64')}`;
    }
    await this.queue.markSubmitting(job.id,job.lease_token);
    submissionStarted=true;
    let receipt:Record<string,unknown>;
    try{receipt=await client.submit(request.endpoint,request.input);}catch(e){
     const code=(e as Error).message;
     await this.queue.finish(job.id,job.lease_token,/^provider_http_4\d\d$/.test(code)?'failed':'reconciling',{error:/^provider_http_4\d\d$/.test(code)?code:'submission_unknown_check_provider_history'});return true;
    }
    await mkdir(join(this.media.root,'receipts'),{recursive:true});const file=await open(join(this.media.root,'receipts',`${job.id}.json`),'w',0o600);
    try{await file.writeFile(JSON.stringify(receipt));await file.sync();}finally{await file.close();}
    await this.queue.defer(job.id,job.lease_token,receipt);return true;
   }
   if(Date.now()>new Date(job.deadline_at).getTime()){await this.queue.finish(job.id,job.lease_token,'reconciling',{error:'provider_wait_exceeded'});return true;}
   let polled;
   try{polled=await client.poll(job.provider);}catch(e){
    if(['provider_failed','provider_http_400','provider_http_401','provider_http_403','provider_http_422'].includes((e as Error).message))throw e;
    await this.queue.defer(job.id,job.lease_token,job.provider);return true;
   }
   if(!polled.done){
    await this.queue.defer(job.id,job.lease_token,job.provider);return true;
   }
   const output=polled.output!;
   if(job.kind==='script'){
    const text=String(output.output??'').replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
    const parsed=storyboardSchema.parse(JSON.parse(text));const storyboard={...parsed,shots:parsed.shots.map(s=>({...s,id:s.id??randomUUID()}))};
    await this.queue.finish(job.id,job.lease_token,'ready',{storyboard});return true;
   }
   const record=job.kind==='image'?(output.images as Array<{url:string}>|undefined)?.[0]:job.kind==='tts'?output.audio:output.video;
   if(!record||typeof(record as {url?:unknown}).url!=='string')throw new Error('provider_output_invalid');
   let bytes:Buffer;
   try{bytes=await client.download((record as {url:string}).url);}catch{
    await this.queue.defer(job.id,job.lease_token,job.provider);return true;
   }
   await this.recordMedia(job,await this.media.ingest(bytes,`${job.kind} ${job.id.slice(0,8)}`),providerInput(job.kind,job.input).endpoint);return true;
  }catch(e){
   const code=(e as Error).message;
   await this.queue.finish(job.id,job.lease_token,submissionStarted?'reconciling':'failed',{error:submissionStarted?'submission_unknown_check_provider_history':/^[a-z_0-9]+$/.test(code)?code:'processing_failed'}).catch(()=>{});return true;
  }finally{clearInterval(timer);}
 }
 private async recordMedia(job:CommunityJob,item:MediaFile & {id:string;name:string},model:string){
  const {path:_path,directory:_directory,...data}=item;
  const values={...data,mediaId:item.id,kind:item.contentType.split('/')[0],metadata:{model,prompt:job.input.prompt??null,method:job.kind,jobId:job.id,cost:null,source:job.kind==='render'?'local':'provider',generationMs:Date.now()-new Date(job.created_at).getTime()}};
  await this.store.db.query<Document>('INSERT INTO community_documents(id,owner,kind,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO NOTHING RETURNING *',[job.id,job.owner,'asset',JSON.stringify(values)]);
  await this.queue.finish(job.id,job.lease_token,'ready',{assetId:job.id});
 }
}
