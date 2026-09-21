import {readFile} from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const approved=new Set(['MIT','ISC','Apache-2.0','BSD-2-Clause','BSD-3-Clause','0BSD','BlueOak-1.0.0','CC0-1.0','CC-BY-4.0','Python-2.0','Unlicense','(MIT OR CC0-1.0)','(MIT OR Apache-2.0)','(MIT AND Zlib)','(MIT AND BSD-3-Clause)','(BSD-2-Clause OR MIT OR Apache-2.0)','(MIT OR GPL-2.0)','Zlib']);
const issues=[];let checked=0;
const reviewed=(path,license)=>path.startsWith('node_modules/@img/sharp-')&&['LGPL-3.0-or-later','Apache-2.0 AND LGPL-3.0-or-later','Apache-2.0 AND LGPL-3.0-or-later AND MIT'].includes(license)||/^node_modules\/lightningcss(?:-|$)/.test(path)&&license==='MPL-2.0';
for(const [path,entry] of Object.entries(lock.packages)){if(!path||entry.link||!path.includes('node_modules/'))continue;checked++;if(!entry.license||!approved.has(entry.license)&&!reviewed(path,entry.license))issues.push({path,license:entry.license??'MISSING'});}
console.log(JSON.stringify({checked,reviewRequired:issues},null,2));if(issues.length)process.exitCode=1;
