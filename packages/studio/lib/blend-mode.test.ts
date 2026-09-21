import { describe, expect, it } from "vitest";
import { edit, emptyTimeline, makeClip, undo } from "./video-timeline";
import { setOverlayBlendMode } from "./blend-mode";

const overlay = (id: string, start: number, transition = "cut") => ({
  ...makeClip(id, "overlay", 2000, start),
  id,
  transition: transition as "cut" | "dissolve",
  transitionDuration: transition === "cut" ? undefined : 500,
});

describe("setOverlayBlendMode", () => {
  it("synchronizes every clip in the selected connected overlay transition group", () => {
    const first = overlay("first", 0);
    const second = overlay("second", 1500, "dissolve");
    const third = overlay("third", 3000, "dissolve");
    const separate = overlay("separate", 6000);
    const result = setOverlayBlendMode(
      { ...emptyTimeline(), clips: [first, second, third, separate] },
      second.id,
      "screen",
    );
    expect(result.clips.map((clip) => [clip.id, (clip as typeof clip & { blendMode?: string }).blendMode])).toEqual([
      ["first", "screen"],
      ["second", "screen"],
      ["third", "screen"],
      ["separate", undefined],
    ]);
  });

  it("updates a standalone overlay clip", () => {
    const clip = overlay("standalone", 0);
    const result = setOverlayBlendMode({ ...emptyTimeline(), clips: [clip] }, clip.id, "multiply");
    expect(result.clips[0]).toMatchObject({ blendMode: "multiply" });
  });

  it("rejects non-overlay targets and values outside the whitelist", () => {
    const video = makeClip("video", "video");
    expect(() => setOverlayBlendMode({ ...emptyTimeline(), clips: [video] }, video.id, "screen")).toThrow("blend_mode_overlay_only");
    const clip = overlay("overlay", 0);
    expect(() => setOverlayBlendMode({ ...emptyTimeline(), clips: [clip] }, clip.id, "addition" as "screen")).toThrow("blend_mode_invalid");
  });
  it("stores a synchronized group change as one undo step", () => {
    const first = overlay("first", 0);
    const second = overlay("second", 1500, "dissolve");
    const timeline = { ...emptyTimeline(), clips: [first, second] };
    const history = edit({ past: [], present: timeline, future: [] }, setOverlayBlendMode(timeline, second.id, "overlay"));
    expect(history.past).toHaveLength(1);
    expect(undo(history).present).toEqual(timeline);
  });
});
