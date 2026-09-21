import {expect,test,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CommunityStore} from './store.js';
import {LocalMedia} from './media.js';
import {JobQueue} from './jobs.js';
import {ProviderSettings} from './settings.js';
import {CommunityWorker} from './runtime.js';
test('worker persists provider receipt, then registers result; restarting never resubmits',async()=>{
 const db=new PGlite();await db.waitReady;const root=await mkdtemp(join(tmpdir(),'gen-worker-'));
 try{
  const store=new CommunityStore(db);await store.migrate();const user=await store.initialize('creator','hash');
  const queue=new JobQueue(db);await queue.migrate();const settings=new ProviderSettings(db,randomBytes(32));await settings.migrate();await settings.save(user.id,'test-key');
  let submissions=0;
  const provider={submit:async()=>{submissions++;return {request_id:'receipt',status_url:'https://queue.fal.run/status',response_url:'https://queue.fal.run/result'};},poll:async()=>({done:true,output:{output:JSON.stringify({title:'A film',shots:[{prompt:'A blue bottle',narration:'Meet blue',caption:'Blue',durationMs:5000},{prompt:'Use bottle',narration:'Use blue',caption:'Use',durationMs:5000},{prompt:'Final scene',narration:'Try it',caption:'Try',durationMs:5000}]})}}),download:async()=>Buffer.alloc(0)};
  const job=await queue.submit(user.id,'script-once','script',{prompt:'Blue bottle',aspectRatio:'16:9',language:'en',template:'product'});
  await new CommunityWorker(store,queue,settings,new LocalMedia(root),()=>provider).tick();
  expect((await queue.get(user.id,job.id))?.state).toBe('polling');
  await db.query('UPDATE community_jobs SET available_at=now()');
  await new CommunityWorker(store,queue,settings,new LocalMedia(root),()=>provider).tick();
  expect(submissions).toBe(1);expect((await queue.get(user.id,job.id))?.state).toBe('ready');
  expect((await queue.get(user.id,job.id))?.result?.storyboard).toMatchObject({title:'A film'});
  const ambiguous=await queue.submit(user.id,'receipt-db-failure','script',{prompt:'Another film'});
  vi.spyOn(queue,'defer').mockRejectedValueOnce(new Error('database unavailable'));
  await new CommunityWorker(store,queue,settings,new LocalMedia(root),()=>provider).tick();
  expect((await queue.get(user.id,ambiguous.id))?.state).toBe('reconciling');
  await new CommunityWorker(store,queue,settings,new LocalMedia(root),()=>provider).tick();
  expect(submissions).toBe(2);
 }finally{await db.close();await rm(root,{recursive:true,force:true});}
});
test('rate-limited polling retries retrieval, explicit failure is terminal, and expiry pauses without resubmission',async()=>{
 const db=new PGlite();await db.waitReady;const root=await mkdtemp(join(tmpdir(),'gen-fault-'));
 try{
  const store=new CommunityStore(db);await store.migrate();const user=await store.initialize('creator','hash');const queue=new JobQueue(db);await queue.migrate();const settings=new ProviderSettings(db,randomBytes(32));await settings.migrate();await settings.save(user.id,'test-key');
  const submit=vi.fn(async()=>({request_id:'one',status_url:'https://queue.fal.run/fal-ai/flux/requests/one/status',response_url:'https://queue.fal.run/fal-ai/flux/requests/one'}));
  const poll=vi.fn().mockRejectedValueOnce(new Error('provider_http_429')).mockRejectedValueOnce(new Error('provider_failed'));
  const worker=new CommunityWorker(store,queue,settings,new LocalMedia(root),()=>({submit,poll,download:async()=>Buffer.alloc(0)}));
  const job=await queue.submit(user.id,'rate','image',{prompt:'Blue'});await worker.tick();
  await db.query('UPDATE community_jobs SET available_at=now()');await worker.tick();expect((await queue.get(user.id,job.id))?.state).toBe('polling');
  await db.query('UPDATE community_jobs SET available_at=now()');await worker.tick();expect((await queue.get(user.id,job.id))?.state).toBe('failed');
  await worker.tick();expect(poll).toHaveBeenCalledTimes(2);expect(submit).toHaveBeenCalledTimes(1);
  const expired=await queue.submit(user.id,'expired','image',{prompt:'Other'});await worker.tick();await db.query("UPDATE community_jobs SET deadline_at=now()-interval '1 second',available_at=now() WHERE id=$1",[expired.id]);await worker.tick();
  expect((await queue.get(user.id,expired.id))?.state).toBe('reconciling');expect(submit).toHaveBeenCalledTimes(2);expect(poll).toHaveBeenCalledTimes(2);
 }finally{await db.close();await rm(root,{recursive:true,force:true});}
});
