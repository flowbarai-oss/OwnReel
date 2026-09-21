/** Shared, bounded editing instructions. Never accept raw FFmpeg expressions. */
export const TRANSITIONS = [
  "crossfade",
  "dissolve",
  "wipeleft",
  "wiperight",
  "slideleft",
  "slideup",
  "zoomin",
] as const;
export const FILTER_PRESETS = [
  "normal",
  "warm",
  "cool",
  "cinematic",
  "bw",
  "vivid",
] as const;
export const BLEND_MODES = ["normal", "screen", "multiply", "overlay", "softlight"] as const;
export const EFFECT_PRESETS = [
  "normal",
  "glitch",
  "vhs",
  "oldfilm",
  "grain",
  "bloom",
  "neon",
] as const;
export type Transition = "cut" | "fade" | (typeof TRANSITIONS)[number];
export type FilterPreset = (typeof FILTER_PRESETS)[number];
export type BlendMode = (typeof BLEND_MODES)[number];
export type EffectPreset = (typeof EFFECT_PRESETS)[number];
export type EffectClip = {
  id: string;
  track: string;
  trackId?: string;
  start: number;
  in: number;
  out: number;
  speed: number;
  transition: string;
  transitionDuration?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  blendMode?: string;
};
export const clipLength = (c: EffectClip) => (c.out - c.in) / c.speed;
export const isCrossTransition = (type: string) =>
  (TRANSITIONS as readonly string[]).includes(type);
export const lane = (c: EffectClip) => c.trackId ?? c.track;
export const visualTrack = (track: string) => track === "video" || track === "overlay";
export function transitionGroups<T extends EffectClip>(clips: T[]): T[][] {
  const groups: T[][] = [];
  const lanes = [
    ...new Set(clips.filter((c) => visualTrack(c.track)).map(lane)),
  ];
  for (const id of lanes) {
    let group: T[] = [];
    for (const clip of clips
      .filter((c) => visualTrack(c.track) && lane(c) === id)
      .sort((a, b) => a.start - b.start)) {
      if (!isCrossTransition(clip.transition)) {
        if (group.length) groups.push(group);
        group = [];
      }
      group.push(clip);
    }
    if (group.length) groups.push(group);
  }
  return groups;
}
export function validTransitions(clips: EffectClip[]): boolean {
  if (clips.some((c) => isCrossTransition(c.transition) && !visualTrack(c.track)))
    return false;
  return transitionGroups(clips).every((group) =>
    group.every((c, i) => {
      if (!isCrossTransition(c.transition)) return true;
      const previous = group[i - 1],
        d = c.transitionDuration ?? 500;
      if (
        !previous ||
        previous.track !== c.track ||
        d < 300 ||
        d > 1000 ||
        d > clipLength(c) / 2 ||
        d > clipLength(previous) / 2
      )
        return false;
      return Math.abs(previous.start + clipLength(previous) - d - c.start) < 1;
    }),
  );
}
export function validBlendModes(clips: EffectClip[]): boolean {
  if (clips.some((clip) =>
    clip.blendMode !== undefined &&
    (clip.track !== "overlay" || !(BLEND_MODES as readonly string[]).includes(clip.blendMode))))
    return false;
  return transitionGroups(clips).every((group) => {
    if (!group.every((clip) => clip.track === "overlay")) return true;
    return new Set(group.map((clip) => clip.blendMode ?? "normal")).size === 1;
  });
}
export function audioEnvelope(c: EffectClip, clips: EffectClip[]) {
  const next = clips.find(
    (n) =>
      lane(n) === lane(c) &&
      isCrossTransition(n.transition) &&
      Math.abs(
        c.start + clipLength(c) - (n.transitionDuration ?? 500) - n.start,
      ) < 1,
  );
  return {
    fadeIn: Math.min(
      clipLength(c) / 2,
      Math.max(
        c.audioFadeIn ?? 0,
        isCrossTransition(c.transition) ? (c.transitionDuration ?? 500) : 0,
      ),
    ),
    fadeOut: Math.min(
      clipLength(c) / 2,
      Math.max(
        c.audioFadeOut ?? 0,
        next ? (next.transitionDuration ?? 500) : 0,
      ),
    ),
  };
}
