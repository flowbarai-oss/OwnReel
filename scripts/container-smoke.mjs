// Explicit isolated-install acceptance only. Never part of API startup.
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
if(process.env.COMMUNITY_ACCEPTANCE!=='1')throw new Error('Explicit isolated acceptance environment required');
const origin=process.env.COMMUNITY_ORIGIN??'http://localhost:4420';let cookie='';
async function api(path,body,method=body?'POST':'GET'){
 const multipart=body instanceof FormData;
 const response=await fetch('http://127.0.0.1:4421'+path,{method,headers:{origin,cookie,...(multipart?{}:{'content-type':'application/json'})},body:body?(multipart?body:JSON.stringify(body)):undefined});
 if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 const json=await response.json();if(!response.ok)throw new Error(`${response.status}:${json.code}`);return json.data;
}
let account;try{account=JSON.parse(await readFile('/data/acceptance-account.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const status=await api('/api/community/status');
if(!account){if(status.initialized)throw new Error('Not an empty acceptance installation; refusing changes');account={name:'acceptance-owner',password:randomBytes(24).toString('base64url')};await writeFile('/data/acceptance-account.json',JSON.stringify(account),{flag:'wx',mode:0o600});}
if(!status.initialized)await api('/api/community/setup',{...account,token:(await readFile('/data/bootstrap-token','utf8')).trim()});
await api('/api/community/login',account);
const evidencePath='/data/acceptance-result.json';
if(process.argv.includes('--verify')){
 if(!(await api('/api/community/settings')).configured)throw new Error('Encrypted provider configuration not restored');
 const result=JSON.parse(await readFile(evidencePath,'utf8'));
 const project=await api(`/api/v1/projects/${result.projectId}`);if(project.assets.length!==1)throw new Error('Restored reference mismatch');
 const response=await fetch(`http://127.0.0.1:4421/api/v1/assets/${result.outputId}/content`,{headers:{cookie}});const digest=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
 if(!response.ok||digest!==result.sha256)throw new Error('Restored media mismatch');
 console.log(JSON.stringify({verified:true,projectId:result.projectId,sha256:digest}));
}else{
 // Inert test value, never submitted to a provider. publicStatus decrypts it.
 await api('/api/community/settings',{falKey:'acceptance-inert-not-a-provider-key'},'PUT');
 const project=await api('/api/v1/projects',{name:'Isolated container proof'});
 const png=await sharp({create:{width:640,height:360,channels:3,background:'#3344aa'}}).png().toBuffer();
 const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'original-test.png');const asset=await api('/api/v1/uploads/reference',form);
 await api(`/api/v1/projects/${project.id}/assets`,{assetId:asset.id});
 const job=await api('/api/community/jobs',{kind:'render',idempotencyKey:randomUUID(),input:{projectId:project.id,manifest:{version:1,aspectRatio:'16:9',resolution:'720p',clips:[{id:randomUUID(),sourceAssetId:asset.id,track:'video',start:0,in:0,out:1000,speed:1,volume:1,muted:false,fit:'contain',text:'',scale:1,x:50,y:50,transition:'cut'}]}},confirmCost:false});
 let current=job;for(let i=0;i<90&&!['ready','failed'].includes(current.state);i++){await new Promise(r=>setTimeout(r,2000));current=await api(`/api/community/jobs/${job.id}`);}
 if(current.state!=='ready')throw new Error(`Render did not finish: ${current.state}`);
 const outputId=current.result.assetId;const response=await fetch(`http://127.0.0.1:4421/api/v1/assets/${outputId}/content`,{headers:{cookie}});const bytes=Buffer.from(await response.arrayBuffer());
 if(!response.ok||bytes.subarray(4,8).toString()!=='ftyp')throw new Error('Invalid output media');
 const result={passed:true,projectId:project.id,jobId:job.id,outputId,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt:new Date().toISOString()};
 await writeFile(evidencePath,JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));
}
