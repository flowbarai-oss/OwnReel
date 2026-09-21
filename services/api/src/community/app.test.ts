import {expect,test} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildCommunityApp} from './app.js';
test('generation API requires local auth, valid configuration and explicit cost acknowledgement',async()=>{
 const db=new PGlite();await db.waitReady;const dir=await mkdtemp(join(tmpdir(),'gen-app-'));
 const app=await buildCommunityApp({db,mediaRoot:dir,masterKey:randomBytes(32),origin:'http://localhost:4420',setupToken:'one-time-setup-token',setupExpires:Date.now()+60000});
 try{
  const origin='http://localhost:4420';
  expect((await app.inject('/api/community/settings')).statusCode).toBe(401);
  await app.inject({method:'POST',url:'/api/community/setup',headers:{origin},payload:{token:'one-time-setup-token',name:'admin',password:'Local-Password-2026'}});
  const login=await app.inject({method:'POST',url:'/api/community/login',headers:{origin},payload:{name:'admin',password:'Local-Password-2026'}});
  const headers={origin,cookie:String(login.headers['set-cookie']).split(';')[0]};
  const submit=()=>app.inject({method:'POST',url:'/api/community/jobs',headers,payload:{kind:'image',idempotencyKey:'id-one',input:{prompt:'Scene'},confirmCost:false}});
  expect((await submit()).json().code).toBe('configure_provider');
  await app.inject({method:'PUT',url:'/api/community/settings',headers,payload:{falKey:'private-example-value'}});
  expect((await submit()).json().code).toBe('confirm_provider_cost');
  expect(JSON.stringify((await app.inject({url:'/api/community/settings',headers})).json())).not.toContain('private-example');
  const bad=await app.inject({method:'POST',url:'/api/community/jobs',headers,payload:{kind:'video',idempotencyKey:'bad',input:{prompt:'Scene',resolution:'4k'},confirmCost:true}});expect(bad.statusCode).toBe(400);
  expect((await db.query('SELECT * FROM community_jobs')).rows.length).toBe(0);
  const job=(await app.inject({method:'POST',url:'/api/community/jobs',headers,payload:{kind:'image',idempotencyKey:'one',input:{prompt:'Scene'},confirmCost:true}})).json().data;
  await db.query("UPDATE community_jobs SET state='reconciling' WHERE id=$1",[job.id]);
  const resumed=await app.inject({method:'POST',url:`/api/community/jobs/${job.id}/reconcile`,headers,payload:{requestId:'11111111-1111-4111-8111-111111111111'}});
  expect(resumed.statusCode).toBe(200);expect(resumed.json().data.state).toBe('polling');
  expect((await db.query('SELECT * FROM community_jobs')).rows.length).toBe(1);
  const project=(await app.inject({method:'POST',url:'/api/v1/projects',headers,payload:{name:'Saved settings'}})).json().data;
  await app.inject({method:'PUT',url:`/api/community/projects/${project.id}/storyboard`,headers,payload:{revision:project.revision,storyboard:{title:'Film',aspectRatio:'16:9',resolution:'1080p',template:'feature',shots:[{prompt:'Cup',narration:'Hello',caption:'Cup',durationMs:5000}]}}});
  const restored=(await app.inject({url:`/api/v1/projects/${project.id}`,headers})).json().data;
  expect(restored.storyboard).toMatchObject({aspectRatio:'16:9',resolution:'1080p',template:'feature'});
 }finally{await app.close();await db.close();await rm(dir,{recursive:true,force:true});}
});
