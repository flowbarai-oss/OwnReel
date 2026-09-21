// Local acceptance only; consumes previously generated assets. No provider calls.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {storyboardTimeline} from '../packages/studio/lib/smart-movie.js';
import {toApi,renderClips,makeClip} from '../packages/studio/lib/video-timeline.js';
import type {Asset,Storyboard,Project,Job} from '../packages/studio/lib/api.js';
const dir=resolve(process.argv[2]??'');if(!process.argv[2])throw new Error('Evidence directory required');
const evidence=JSON.parse(await readFile(join(dir,'paid-acceptance.json'),'utf8'));
let cookie='';
async function api<T>(path:string,body?:unknown,method=body?'POST':'GET'):Promise<T>{const r=await fetch('http://127.0.0.1:4421'+path,{method,headers:{origin:'http://localhost:4420',cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie')!.split(';')[0];const json=await r.json();if(!r.ok)throw new Error(json.code??`http_${r.status}`);return json.data;}
await api('/api/community/login',{name:'community-test',password:'Local-only-test-password-2026'});
const assets=await api<Asset[]>('/api/v1/assets');
type ProofJob={kind:string;language?:string;testCase?:string;result:{assetId?:string;storyboard?:Storyboard}};
const jobs=evidence.jobs as ProofJob[];
const source=(kind:string)=>jobs.find(j=>j.kind===kind&&j.result?.assetId)!.result.assetId!;
const records:unknown[]=[];await mkdir(dir,{recursive:true});
for(const [name,language,template,aspect] of [['Product ad','en','main','9:16'],['功能介绍','zh-CN','feature-story','16:9'],['Social short','en','social-story','9:16']]){
 const story=jobs.find(j=>j.kind==='script'&&(j.language??'en')===language&&(j.testCase??'main')===template)!.result.storyboard!;
 const draft:Storyboard={...story,shots:story.shots.map((s,i)=>({...s,assetId:source(i===1?'image-video':i===2?'video':'image'),voiceAssetId:template==='social-story'?undefined:jobs.find(j=>j.kind==='tts'&&j.language===language&&j.testCase===`scene-${i+1}`)!.result.assetId}))};
 const project=await api<Project>('/api/v1/projects',{name:`Acceptance · ${name}`});
 await api(`/api/community/projects/${project.id}/storyboard`,{revision:project.revision,storyboard:draft},'PUT');
 const timeline=storyboardTimeline(draft,assets,aspect,'720p',true);
 // Reuse an uploaded audio track only when explicitly supplied by this test.
 if(process.env.COMMUNITY_PROOF_MUSIC_ID){const music=assets.find(a=>a.id===process.env.COMMUNITY_PROOF_MUSIC_ID&&a.kind==='audio');if(!music)throw new Error('Proof music asset missing');timeline.clips.push({...makeClip(music.id,'music',Math.min(music.duration_ms??0,15000),0),volume:.15});}
 await api(`/api/v1/projects/${project.id}/timeline`,{...toApi(timeline),expectedRevision:0},'PUT');
 const job=await api<Job>('/api/community/jobs',{kind:'render',input:{projectId:project.id,manifest:{version:1,aspectRatio:aspect,resolution:'720p',clips:renderClips(timeline)}},idempotencyKey:`proof-${project.id}`,confirmCost:false});
 let current=job;for(let i=0;i<180&&!['ready','failed'].includes(current.state);i++){await new Promise(r=>setTimeout(r,5000));current=await api<Job>(`/api/community/jobs/${job.id}`);}
 if(current.state!=='ready')throw new Error(`render_${current.state}_${current.result?.error}`);
 const response=await fetch(`http://127.0.0.1:4421/api/v1/assets/${current.result!.assetId}/content`,{headers:{cookie}});if(!response.ok)throw new Error('download_failed');const file=join(dir,`${language}-${template}.mp4`);await writeFile(file,Buffer.from(await response.arrayBuffer()));
 records.push({name,language,projectId:project.id,jobId:job.id,assetId:current.result!.assetId,file,storyboard:draft});await writeFile(join(dir,'composition-proof.json'),JSON.stringify(records,null,2));console.log(JSON.stringify({name,jobId:job.id,state:current.state,file}));
}
