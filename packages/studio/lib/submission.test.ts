import {expect,test} from 'vitest';
import {SubmissionIntent} from './submission';
test('ambiguous retries reuse an intent; acknowledged results allow a deliberate new request',()=>{
 const intent=new SubmissionIntent(),input={prompt:'A blue cup'};
 const key=intent.key('image',input);expect(intent.key('image',input)).toBe(key);
 expect(intent.key('video',input)).not.toBe(key);
 intent.acknowledge('image',input);expect(intent.key('image',input)).not.toBe(key);
});
