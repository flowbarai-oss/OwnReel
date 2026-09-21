import type { Clip, Track } from "./video-timeline";

export type MediaCapability = { kind: "video" | "image" | "audio"; hasAudio?: boolean };
export function clipCapabilities(clip: Clip, asset?: MediaCapability) {
  const caption = clip.track === "caption";
  const visual = !caption && ["video", "overlay"].includes(clip.track) && asset?.kind !== "audio";
  const audio = !caption && (asset?.kind === "audio" || (asset?.kind === "video" && asset.hasAudio !== false));
  return { caption, visual, audio, audioUnknown: audio && asset?.kind === "video" && asset.hasAudio === undefined };
}

export function canPlaceClip(clip: Clip, track: Track, asset?: MediaCapability) {
  if (clip.track === "caption" || track === "caption") return clip.track === track;
  if (!asset) return clip.track === track;
  if (["video", "overlay"].includes(track)) return asset.kind !== "audio";
  return asset.kind === "audio" || (asset.kind === "video" && asset.hasAudio !== false);
}

/** Normalize only when the user moves a clip; merely reading old projects is non-destructive. */
export function moveClipToTrack(clip: Clip, track: Track, trackId: string, asset?: MediaCapability): Clip {
  if (!canPlaceClip(clip, track, asset)) throw new Error("timeline_track_source_incompatible");
  const next = { ...clip, track, trackId };
  if (track !== "overlay") { delete next.blendMode; next.scale = Math.max(1, next.scale); }
  if (track !== "video") { delete next.canvasBackground; delete next.canvasBackgroundDarkening; }
  if (!["video", "overlay", "caption"].includes(track)) {
    next.scale = 1; next.x = 50; next.y = 50; next.fit = "contain"; next.transition = "cut";
    delete next.transitionDuration; delete next.filterPreset; delete next.effectPreset;
  }
  return next;
}
