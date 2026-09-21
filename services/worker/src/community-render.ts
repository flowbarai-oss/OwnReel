import type {LocalMedia} from '../../api/src/community/media.js';
import type {MediaFile} from './media.js';
import {mkdtemp,writeFile,readFile,rm,statfs} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {workstationSchema} from '@flowbar/gen-contracts';
import {workstationGraph} from './workstation-render.js';
const execute=promisify(execFile);
export async function renderCommunityMovie(manifest:unknown,sources:Array<{id:string;media:MediaFile}>,media:LocalMedia):Promise<MediaFile & {id:string;name:string}>{
 const parsed=workstationSchema.parse(manifest);
 const disk=await statfs(media.root);if(disk.bavail*disk.bsize<1024*1024*1024)throw new Error('insufficient_disk_space');
 const dir=await mkdtemp(join(media.root,'render-'));
 try{
  const plan=workstationGraph(parsed,sources,dir);
  for(const text of plan.texts)await writeFile(text.path,text.text,{mode:0o600});
  const filter=join(dir,'graph.txt'),output=join(dir,'movie.mp4');
  await writeFile(filter,plan.graph+(plan.audio?'':`;anullsrc=r=48000:cl=stereo,atrim=duration=${plan.seconds}[aout]`),{mode:0o600});
  const inputs=sources.flatMap(s=>[...(s.media.contentType.startsWith('image/')?['-loop','1']:[]),'-protocol_whitelist','file,pipe','-i',s.media.path]);
  await execute(media.ffmpeg,['-nostdin','-v','error','-y',...inputs,'-filter_complex_threads','1','-filter_complex_script',filter,'-map','[vout]','-map','[aout]','-t',String(plan.seconds),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',output],{timeout:15*60000,maxBuffer:1024*1024,windowsHide:true});
  const info=await media.probe(output),video=info.streams.find(s=>s.codec_type==='video');
  if(video?.width!==plan.width||video?.height!==plan.height||video.codec_name!=='h264'||!info.streams.some(s=>s.codec_name==='aac')||Math.abs(Number(info.format.duration)-plan.seconds)>Math.max(.25,plan.seconds*.01))throw new Error('render_validation_failed');
  return await media.ingest(await readFile(output),'Community movie.mp4');
 }finally{await rm(dir,{recursive:true,force:true});}
}
