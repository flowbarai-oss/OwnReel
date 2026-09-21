import {z} from 'zod';
export const generationSchema=z.object({prompt:z.string().trim().min(1).max(5000),aspectRatio:z.enum(['16:9','9:16']).default('16:9'),resolution:z.enum(['480p','720p']).default('480p'),language:z.enum(['en','zh-CN']).default('en'),referenceAssetId:z.string().uuid().optional(),projectId:z.string().uuid().optional(),shotId:z.string().uuid().optional(),template:z.enum(['product','feature','social']).default('product')});
export type GenerationInput=z.infer<typeof generationSchema>;
export const modelCatalog=[
 {kind:'script',label:'Script · Gemini Flash Lite',endpoint:'fal-ai/any-llm',role:'script'},
 {kind:'image',label:'Image · FLUX Schnell',endpoint:'fal-ai/flux/schnell',role:'image'},
 {kind:'video',label:'Video · Wan 2.2',endpoint:'fal-ai/wan/v2.2-a14b/text-to-video',role:'video'},
 {kind:'image-video',label:'Image to video · Wan 2.2',endpoint:'fal-ai/wan/v2.2-a14b/image-to-video',role:'video'},
 {kind:'tts',label:'Voice · MiniMax Speech 02 HD',endpoint:'fal-ai/minimax/speech-02-hd',role:'tts'},
] as const;
export function preflight(kind:string,configured:boolean,confirmed:boolean){
 return {canSubmit:kind==='render'||configured&&confirmed,code:kind==='render'?'ready':!configured?'configure_provider':!confirmed?'confirm_provider_cost':'ready',estimate:{kind:kind==='render'?'local':'unknown',currency:null,min:null,max:null,source:kind==='render'?'local-compute':'provider-billed',checkedAt:new Date().toISOString()}};
}
export function providerInput(kind:string,raw:unknown):{endpoint:string;input:Record<string,unknown>}{
 const data=generationSchema.parse(raw),model=modelCatalog.find(m=>m.kind===kind);if(!model)throw new Error('model_not_supported');
 if(kind==='image')return {endpoint:model.endpoint,input:{prompt:data.prompt,image_size:data.aspectRatio==='9:16'?'portrait_16_9':'landscape_16_9',num_images:1,enable_safety_checker:true,output_format:'png'}};
 if(kind==='tts')return {endpoint:model.endpoint,input:{text:data.prompt,language_boost:data.language==='en'?'English':'Chinese',voice_setting:{voice_id:'Wise_Woman',speed:1,vol:1,emotion:'neutral'},audio_setting:{format:'mp3'},output_format:'url'}};
 if(kind==='script')return {endpoint:model.endpoint,input:{prompt:data.prompt,model:'google/gemini-2.5-flash-lite',max_tokens:1600,temperature:.5,system_prompt:`Create a ${data.template} short movie storyboard in ${data.language==='en'?'English':'Chinese'}. Return only JSON: {"title":"...","shots":[{"prompt":"visual description","narration":"spoken words","caption":"short on-screen text","durationMs":5000}]}. Exactly 3 shots. ${data.template==='product'?'Show a product, a benefit and a call to action.':data.template==='feature'?'Show a problem, a feature demonstration and its result.':'Use an attention hook, one clear idea and an invitation.'} Each narration should fit five seconds. No markdown, no URLs.`}};
 return {endpoint:model.endpoint,input:{prompt:data.prompt,resolution:data.resolution,aspect_ratio:data.aspectRatio,num_frames:81,frames_per_second:16,enable_safety_checker:true,enable_output_safety_checker:true,enable_prompt_expansion:false}};
}
const queueUrl=(raw:unknown)=>{const url=new URL(String(raw));if(url.origin!=='https://queue.fal.run'||url.username||url.password||!url.pathname.startsWith('/fal-ai/'))throw new Error('provider_url_invalid');return url.toString();};
export class FalProvider {
 constructor(readonly key:string,readonly fetcher:typeof fetch=fetch){}
 private async request(url:string,init:RequestInit={}){
  const response=await this.fetcher(queueUrl(url),{...init,headers:{Authorization:`Key ${this.key}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(response.status>=500?'provider_temporarily_unavailable':`provider_http_${response.status}`);
  return await response.json() as Record<string,unknown>;
 }
 async submit(endpoint:string,input:Record<string,unknown>){
  if(!modelCatalog.some(m=>m.endpoint===endpoint))throw new Error('model_not_supported');
  const result=await this.request(`https://queue.fal.run/${endpoint}`,{method:'POST',body:JSON.stringify(input)});
  if(typeof result.request_id!=='string')throw new Error('provider_response_unknown');
  return {request_id:result.request_id,status_url:queueUrl(result.status_url),response_url:queueUrl(result.response_url)};
 }
 async poll(provider:Record<string,unknown>){
  const result=await this.request(queueUrl(provider.status_url));
  if(result.error||result.error_type||result.status==='FAILED'||result.status==='CANCELLED')throw new Error('provider_failed');
  if(result.status==='COMPLETED'){
   const output=await this.request(queueUrl(provider.response_url));if(output.error||output.detail||output.partial===true)throw new Error('provider_failed');
   return {done:true,output};
  }
  if(!['IN_QUEUE','IN_PROGRESS'].includes(String(result.status)))throw new Error('provider_state_unknown');
  return {done:false,output:null};
 }
 async download(raw:string){
  const url=new URL(raw);if(url.protocol!=='https:'||url.port||url.username||url.password||!['fal.media','v3.fal.media','v3b.fal.media','v2.fal.media'].includes(url.hostname))throw new Error('provider_media_host_not_allowed');
  const response=await this.fetcher(url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok||!response.body)throw new Error('provider_download_failed');
  const chunks:Uint8Array[]=[];let size=0;
  for await(const chunk of response.body as unknown as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>100*1024*1024)throw new Error('media_size_limit');chunks.push(chunk);}
  return Buffer.concat(chunks);
 }
}
