import {expect,test} from 'vitest';
import {parseSrt,writeSrt} from './srt';
test('SRT preserves exact bilingual timestamps and refuses invalid ranges',()=>{
 const input='1\n00:00:01,250 --> 00:00:03,500\nHello\n你好\n\n2\n00:00:04,000 --> 00:00:05,000\nWorld\n';
 expect(parseSrt(input)).toEqual([{start:1250,end:3500,text:'Hello\n你好'},{start:4000,end:5000,text:'World'}]);
 expect(writeSrt([{start:1250,end:3500,text:'Hello\n你好'}])).toBe('1\n00:00:01,250 --> 00:00:03,500\nHello\n你好\n');
 expect(()=>parseSrt('1\n00:00:05,000 --> 00:00:02,000\nBad')).toThrow('invalid_subtitle_1');
});
