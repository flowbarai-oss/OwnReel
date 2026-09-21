import {afterEach,expect,test} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {CommunityStore} from './store.js';
const databases:PGlite[]=[];
afterEach(async()=>{for(const db of databases.splice(0))await db.close();});
async function setup(){const db=new PGlite();await db.waitReady;databases.push(db);const store=new CommunityStore(db);await store.migrate();return store;}
test('account initialization is one-time and session lookup persists only a token hash',async()=>{
 const store=await setup();
 expect(await store.initialized()).toBe(false);
 const user=await store.initialize('creator','salt:hash');
 await expect(store.initialize('other','salt:hash')).rejects.toThrow('already_initialized');
 expect((await store.userByName('creator'))?.id).toBe(user.id);
 await store.createSession(user.id,'hash-of-token',new Date(Date.now()+10000));
 expect((await store.session('hash-of-token'))?.id).toBe(user.id);
 expect(await store.session('raw-token')).toBeNull();
 await store.deleteSession('hash-of-token');expect(await store.session('hash-of-token')).toBeNull();
});
test('project updates reject stale revisions and cross-owner access',async()=>{
 const store=await setup();const user=await store.initialize('creator','salt:hash');
 const project=await store.createDocument(user.id,'project',{name:'A',clips:[]});
 const saved=await store.updateDocument(user.id,'project',project.id,1,{name:'B',clips:[]});
 expect(saved.revision).toBe(2);
 await expect(store.updateDocument(user.id,'project',project.id,1,{name:'Lost'})).rejects.toThrow('revision_conflict');
 expect(await store.document('00000000-0000-4000-8000-000000000001','project',project.id)).toBeNull();
 expect((await store.document(user.id,'project',project.id))?.data.name).toBe('B');
});
