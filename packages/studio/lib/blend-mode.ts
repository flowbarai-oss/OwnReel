import { BLEND_MODES, transitionGroups, type BlendMode } from "@flowbar/gen-contracts";
import { validateTimeline, type Clip, type Timeline } from "./video-timeline";

type BlendClip = Clip & { blendMode?: BlendMode };

export function setOverlayBlendMode(
  timeline: Timeline,
  clipId: string,
  mode: BlendMode,
): Timeline {
  if (!(BLEND_MODES as readonly string[]).includes(mode))
    throw new Error("blend_mode_invalid");
  const selected = timeline.clips.find((clip) => clip.id === clipId);
  if (!selected || selected.track !== "overlay")
    throw new Error("blend_mode_overlay_only");
  const connected = transitionGroups(timeline.clips).find((group) =>
    group.some((clip) => clip.id === clipId),
  );
  const ids = new Set((connected ?? [selected]).map((clip) => clip.id));
  const result = {
    ...timeline,
    clips: timeline.clips.map((clip): BlendClip =>
      ids.has(clip.id) ? { ...clip, blendMode: mode } : clip,
    ),
  };
  validateTimeline(result);
  return result;
}
