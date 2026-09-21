import {expect,test} from 'vitest';
import {providerInput,FalProvider,preflight} from './providers.js';
test('preflight never calls missing or unconfirmed providers and never labels unknown cost free',()=>{
 expect(preflight('image',false,false)).toMatchObject({canSubmit:false,code:'configure_provider',estimate:{kind:'unknown',min:null}});
 expect(preflight('image',true,false)).toMatchObject({canSubmit:false,code:'confirm_provider_cost'});
 expect(preflight('image',true,true)).toMatchObject({canSubmit:true});
 expect(()=>providerInput('video',{prompt:'A scene',resolution:'4k',aspectRatio:'16:9'})).toThrow();
 expect(providerInput('image',{prompt:'A scene',aspectRatio:'9:16'}).input).toMatchObject({image_size:'portrait_16_9',enable_safety_checker:true,num_images:1});
});
test('accepts the observed fal output CDN without allowing arbitrary media hosts',async()=>{
 const client=new FalProvider('test-key',async()=>new Response(new Uint8Array([1,2,3])));
 await expect(client.download('https://v3b.fal.media/files/example.png')).resolves.toEqual(Buffer.from([1,2,3]));
 await expect(client.download('https://v3b.fal.media.evil.example/a')).rejects.toThrow('provider_media_host_not_allowed');
});
test('completed fal errors end immediately instead of being interpreted as success',async()=>{
 const client=new FalProvider('private-test-key',async()=>new Response(JSON.stringify({status:'COMPLETED',error:'invalid request',error_type:'validation'}),{status:200}));
 await expect(client.poll({status_url:'https://queue.fal.run/fal-ai/flux/requests/test/status',response_url:'https://queue.fal.run/fal-ai/flux/requests/test'})).rejects.toThrow('provider_failed');
 await expect(client.poll({status_url:'http://127.0.0.1/secret',response_url:'https://queue.fal.run/test'})).rejects.toThrow('provider_url_invalid');
});
