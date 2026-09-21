import {copyFile, mkdir, readFile, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve, dirname, isAbsolute, sep} from 'node:path';
import {createHash} from 'node:crypto';

export async function exportSource(source, target, files) {
  for(const file of files) {
    if(isAbsolute(file) || file.includes('\\') || file.split('/').some(p=>!p || p==='..' || p==='.' || p==='.git' || p.startsWith('.env') || p==='logs') || !/\.(?:tsx?|css|json|md)$/.test(file) && !['LICENSE','NOTICE'].includes(file)) throw new Error('unsafe_export_path');
  }
  const planned=[];
  for(const file of files) {
    const from=resolve(source,file), to=resolve(target,file);
    if(!from.startsWith(resolve(source)+sep) || !to.startsWith(resolve(target)+sep)) throw new Error('unsafe_export_path');
    if(!(await lstat(from)).isFile()) throw new Error('unsafe_export_path');
    try {await lstat(to); throw new Error('export_destination_exists');} catch(e) {if(e.code!=='ENOENT')throw e;}
    const bytes=await readFile(from);
    planned.push({file,from,to,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  for(const item of planned) {await mkdir(dirname(item.to),{recursive:true});await copyFile(item.from,item.to,constants.COPYFILE_EXCL);}
  return planned.map(({file,sha256})=>({file,sha256}));
}
