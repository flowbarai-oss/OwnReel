export type Subtitle={start:number;end:number;text:string};
export function parseSrt(text:string):Subtitle[]{
 if(!text.trim())return [];
 return text.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/).map((block,index)=>{
  const lines=block.split('\n');if(/^\d+$/.test(lines[0]))lines.shift();
  const match=/^(\d{2}):([0-5]\d):([0-5]\d),(\d{3}) --> (\d{2}):([0-5]\d):([0-5]\d),(\d{3})$/.exec(lines.shift()??'');
  if(!match)throw new Error(`invalid_subtitle_${index+1}`);
  const start=(Number(match[1])*3600+Number(match[2])*60+Number(match[3]))*1000+Number(match[4]);
  const end=(Number(match[5])*3600+Number(match[6])*60+Number(match[7]))*1000+Number(match[8]);
  const text=lines.join('\n');if(end<=start||end>300000||!text||text.length>1000)throw new Error(`invalid_subtitle_${index+1}`);
  return {start,end,text};
 });
}
export function writeSrt(captions:Subtitle[]):string{
 const time=(n:number)=>{if(!Number.isFinite(n)||n<0)throw new Error('invalid_subtitle_time');const ms=Math.round(n);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
 return captions.map((c,i)=>`${i+1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}\n`).join('\n');
}
