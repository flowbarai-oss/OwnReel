import type {Asset,Storyboard} from './api';
import {makeClip,validateTimeline,type Timeline} from './video-timeline';
export function storyboardTimeline(draft:Storyboard,assets:Asset[],aspectRatio:string,resolution:string,extendImages:boolean):Timeline{
 const timeline:Timeline={name:draft.title,aspectRatio,resolution,clips:[]};let start=0;
 for(const shot of draft.shots){
  const visual=assets.find(a=>a.id===shot.assetId);if(!visual||visual.kind==='audio')throw new Error('scene_media_required');
  const voice=assets.find(a=>a.id===shot.voiceAssetId);let duration=shot.durationMs;
  if(shot.voiceAssetId&&(!voice||voice.kind!=='audio'))throw new Error('voice_media_required');
  if(voice?.duration_ms&&voice.duration_ms>duration){if(!extendImages||visual.kind!=='image')throw new Error('voice_longer_than_scene');duration=voice.duration_ms;}
  if(visual.kind==='video'&&(!visual.duration_ms||duration>visual.duration_ms))throw new Error('video_shorter_than_scene');
  timeline.clips.push({...makeClip(visual.id,'video',duration,start,aspectRatio),muted:!!voice,transition:'fade'});
  if(voice)timeline.clips.push({...makeClip(voice.id,'voice',voice.duration_ms??duration,start)});
  if(shot.caption)timeline.clips.push({...makeClip(visual.id,'caption',duration,start),text:shot.caption});
  start+=duration;
 }
 validateTimeline(timeline);return timeline;
}
