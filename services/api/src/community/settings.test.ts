import {expect,test} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomBytes} from 'node:crypto';
import {ProviderSettings} from './settings.js';
test('credentials are encrypted at rest, owner scoped, redacted on read and removable',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  const settings=new ProviderSettings(db,randomBytes(32));await settings.migrate();
  await settings.save('creator','super-private-value');
  expect(await settings.publicStatus('creator')).toEqual({configured:true});
  expect(await settings.key('creator')).toBe('super-private-value');
  expect(await settings.key('other')).toBeNull();
  expect(JSON.stringify((await db.query('SELECT * FROM community_provider_settings')).rows)).not.toContain('super-private-value');
  await settings.clear('creator');expect(await settings.key('creator')).toBeNull();
 }finally{await db.close();}
});
