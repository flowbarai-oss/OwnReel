import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileTypeFromBuffer} from 'file-type';
import sharp from 'sharp';
import type {MediaFile} from '../../../worker/src/media.js';
const execute=promisify(execFile);
const types=new Set(['image/png','image/jpeg','image/webp','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav','audio/x-wav','audio/flac']);
export class LocalMedia {
 readonly root:string;
 constructor(root:string,readonly ffprobe=process.env.FFPROBE_PATH??'ffprobe',readonly ffmpeg=process.env.FFMPEG_PATH??'ffmpeg'){this.root=resolve(root);}
 async path(id:string){if(!/^[a-f0-9-]{36}(?:-thumb\.jpg)?$/.test(id))throw new Error('invalid_media_id');return join(this.root,id);}
 async probe(path:string){
  const {stdout}=await execute(this.ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',path],{timeout:30000,maxBuffer:1024*1024,windowsHide:true});
  return JSON.parse(stdout) as {streams:Array<{codec_type:string;width?:number;height?:number;codec_name?:string;tags?:{rotate?:string};side_data_list?:Array<{rotation?:number}>}>;format:{duration?:string}};
 }
 async ingest(bytes:Buffer,name:string):Promise<MediaFile & {id:string;name:string}>{
  if(!bytes.length||bytes.length>100*1024*1024)throw new Error('media_size_limit');
  const type=await fileTypeFromBuffer(bytes);if(!type||!types.has(type.mime))throw new Error('unsupported_media');
  await mkdir(this.root,{recursive:true});const id=randomUUID(),path=await this.path(id);
  const safeName=Array.from(name,c=>c.charCodeAt(0)<32||c==='/'||c==='\\'?'_':c).join('').slice(0,160);
  const result:MediaFile & {id:string;name:string}={id,path,directory:this.root,name:safeName,contentType:type.mime,extension:`.${type.ext}`,byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  await writeFile(path,bytes,{flag:'wx',mode:0o600});
  try{
   if(type.mime.startsWith('image/')){
    const image=sharp(bytes,{limitInputPixels:40000000});const meta=await image.metadata();
    if(!meta.width||!meta.height||meta.pages&&meta.pages>1)throw new Error('unsupported_image');
    const rotated=[5,6,7,8].includes(meta.orientation??1);result.width=rotated?meta.height:meta.width;result.height=rotated?meta.width:meta.height;
    await image.rotate().resize(480,480,{fit:'inside',withoutEnlargement:true}).jpeg({quality:75}).toFile(await this.path(`${id}-thumb.jpg`));
   }else{
    const info=await this.probe(path),video=info.streams.find(s=>s.codec_type==='video');
    result.durationMs=Math.round(Number(info.format.duration)*1000);
    if(!Number.isFinite(result.durationMs)||result.durationMs<=0||result.durationMs>7200000)throw new Error('invalid_media_duration');
    result.hasAudio=info.streams.some(s=>s.codec_type==='audio');
    if(type.mime.startsWith('video/')){
     if(!video?.width||!video.height)throw new Error('invalid_video');
     const rotation=Number(video.side_data_list?.find(s=>s.rotation!==undefined)?.rotation??video.tags?.rotate??0);
     [result.width,result.height]=Math.abs(rotation)%180===90?[video.height,video.width]:[video.width,video.height];
     await execute(this.ffmpeg,['-nostdin','-y','-protocol_whitelist','file,pipe','-i',path,'-frames:v','1','-vf','scale=480:480:force_original_aspect_ratio=decrease',await this.path(`${id}-thumb.jpg`)],{timeout:30000,maxBuffer:1024*1024,windowsHide:true});
    }else if(!result.hasAudio)throw new Error('invalid_audio');
   }
   return result;
  }catch(e){await rm(path,{force:true});await rm(await this.path(`${id}-thumb.jpg`),{force:true});throw e;}
 }
 async bytes(id:string){return readFile(await this.path(id));}
}
