// Original geometric image and synthesized tone; no downloaded stock media.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import sharp from 'sharp';
const directory=resolve(process.argv[2]??'data/samples');await mkdir(directory,{recursive:true});
const svg='<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#12152e"/><stop offset="1" stop-color="#6857ec"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="640" cy="350" r="180" fill="#48d9db"/><rect x="535" y="210" width="210" height="300" rx="40" fill="#141833"/><circle cx="640" cy="330" r="60" fill="#f3f4ff"/></svg>';
await sharp(Buffer.from(svg)).png().toFile(join(directory,'original-product.png'));
const rate=22050,seconds=15,count=rate*seconds,wav=Buffer.alloc(44+count*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*2,40);
for(let i=0;i<count;i++){const t=i/rate,fade=Math.min(1,t,seconds-t),frequency=[220,261.63,329.63][Math.floor(t/5)];wav.writeInt16LE(Math.round(Math.sin(2*Math.PI*frequency*t)*1200*fade),44+i*2);}
await writeFile(join(directory,'original-demo-tone.wav'),wav);
await writeFile(join(directory,'captions.en.srt'),'1\n00:00:00,000 --> 00:00:05,000\nFrom your idea\n\n2\n00:00:05,000 --> 00:00:10,000\nTo your story\n\n3\n00:00:10,000 --> 00:00:15,000\nCreate your next movie\n');
await writeFile(join(directory,'captions.zh-CN.srt'),'1\n00:00:00,000 --> 00:00:05,000\n从你的灵感\n\n2\n00:00:05,000 --> 00:00:10,000\n到你的故事\n\n3\n00:00:10,000 --> 00:00:15,000\n开启下一次创作\n');
await writeFile(join(directory,'README.txt'),'Original samples generated from MIT-licensed source. The WAV is a simple synthesized tone, not speech or AI music. Use the SRT text as a narration script with your own recording or optional paid TTS. Upload the PNG and WAV in Assets; select the PNG for three 5-second scenes, then add the WAV to the music track.\n');
console.log(`Created original samples in ${directory}`);
