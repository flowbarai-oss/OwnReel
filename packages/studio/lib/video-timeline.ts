import {
  TRANSITIONS,
  FILTER_PRESETS,
  EFFECT_PRESETS,
  BLEND_MODES,
  validTransitions,
  validBlendModes,
  isCrossTransition,
  type Transition,
  type FilterPreset,
  type EffectPreset,
  type BlendMode,
  type CaptionAppearance,
  captionAppearanceSchema,
} from "@flowbar/gen-contracts";
export { TRANSITIONS, FILTER_PRESETS, EFFECT_PRESETS, BLEND_MODES, isCrossTransition };
/** Non-destructive editor model. Source positions are milliseconds before speed. */
export type Track = "video" | "overlay" | "caption" | "voice" | "music" | "sfx";
export const TRACKS: Track[] = [
  "video",
  "overlay",
  "caption",
  "voice",
  "music",
  "sfx",
];
export interface Clip extends CaptionAppearance {
  captionStyle?: "clean" | "bold" | "commerce";
  trackId?: string;
  sourceKind?: "asset" | "upload";
  id: string;
  sourceAssetId: string;
  track: Track;
  start: number;
  in: number;
  out: number;
  speed: number;
  volume: number;
  muted: boolean;
  fit: "contain" | "cover";
  text: string;
  scale: number;
  x: number;
  y: number;
  captionX?: number;
  captionY?: number;
  transition: Transition;
  transitionDuration?: number;
  filterPreset?: FilterPreset;
  effectPreset?: EffectPreset;
  blendMode?: BlendMode;
  audioFadeIn?: number;
  audioFadeOut?: number;
  canvasBackground?: "black" | "blur";
  canvasBackgroundDarkening?: number;
}
export interface Timeline {
  tracks?: EditorTrack[];
  name: string;
  aspectRatio: string;
  resolution: string;
  clips: Clip[];
}
export interface EditorTrack {
  id: string;
  kind: Track;
  name?: string;
}
export const timelineTracks = (value: Timeline): EditorTrack[] =>
  value.tracks ?? TRACKS.map((kind) => ({ id: kind, kind }));
export const clipTrackId = (clip: Clip) => clip.trackId ?? clip.track;
export function renderClips(value: Timeline): Clip[] {
  const tracks = timelineTracks(value);
  return [...value.clips].sort(
    (a, b) =>
      tracks.findIndex((t) => t.id === clipTrackId(a)) -
      tracks.findIndex((t) => t.id === clipTrackId(b)),
  );
}
export const emptyTimeline = (): Timeline => ({
  name: "Main edit",
  aspectRatio: "16:9",
  resolution: "1080p",
  clips: [],
});
export function setCanvasRatio(value: Timeline, aspectRatio: string): Timeline {
  return {
    ...value,
    aspectRatio,
    clips:
      value.aspectRatio === "16:9" && aspectRatio !== "16:9"
        ? value.clips.map((clip) =>
            clip.track === "video" && clip.canvasBackground === undefined
              ? {
                  ...clip,
                  fit: "contain" as const,
                  canvasBackground: "blur" as const,
                  canvasBackgroundDarkening: 0.25,
                }
              : clip,
          )
        : value.clips,
  };
}
export const duration = (clip: Clip) => (clip.out - clip.in) / clip.speed;
export const endTime = (value: Timeline) =>
  Math.max(0, ...value.clips.map((c) => c.start + duration(c)));
export function makeClip(
  sourceAssetId: string,
  track: Track,
  sourceDuration = 5000,
  start = 0,
  canvasRatio = "16:9",
): Clip {
  return {
    id: crypto.randomUUID(),
    sourceAssetId,
    track,
    start,
    in: 0,
    out: sourceDuration || 5000,
    speed: 1,
    volume: 1,
    muted: false,
    fit: "contain",
    text: "",
    scale: 1,
    x: 50,
    y: 50,
    transition: "cut",
    ...(track === "video" && canvasRatio !== "16:9"
      ? { canvasBackground: "blur" as const, canvasBackgroundDarkening: 0.25 }
      : {}),
  };
}
export function validateTimeline(value: Timeline): void {
  const tracks = timelineTracks(value);
  if (!validTransitions(value.clips))
    throw new Error("timeline_transition_invalid");
  if (!validBlendModes(value.clips))
    throw new Error("timeline_blend_mode_invalid");
  if (
    !["21:9", "16:9", "4:3", "1:1", "4:5", "3:4", "9:16"].includes(
      value.aspectRatio,
    ) ||
    !["720p", "1080p", "1440p", "2160p"].includes(value.resolution) ||
    tracks.length > 32 ||
    new Set(tracks.map((t) => t.id)).size !== tracks.length ||
    tracks.some(
      (t) =>
        !t.id ||
        t.id.length > 80 ||
        !TRACKS.includes(t.kind) ||
        (t.name !== undefined && (!t.name.trim() || t.name.length > 60)),
    )
  )
    throw new Error("timeline_invalid");
  if (!value.name.trim() || value.name.length > 120 || value.clips.length > 200)
    throw new Error("timeline_invalid");
  for (const c of value.clips) {
    if (
      !(["cut", "fade", ...TRANSITIONS] as string[]).includes(c.transition) ||
      !FILTER_PRESETS.includes(c.filterPreset ?? "normal") ||
      !EFFECT_PRESETS.includes(c.effectPreset ?? "normal") ||
      !captionAppearanceSchema.safeParse(c).success ||
      (c.captionStyle !== undefined && !["clean", "bold", "commerce"].includes(c.captionStyle)) ||
      (c.track !== "caption" && ["captionStyle", ...Object.keys(captionAppearanceSchema.shape)].some(key => c[key as keyof Clip] !== undefined)) ||
      ((c.captionX !== undefined || c.captionY !== undefined) &&
        (c.track !== "caption" || [c.captionX, c.captionY].some(p =>
          typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 100))) ||
      !BLEND_MODES.includes(c.blendMode ?? "normal") ||
      (c.track !== "overlay" && c.blendMode !== undefined) ||
      (c.transitionDuration !== undefined &&
        (!Number.isFinite(c.transitionDuration) ||
          c.transitionDuration < 300 ||
          c.transitionDuration > 1000)) ||
      [c.audioFadeIn ?? 0, c.audioFadeOut ?? 0].some(
        (v) => !Number.isFinite(v) || v < 0 || v > 1000,
      ) ||
      !["black", "blur"].includes(c.canvasBackground ?? "black") ||
      !Number.isFinite(c.canvasBackgroundDarkening ?? 0.25) ||
      (c.canvasBackgroundDarkening ?? 0.25) < 0 ||
      (c.canvasBackgroundDarkening ?? 0.25) > 0.6 ||
      (c.track !== "video" &&
        (c.canvasBackground !== undefined ||
          c.canvasBackgroundDarkening !== undefined)) ||
      !TRACKS.includes(c.track) ||
      !tracks.some((t) => t.id === clipTrackId(c) && t.kind === c.track) ||
      !c.sourceAssetId ||
      ![c.start, c.in, c.out, c.speed, c.volume, c.scale, c.x, c.y].every(
        Number.isFinite,
      ) ||
      c.start < 0 ||
      c.in < 0 ||
      c.out <= c.in ||
      c.speed < 0.25 ||
      c.speed > 4 ||
      c.volume < 0 ||
      c.volume > 2 ||
      c.scale < (c.track === "overlay" ? 0.1 : 1) ||
      c.scale > 3 ||
      c.x < 0 ||
      c.x > 100 ||
      c.y < 0 ||
      c.y > 100
    )
      throw new Error("timeline_invalid");
  }
}
export function splitClip(
  value: Timeline,
  id: string,
  playhead: number,
): Timeline {
  const c = value.clips.find((c) => c.id === id);
  if (!c || playhead <= c.start || playhead >= c.start + duration(c))
    return value;
  const cut = c.in + (playhead - c.start) * c.speed;
  return {
    ...value,
    clips: value.clips.flatMap((item) =>
      item.id !== id
        ? [item]
        : [
            { ...c, out: cut },
            {
              ...c,
              id: crypto.randomUUID(),
              start: playhead,
              in: cut,
              transition: "cut",
            },
          ],
    ),
  };
}

/** Trim in timeline time while preserving the remaining clip's source alignment. */
export function trimClip(
  value: Timeline,
  id: string,
  edge: "in" | "out",
  deltaMs: number,
  sourceLimit: number,
): Timeline {
  const clip = value.clips.find((item) => item.id === id);
  if (!clip || !Number.isFinite(deltaMs) || !Number.isFinite(sourceLimit))
    return value;
  const minimum = Math.min(40 * clip.speed, clip.out - clip.in);
  if (sourceLimit < clip.in + minimum) return value;
  let updated: Clip;
  if (edge === "in") {
    const lower = Math.max(0, clip.in - clip.start * clip.speed);
    const sourceIn = Math.max(
      lower,
      Math.min(clip.out - minimum, clip.in + deltaMs * clip.speed),
    );
    updated = {
      ...clip,
      in: sourceIn,
      start: clip.start + (sourceIn - clip.in) / clip.speed,
    };
  } else {
    updated = {
      ...clip,
      out: Math.max(
        clip.in + minimum,
        Math.min(sourceLimit, clip.out + deltaMs * clip.speed),
      ),
    };
  }
  return {
    ...value,
    clips: value.clips.map((item) => (item.id === id ? updated : item)),
  };
}
export function snapTime(
  time: number,
  value: Timeline,
  exclude: string,
  playhead: number,
  threshold: number,
): number {
  const points = [
    0,
    playhead,
    ...value.clips
      .filter((c) => c.id !== exclude)
      .flatMap((c) => [c.start, c.start + duration(c)]),
  ];
  const closest = points.reduce(
    (best, n) => (Math.abs(n - time) < Math.abs(best - time) ? n : best),
    time + threshold + 1,
  );
  return Math.max(0, Math.abs(closest - time) <= threshold ? closest : time);
}
export interface History {
  past: Timeline[];
  present: Timeline;
  future: Timeline[];
}
export function edit(history: History, next: Timeline): History {
  validateTimeline(next);
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
  return {
    past: [...history.past.slice(-49), history.present],
    present: next,
    future: [],
  };
}
export function previewEdit(history: History, next: Timeline): History {
  validateTimeline(next);
  return { ...history, present: next, future: [] };
}
export function commitPreviewEdit(history: History, original: Timeline): History {
  if (JSON.stringify(history.present) === JSON.stringify(original)) return history;
  return {
    past: [...history.past.slice(-49), original],
    present: history.present,
    future: [],
  };
}
export function undo(h: History): History {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo(h: History): History {
  return h.future.length
    ? {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
export function toApi(value: Timeline) {
  validateTimeline(value);
  return {
    name: value.name,
    aspectRatio: value.aspectRatio,
    resolution: value.resolution,
    ...(value.tracks ? { tracks: value.tracks } : {}),
    clips: value.clips.map((c) => ({
      sourceAssetId: c.sourceKind === "upload" ? undefined : c.sourceAssetId,
      sourceUploadId: c.sourceKind === "upload" ? c.sourceAssetId : undefined,
      trackKind: ["voice", "music", "sfx"].includes(c.track)
        ? "audio"
        : c.track,
      timelineStartMs: c.start,
      sourceInMs: c.in,
      sourceOutMs: c.out,
      volume: c.volume,
      muted: c.muted,
      transform: {
        editorId: c.id,
        editorTrack: c.track,
        ...(c.trackId ? { editorTrackId: c.trackId } : {}),
        speed: c.speed,
        fit: c.fit,
        text: c.text,
        scale: c.scale,
        x: c.x,
        y: c.y,
        ...(c.captionX !== undefined ? { captionX: c.captionX, captionY: c.captionY } : {}),
        ...captionAppearanceSchema.parse(c),
        ...(c.captionStyle ? { captionStyle: c.captionStyle } : {}),
        transition: c.transition,
        ...(c.transitionDuration !== undefined
          ? { transitionDuration: c.transitionDuration }
          : {}),
        ...(c.filterPreset ? { filterPreset: c.filterPreset } : {}),
        ...(c.effectPreset ? { effectPreset: c.effectPreset } : {}),
        ...(c.blendMode ? { blendMode: c.blendMode } : {}),
        ...(c.audioFadeIn !== undefined ? { audioFadeIn: c.audioFadeIn } : {}),
        ...(c.audioFadeOut !== undefined
          ? { audioFadeOut: c.audioFadeOut }
          : {}),
        ...(c.canvasBackground ? { canvasBackground: c.canvasBackground } : {}),
        ...(c.canvasBackgroundDarkening !== undefined
          ? { canvasBackgroundDarkening: c.canvasBackgroundDarkening }
          : {}),
      },
    })),
  };
}
export function fromApi(value: {
  tracks?: EditorTrack[] | null;
  name: string;
  aspect_ratio: string;
  resolution: string;
  clips: Array<Record<string, unknown>>;
}): Timeline {
  const result: Timeline = {
    ...(value.tracks ? { tracks: value.tracks } : {}),
    name: value.name,
    aspectRatio: value.aspect_ratio,
    resolution: value.resolution,
    clips: value.clips.map((raw) => {
      const t = (raw.transform || {}) as Record<string, unknown>;
      const track = TRACKS.includes(t.editorTrack as Track)
        ? (t.editorTrack as Track)
        : raw.track_kind === "audio"
          ? "voice"
          : (raw.track_kind as Track);
      return {
        ...makeClip(
          String(raw.source_asset_id),
          track,
          Number(raw.source_out_ms || raw.duration_ms || 5000),
          Number(raw.timeline_start_ms),
        ),
        ...(raw.source_upload_id
          ? {
              sourceKind: "upload" as const,
              sourceAssetId: String(raw.source_upload_id),
            }
          : {}),
        id: String(t.editorId || raw.id || crypto.randomUUID()),
        ...(typeof t.editorTrackId === "string"
          ? { trackId: t.editorTrackId }
          : {}),
        in: Number(raw.source_in_ms),
        volume: Number(raw.volume),
        muted: raw.muted === true,
        speed: Number(t.speed ?? 1),
        fit: t.fit === "cover" ? "cover" : "contain",
        text: String(t.text || ""),
        scale: Number(t.scale ?? 1),
        x: Number(t.x ?? 50),
        y: Number(t.y ?? 50),
        ...(t.captionX !== undefined || t.captionY !== undefined
          ? { captionX: t.captionX as number, captionY: t.captionY as number } : {}),
        ...captionAppearanceSchema.parse(t),
        ...(t.captionStyle !== undefined ? { captionStyle: t.captionStyle as Clip["captionStyle"] } : {}),
        transition: (["fade", ...TRANSITIONS] as unknown[]).includes(
          t.transition,
        )
          ? (t.transition as Transition)
          : "cut",
        ...(t.transitionDuration !== undefined
          ? { transitionDuration: Number(t.transitionDuration) }
          : {}),
        ...(t.filterPreset !== undefined
          ? { filterPreset: t.filterPreset as FilterPreset }
          : {}),
        ...(t.effectPreset !== undefined
          ? { effectPreset: t.effectPreset as EffectPreset }
          : {}),
        ...(t.blendMode !== undefined
          ? { blendMode: t.blendMode as BlendMode }
          : {}),
        ...(t.audioFadeIn !== undefined
          ? { audioFadeIn: Number(t.audioFadeIn) }
          : {}),
        ...(t.audioFadeOut !== undefined
          ? { audioFadeOut: Number(t.audioFadeOut) }
          : {}),
        ...(t.canvasBackground === "black" || t.canvasBackground === "blur"
          ? { canvasBackground: t.canvasBackground }
          : {}),
        ...(t.canvasBackgroundDarkening !== undefined
          ? { canvasBackgroundDarkening: Number(t.canvasBackgroundDarkening) }
          : {}),
      };
    }),
  };
  validateTimeline(result);
  return result;
}
