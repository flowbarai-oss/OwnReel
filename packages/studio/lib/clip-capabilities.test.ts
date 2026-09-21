import { describe, expect, it } from "vitest";
import { makeClip } from "./video-timeline";
import { canPlaceClip, clipCapabilities, moveClipToTrack } from "./clip-capabilities";

describe("clip media capabilities", () => {
  it("does not expose picture or caption controls for pure audio, including custom lanes", () => {
    const c = {...makeClip("source", "music", 4000), trackId:"custom-audio"};
    expect(clipCapabilities(c,{kind:"audio"})).toEqual({caption:false,visual:false,audio:true,audioUnknown:false});
    expect(canPlaceClip(c,"video",{kind:"audio"})).toBe(false);
    expect(canPlaceClip(c,"caption",{kind:"audio"})).toBe(false);
  });
  it("does not offer sound for captions or images, and distinguishes unprobed videos", () => {
    expect(clipCapabilities(makeClip("s","caption",3000),{kind:"video"}).audio).toBe(false);
    expect(clipCapabilities(makeClip("s","overlay",3000),{kind:"image"}).audio).toBe(false);
    expect(clipCapabilities(makeClip("s","video",3000),{kind:"video"}).audioUnknown).toBe(true);
    expect(clipCapabilities(makeClip("s","video",3000),{kind:"video",hasAudio:false}).audio).toBe(false);
  });
  it("removes unsupported visual fields when extracting video audio without mutating the original", () => {
    const c={...makeClip("s","video",4000),canvasBackground:"blur" as const,effectPreset:"neon" as const,scale:2,x:10,audioFadeIn:500};
    const moved=moveClipToTrack(c,"voice","custom-voice",{kind:"video"});
    expect(moved).toMatchObject({track:"voice",trackId:"custom-voice",scale:1,x:50,audioFadeIn:500});
    expect(moved.canvasBackground).toBeUndefined(); expect(moved.effectPreset).toBeUndefined();
    expect(c.canvasBackground).toBe("blur");
    expect(()=>moveClipToTrack(c,"caption","caption",{kind:"video"})).toThrow("timeline_track_source_incompatible");
  });
});
