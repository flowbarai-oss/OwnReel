import { describe, it, expect } from "vitest";
import {
  makeClip,
  emptyTimeline,
  toApi,
  fromApi,
  edit,
  undo,
  redo,
  endTime,
} from "./video-timeline";
import { setClipTransition } from "./clip-effects";
const source = "11111111-1111-4111-8111-111111111111";
const setup = () => ({
  ...emptyTimeline(),
  clips: [
    makeClip(source, "video", 5000),
    makeClip(source, "video", 5000, 5000),
    makeClip(source, "video", 5000, 10000),
    makeClip(source, "caption", 2000, 8000),
  ],
});
describe("clip effects", () => {
  it("round-trips overlay transitions without moving lower tracks", () => {
    const base = { ...emptyTimeline(), clips: [
      makeClip(source, "video", 12000),
      makeClip(source, "overlay", 5000),
      makeClip(source, "overlay", 5000, 5000),
    ] };
    const result = setClipTransition(base, base.clips[2].id, "dissolve", 500);
    expect(result.clips.map(c => c.start)).toEqual([0, 0, 4500]);
    const encoded = toApi(result);
    expect(encoded.clips[2].transform).toMatchObject({ transition: "dissolve", transitionDuration: 500 });
    expect(setClipTransition(result, base.clips[2].id, "cut").clips[2].start).toBe(5000);
  });
  it("overlaps only the selected lane, supports chained transitions and undo", () => {
    const base = setup(),
      b = base.clips[1].id,
      c = base.clips[2].id;
    const first = setClipTransition(base, b, "dissolve", 500);
    expect(first.clips.map((c) => c.start)).toEqual([0, 4500, 9500, 8000]);
    const both = setClipTransition(first, c, "wipeleft", 500);
    expect(both.clips[2].start).toBe(9000);
    expect(endTime(both)).toBe(14000);
    const history = edit({ past: [], present: base, future: [] }, both);
    expect(undo(history).present).toEqual(base);
    expect(redo(undo(history)).present).toEqual(both);
    expect(setClipTransition(both, b, "cut").clips[1].start).toBe(5000);
  });
  it("saves and restores every effect through the existing transform", () => {
    const t = setup();
    t.clips = t.clips.slice(0, 2);
    const next = setClipTransition(t, t.clips[1].id, "zoomin", 750);
    Object.assign(next.clips[1], {
      filterPreset: "warm",
      effectPreset: "vhs",
      audioFadeIn: 300,
      audioFadeOut: 500,
    });
    const saved = toApi(next);
    const restored = fromApi({
      name: saved.name,
      aspect_ratio: saved.aspectRatio,
      resolution: saved.resolution,
      clips: saved.clips.map((c) => ({
        source_asset_id: c.sourceAssetId,
        track_kind: c.trackKind,
        timeline_start_ms: c.timelineStartMs,
        source_in_ms: c.sourceInMs,
        source_out_ms: c.sourceOutMs,
        volume: c.volume,
        muted: c.muted,
        transform: c.transform,
      })),
    });
    expect(restored).toEqual(next);
  });
  it("rejects unlisted style-effect values before save", () => {
    const value = setup();
    Object.assign(value.clips[0], { effectPreset: "movie=/etc/passwd" });
    expect(() => toApi(value)).toThrow("timeline_invalid");
  });
  it("rejects connecting overlay clips with different blend modes", () => {
    const first = { ...makeClip(source, "overlay", 5000), blendMode: "screen" as const };
    const second = { ...makeClip(source, "overlay", 5000, 5000), blendMode: "multiply" as const };
    expect(() => setClipTransition({ ...emptyTimeline(), clips: [first, second] }, second.id, "dissolve", 500)).toThrow("timeline_blend_mode_invalid");
  });
  it("rejects gaps, short sped-up footage and the first clip", () => {
    const t = setup();
    expect(() => setClipTransition(t, t.clips[0].id, "dissolve")).toThrow();
    t.clips[1].start += 100;
    expect(() => setClipTransition(t, t.clips[1].id, "dissolve")).toThrow();
    t.clips[1].start = 5000;
    t.clips[1].out = 1000;
    t.clips[1].speed = 4;
    expect(() => setClipTransition(t, t.clips[1].id, "dissolve")).toThrow();
  });
});
