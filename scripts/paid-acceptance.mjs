// Explicit, opt-in live acceptance. Never invoked by CI or npm test.
// Usage: node scripts/paid-acceptance.mjs <key-file> <output-directory>
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const [keyFile,outArg]=process.argv.slice(2);
if(!keyFile||!outArg)throw new Error('Explicit key file and evidence directory required');
const out=resolve(outArg);await mkdir(out,{recursive:true});
const raw=await readFile(keyFile,'utf8');
const key=raw.match(/[a-f0-9]{8}-[a-f0-9-]{27,}:[a-f0-9]{16,}/i)?.[0];
if(!key)throw new Error('Unrecognized key file; never print its contents');
const base='http://127.0.0.1:4421',origin='http://localhost:4420';let cookie='';
async function api(path,body,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 const json=await r.json();if(!r.ok)throw new Error(`local_api_${r.status}_${json.code??'error'}`);return json.data;
}
await api('/api/community/login',{name:'community-test',password:'Local-only-test-password-2026'});
await api('/api/community/settings',{falKey:key},'PUT');
let evidence;try{evidence=JSON.parse(await readFile(join(out,'paid-acceptance.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;evidence={startedAt:new Date().toISOString(),budgetUsd:10,reservedUsd:0,jobs:[]};}
const save=()=>writeFile(join(out,'paid-acceptance.json'),JSON.stringify(evidence,null,2));
// Upper-bound reservations are intentionally much higher than current unit prices.
async function run(kind,input,reserve,testCase='main'){
 let entry=evidence.jobs.find(j=>j.kind===kind&&(j.language??'en')===(input.language??'en')&&(j.testCase??'main')===testCase);
 const reviewedRetry=process.argv.includes('--reviewed-zh-retry')&&kind==='tts'&&input.language==='zh-CN';
 if(entry?.state==='reconciling'&&reviewedRetry){entry.language='zh-CN-uncertain';entry.review='Provider request history checked twice for the submission window; no matching Chinese request found. Original reservation retained.';entry=undefined;await save();}
 if(!entry){
  if(evidence.reservedUsd+reserve>10)throw new Error('budget_limit');
  evidence.reservedUsd+=reserve;await save();
  const job=await api('/api/community/jobs',{kind,input,idempotencyKey:`acceptance-${evidence.startedAt}-${kind}-${input.language??'en'}-${testCase}${reviewedRetry?'-reviewed-retry-1':''}`,confirmCost:true});
  entry={id:job.id,kind,language:input.language??'en',testCase,reservedUsd:reserve,state:job.state};evidence.jobs.push(entry);await save();
 }
 console.log(JSON.stringify({id:entry.id,kind,state:entry.state}));
 for(let count=0;count<240;count++){
  await new Promise(r=>setTimeout(r,5000));const current=await api(`/api/community/jobs/${entry.id}`);
  if(current.state!==entry.state){entry.state=current.state;console.log(JSON.stringify(entry));await save();}
  if(['ready','failed','reconciling','cancelled'].includes(current.state)){
   entry.result=current.result;entry.providerRequestId=current.providerRequestId;await save();
   if(current.state!=='ready')throw new Error(`acceptance_${kind}_${current.state}`);
   return current.result;
  }
 }
 throw new Error(`acceptance_${kind}_timeout_no_resubmission`);
}
try{
 const image=await run('image',{prompt:'Original studio photograph of a blue ceramic coffee cup on a clean warm wooden table, soft morning window light, no letters, no branding',aspectRatio:'16:9'},.10);
 const english=await run('script',{prompt:'A simple three shot film about a blue ceramic coffee cup. Warm welcoming tone, each spoken line under five words.',language:'en',template:'product'},.10);
 await run('video',{prompt:'Slow cinematic camera push toward a blue ceramic coffee cup on a wooden table in warm morning light. Stable cup, gentle steam, no text, no branding.',resolution:'480p',aspectRatio:'16:9'},1);
 await run('image-video',{prompt:'Slow subtle camera push in. The ceramic cup stays still. Warm morning light. No text.',referenceAssetId:image.assetId,resolution:'480p',aspectRatio:'16:9'},1);
 await run('tts',{prompt:'Welcome. Turn your ideas into a beautiful story.',language:'en'},.10);
 await run('tts',{prompt:'欢迎，把你的灵感，变成动人的故事。',language:'zh-CN'},.10);
 if(process.argv.includes('--complete-stories')){
  const chinese=await run('script',{prompt:'蓝色陶瓷咖啡杯的功能介绍：保温握感、舒适手柄、清洁方便。三个镜头，每句旁白不超过八个汉字。',language:'zh-CN',template:'feature'},.10,'feature-story');
  await run('script',{prompt:'A calm morning with a blue ceramic coffee cup. Three short social scenes, each narration under five words. No claims about health.',language:'en',template:'social'},.10,'social-story');
  for(const [language,story] of [['en',english.storyboard],['zh-CN',chinese.storyboard]])for(let index=0;index<story.shots.length;index++)await run('tts',{prompt:story.shots[index].narration,language},.10,`scene-${index+1}`);
 }
 delete evidence.error;evidence.completedAt=new Date().toISOString();await save();
}catch(e){evidence.error=e.message;await save();console.error(e.message);process.exitCode=1;}
