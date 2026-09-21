import {expect,test} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {LocalMedia} from './media.js';
test('ingest verifies actual bytes and persists measured dimensions with a safe path',async()=>{
 const root=await mkdtemp(join(tmpdir(),'gen-media-'));
 try{
  const store=new LocalMedia(root);
  await expect(store.ingest(Buffer.from('<script>bad</script>'),'fake.png')).rejects.toThrow('unsupported_media');
  const bytes=await sharp({create:{width:320,height:180,channels:3,background:'#7755ee'}}).png().toBuffer();
  const media=await store.ingest(bytes,'../../outside.png');
  expect(media.width).toBe(320);expect(media.height).toBe(180);expect(media.contentType).toBe('image/png');
  expect(media.path.startsWith(root)).toBe(true);expect(await readFile(media.path)).toEqual(bytes);
  expect(media.sha256).toMatch(/^[0-9a-f]{64}$/);
  await expect(store.path('../outside')).rejects.toThrow('invalid_media_id');
 }finally{await rm(root,{recursive:true,force:true});}
});
