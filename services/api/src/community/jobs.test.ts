import {expect,test} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {CommunityStore} from './store.js';
import {JobQueue} from './jobs.js';

test('retrying only a failed third scene preserves both completed scenes',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  const store=new CommunityStore(db);await store.migrate();const user=await store.initialize('creator','hash');const queue=new JobQueue(db);await queue.migrate();
  const completed:string[]=[];
  for(let i=1;i<=3;i++){
   const job=await queue.submit(user.id,`scene-${i}`,'image',{prompt:`Scene ${i}`});const lease=(await queue.claim())!;
   await queue.finish(job.id,lease.lease_token,i===3?'failed':'ready',i===3?{error:'provider_rejected'}:{assetId:`asset-${i}`});completed.push(job.id);
  }
  const retry=await queue.submit(user.id,'scene-3-explicit-retry','image',{prompt:'Scene 3'});expect((await queue.claim())?.id).toBe(retry.id);
  expect((await queue.get(user.id,completed[0]))?.result).toEqual({assetId:'asset-1'});
  expect((await queue.get(user.id,completed[1]))?.result).toEqual({assetId:'asset-2'});
  expect((await queue.get(user.id,completed[2]))?.state).toBe('failed');
 }finally{await db.close();}
});
test('idempotency rejects changed input and failed tasks never re-enter the queue',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  const store=new CommunityStore(db);await store.migrate();const user=await store.initialize('creator','hash');
  const queue=new JobQueue(db);await queue.migrate();
  const job=await queue.submit(user.id,'same-request','image',{prompt:'one'});
  expect((await queue.submit(user.id,'same-request','image',{prompt:'one'})).id).toBe(job.id);
  await expect(queue.submit(user.id,'same-request','image',{prompt:'two'})).rejects.toThrow('idempotency_conflict');
  const claimed=await queue.claim();expect(claimed?.id).toBe(job.id);
  await queue.finish(job.id,claimed!.lease_token,'failed',{error:'provider_rejected'});
  expect(await queue.claim()).toBeNull();
 }finally{await db.close();}
});
test('crash during provider submission goes to reconciliation, never automatic resubmission',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  const store=new CommunityStore(db);await store.migrate();const user=await store.initialize('creator','hash');const queue=new JobQueue(db);await queue.migrate();
  await queue.submit(user.id,'uncertain','image',{prompt:'one'});const job=(await queue.claim())!;
  await queue.markSubmitting(job.id,job.lease_token);
  await db.query("UPDATE community_jobs SET lease_until=now()-interval '1 second'");
  expect(await queue.claim()).toBeNull();
  expect((await queue.get(user.id,job.id))?.state).toBe('reconciling');
  await expect(queue.finish(job.id,'stale-lease','ready',{})).rejects.toThrow('lease_lost');
 }finally{await db.close();}
});
