import { describe, expect, it } from "vitest";
import {
  trimClip,
  emptyTimeline,
  makeClip,
  duration,
  splitClip,
  snapTime,
  edit,
  undo,
  redo,
  toApi,
  fromApi,
  validateTimeline,
  previewEdit,
  commitPreviewEdit,
  setCanvasRatio,
  type Timeline,
} from "./video-timeline";
describe("video workstation edits", () => {
  it("trims at 2x without slipping source time and bounds extensions", () => {
    const c = { ...makeClip("a", "video", 10000, 2000), in: 2000, speed: 2 };
    const t = { ...emptyTimeline(), clips: [c] };
    const trimmed = trimClip(t, c.id, "in", 500, 10000).clips[0];
    expect([trimmed.start, trimmed.in, trimmed.out]).toEqual([
      2500, 3000, 10000,
    ]);
    expect(trimClip(t, c.id, "in", -10000, 10000).clips[0].start).toBe(1000);
    expect(trimClip(t, c.id, "out", 10000, 12000).clips[0].out).toBe(12000);
    expect(duration(trimClip(t, c.id, "out", -10000, 12000).clips[0])).toBe(40);
  });
  it("splits in source time at 2x without changing total duration", () => {
    const c = {
      ...makeClip("asset", "video", 10000, 2000),
      speed: 2,
      in: 1000,
    };
    const t = { ...emptyTimeline(), clips: [c] };
    const split = splitClip(t, c.id, 4000);
    expect(split.clips.map((c) => [c.start, c.in, c.out])).toEqual([
      [2000, 1000, 5000],
      [4000, 5000, 10000],
    ]);
    expect(split.clips.reduce((s, c) => s + duration(c), 0)).toBe(duration(c));
    expect(splitClip(t, c.id, 2000)).toBe(t);
  });
  it("undoes removal and clears redo after a new edit", () => {
    const t = emptyTimeline(),
      next = { ...t, clips: [makeClip("a", "music")] };
    const h = edit({ past: [], present: t, future: [] }, next);
    expect(redo(undo(h)).present).toEqual(next);
    expect(edit(undo(h), { ...t, name: "new" }).future).toEqual([]);
  });
  it("snaps to edges and playhead but excludes the moved clip", () => {
    const c = makeClip("a", "video");
    const t = { ...emptyTimeline(), clips: [c] };
    expect(snapTime(4970, t, "other", 2000, 100)).toBe(5000);
    expect(snapTime(4970, t, c.id, 2000, 100)).toBe(4970);
  });
  it("roundtrips all six tracks and transforms through the existing API", () => {
    const t = {
      ...emptyTimeline(),
      clips: (
        ["video", "overlay", "caption", "voice", "music", "sfx"] as const
      ).map((track) => ({
        ...makeClip("a", track),
        text: "标题",
        speed: 1.5,
        fit: "cover" as const,
      })),
    };
    const wire = toApi(t);
    expect(
      fromApi({
        name: wire.name,
        aspect_ratio: wire.aspectRatio,
        resolution: wire.resolution,
        clips: wire.clips.map((c) => ({
          source_asset_id: c.sourceAssetId,
          track_kind: c.trackKind,
          timeline_start_ms: c.timelineStartMs,
          source_in_ms: c.sourceInMs,
          source_out_ms: c.sourceOutMs,
          volume: c.volume,
          muted: c.muted,
          transform: c.transform,
        })),
      }),
    ).toEqual(t);
  });
  it("rejects NaN, inverted trims and invalid speed", () => {
    for (const patch of [
      { start: NaN },
      { in: 6000 },
      { speed: 0 },
      { out: Infinity },
    ])
      expect(() =>
        validateTimeline({
          ...emptyTimeline(),
          clips: [{ ...makeClip("a", "video"), ...patch }],
        }),
      ).toThrow();
  });
  it("restores legacy snapshots with distinct editable clip identities", () => {
    const legacy = {
      source_asset_id: "asset",
      track_kind: "video",
      timeline_start_ms: 0,
      source_in_ms: 0,
      source_out_ms: 2000,
      volume: 1,
      muted: false,
    };
    const restored = fromApi({
      name: "Legacy",
      aspect_ratio: "16:9",
      resolution: "1080p",
      clips: [legacy, { ...legacy, timeline_start_ms: 2000 }],
    });
    expect(restored.clips[0].id).not.toBe(restored.clips[1].id);
    expect(restored.clips[0].id).not.toBe("undefined");
  });
  it("retains upload identity when saving and restoring a historical clip", () => {
    const clip = {
      ...makeClip("upload-id", "music", 4000),
      sourceKind: "upload" as const,
    };
    const wire = toApi({ ...emptyTimeline(), clips: [clip] }).clips[0];
    expect(wire.sourceAssetId).toBeUndefined();
    const restored = fromApi({
      name: "Upload",
      aspect_ratio: "16:9",
      resolution: "1080p",
      clips: [
        {
          source_upload_id: wire.sourceUploadId,
          track_kind: wire.trackKind,
          timeline_start_ms: wire.timelineStartMs,
          source_in_ms: wire.sourceInMs,
          source_out_ms: wire.sourceOutMs,
          volume: wire.volume,
          muted: wire.muted,
          transform: wire.transform,
        },
      ],
    });
    expect(restored.clips[0]).toEqual(clip);
  });
  it("roundtrips dragged captions without moving legacy captions", () => {
    const caption = { ...makeClip("asset", "caption", 3000), captionX: 25, captionY: 30, captionFont:"serif" as const,captionColor:"#12AB34",captionSize:60 };
    const wire = toApi({ ...emptyTimeline(), clips: [caption] }).clips[0];
    const restore = (transform: Record<string, unknown>) => fromApi({name:"Caption",aspect_ratio:"16:9",resolution:"1080p",clips:[{
      source_asset_id:"asset",track_kind:"caption",timeline_start_ms:0,source_in_ms:0,source_out_ms:3000,volume:1,muted:false,transform,
    }]}).clips[0];
    expect(restore(wire.transform)).toMatchObject({captionX:25,captionY:30,captionFont:"serif",captionColor:"#12AB34",captionSize:60});
    expect(restore({text:"Old caption"}).captionX).toBeUndefined();
    expect(()=>restore({...wire.transform,captionY:"30"})).toThrow();
  });
  it("roundtrips canvas background settings through clip transform JSON", () => {
    const clip = { ...makeClip("asset", "video"), canvasBackground: "blur" as const, canvasBackgroundDarkening: 0.25 };
    const wire = toApi({ ...emptyTimeline(), aspectRatio: "4:5", clips: [clip] });
    expect(wire.clips[0].transform).toMatchObject({ canvasBackground: "blur", canvasBackgroundDarkening: 0.25 });
    expect(fromApi({ name: wire.name, aspect_ratio: wire.aspectRatio, resolution: wire.resolution, clips: wire.clips.map(c => ({ source_asset_id: c.sourceAssetId, track_kind: c.trackKind, timeline_start_ms: c.timelineStartMs, source_in_ms: c.sourceInMs, source_out_ms: c.sourceOutMs, volume: c.volume, muted: c.muted, transform: c.transform })) }).clips[0]).toMatchObject({ canvasBackground: "blur", canvasBackgroundDarkening: 0.25 });
  });
  it("rejects invalid canvas ratios and background settings before save or quote", () => {
    const base = { ...emptyTimeline(), clips: [makeClip("asset", "video")] };
    for (const value of [
      { ...base, aspectRatio: "5:4" },
      { ...base, clips: [{ ...base.clips[0], canvasBackground: "movie=/etc/passwd" as "blur" }] },
      { ...base, clips: [{ ...base.clips[0], canvasBackgroundDarkening: 0.61 }] },
      { ...base, clips: [{ ...base.clips[0], track: "overlay" as const, canvasBackground: "blur" as const }] },
    ]) expect(() => validateTimeline(value)).toThrow("timeline_invalid");
  });
  it("switches the preview canvas ratio and defaults uncovered video to blur", () => {
    const base = { ...emptyTimeline(), clips: [makeClip("asset", "video"), makeClip("overlay", "overlay")] };
    const portrait = setCanvasRatio(base, "4:5");
    expect(portrait.aspectRatio).toBe("4:5");
    expect(portrait.clips[0]).toMatchObject({ fit: "contain", canvasBackground: "blur", canvasBackgroundDarkening: 0.25 });
    expect(portrait.clips[1].canvasBackground).toBeUndefined();
  });
  it("allows small overlay stickers but keeps video scale at one or larger", () => {
    expect(() => validateTimeline({ ...emptyTimeline(), clips: [{ ...makeClip("sticker", "overlay"), scale: 0.1 }] })).not.toThrow();
    expect(() => validateTimeline({ ...emptyTimeline(), clips: [{ ...makeClip("video", "video"), scale: 0.9 }] })).toThrow("timeline_invalid");
  });
  it("records a preview drag as one undoable history edit", () => {
    const original = { ...emptyTimeline(), clips: [{ ...makeClip("sticker", "overlay"), scale: 0.3 }] };
    let history = { past: [] as Timeline[], present: original, future: [] as Timeline[] };
    history = previewEdit(history, { ...history.present, clips: [{ ...history.present.clips[0], x: 60, y: 40 }] });
    history = previewEdit(history, { ...history.present, clips: [{ ...history.present.clips[0], x: 75, y: 30 }] });
    history = commitPreviewEdit(history, original);
    expect(history.past).toEqual([original]);
    expect(undo(history).present).toEqual(original);
  });
  it("roundtrips overlay blend mode and rejects blend values on other tracks", () => {
    const overlay = { ...makeClip("asset", "overlay"), blendMode: "softlight" as const };
    const wire = toApi({ ...emptyTimeline(), clips: [overlay] });
    expect(wire.clips[0].transform).toMatchObject({ blendMode: "softlight" });
    expect(fromApi({ name: wire.name, aspect_ratio: wire.aspectRatio, resolution: wire.resolution, clips: [{ source_asset_id: "asset", track_kind: "overlay", timeline_start_ms: 0, source_in_ms: 0, source_out_ms: 5000, volume: 1, muted: false, transform: wire.clips[0].transform }] }).clips[0]).toMatchObject({ blendMode: "softlight" });
    expect(() => validateTimeline({ ...emptyTimeline(), clips: [{ ...makeClip("video", "video"), blendMode: "normal" as const }] })).toThrow();
  });
});
