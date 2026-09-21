import {expect,test,vi} from 'vitest';
import * as filesystem from 'node:fs/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {LocalMedia} from '../../api/src/community/media.js';
import {renderCommunityMovie} from './community-render.js';
vi.mock('node:fs/promises',async(importOriginal)=>{const actual=await importOriginal<typeof import('node:fs/promises')>();return {...actual,statfs:vi.fn(actual.statfs)};});

test('low disk rejects export before creating temporary output or registering an asset',async()=>{
 const root=await mkdtemp(join(tmpdir(),'gen-disk-'));
 try{
  const media=new LocalMedia(root);
  const ingest=vi.spyOn(media,'ingest');
  vi.mocked(filesystem.statfs).mockResolvedValueOnce({bavail:1,bsize:4096} as Awaited<ReturnType<typeof filesystem.statfs>>);
  await expect(renderCommunityMovie({version:1,aspectRatio:'16:9',resolution:'720p',clips:[{id:'22222222-2222-4222-8222-222222222222',sourceAssetId:'33333333-3333-4333-8333-333333333333',track:'video',start:0,in:0,out:1000,speed:1,volume:1,muted:false,fit:'contain',text:'',scale:1,x:50,y:50,transition:'cut'}]},[],media)).rejects.toThrow('insufficient_disk_space');
  expect(ingest).not.toHaveBeenCalled();expect(await filesystem.readdir(root)).toEqual([]);
 }finally{vi.restoreAllMocks();await rm(root,{recursive:true,force:true});}
});
test('real FFmpeg export produces seekable H264/AAC with requested dimensions and duration',async()=>{
 const root=await mkdtemp(join(tmpdir(),'gen-render-'));
 try{
  const media=new LocalMedia(root);const image=await media.ingest(await sharp({create:{width:320,height:180,channels:3,background:'#2266cc'}}).png().toBuffer(),'owned-test.png');
  for(const [ratio,resolution,width,height] of [['16:9','720p',1280,720],['9:16','720p',720,1280],['16:9','1080p',1920,1080],['9:16','1080p',1080,1920]] as const){
   const output=await renderCommunityMovie({version:1,aspectRatio:ratio,resolution,clips:[{id:'22222222-2222-4222-8222-222222222222',sourceAssetId:image.id,track:'video',start:0,in:0,out:1000,speed:1,volume:1,muted:false,fit:'contain',text:'',scale:1,x:50,y:50,transition:'cut'}]},[{id:image.id,media:image}],media);
   const info=await media.probe(output.path);
   expect(info.streams.find(s=>s.codec_type==='video')).toMatchObject({codec_name:'h264',width,height});
   expect(info.streams.find(s=>s.codec_type==='audio')?.codec_name).toBe('aac');
   expect(Math.abs(Number(info.format.duration)-1)).toBeLessThanOrEqual(.25);
  }
 }finally{await rm(root,{recursive:true,force:true});}
},120000);
