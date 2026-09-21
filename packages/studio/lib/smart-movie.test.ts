import {expect,test} from 'vitest';
import {storyboardTimeline} from './smart-movie';
import type {Asset,Storyboard} from './api';
test('storyboard maps owned visuals, narration and captions to the same timeline without clipping long voice',()=>{
 const image={id:'11111111-1111-4111-8111-111111111111',kind:'image',signedUrl:'/local',created_at:'',content_type:'image/png',byte_size:5} as Asset;
 const voice={...image,id:'22222222-2222-4222-8222-222222222222',kind:'audio',duration_ms:7000} as Asset;
 const draft:Storyboard={title:'Test',shots:[{id:'33333333-3333-4333-8333-333333333333',prompt:'Scene',narration:'Voice',caption:'Hello',durationMs:5000,assetId:image.id,voiceAssetId:voice.id}]};
 expect(()=>storyboardTimeline(draft,[image,voice],'16:9','720p',false)).toThrow('voice_longer_than_scene');
 const timeline=storyboardTimeline(draft,[image,voice],'16:9','720p',true);
 expect(timeline.clips.find(c=>c.track==='video')?.out).toBe(7000);
 expect(timeline.clips.find(c=>c.track==='voice')?.out).toBe(7000);
 expect(timeline.clips.find(c=>c.track==='caption')?.text).toBe('Hello');
 expect(()=>storyboardTimeline(draft,[],'16:9','720p',true)).toThrow('scene_media_required');
 expect(storyboardTimeline(draft,[image,voice],'9:16','720p',true).clips.find(c=>c.track==='video')?.canvasBackground).toBe('blur');
});
