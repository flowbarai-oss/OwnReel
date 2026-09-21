import { clipLength, isCrossTransition, lane } from "@flowbar/gen-contracts";
import { type Clip, type Timeline, validateTimeline } from "./video-timeline";
/** Transitions consume overlap on this lane only. Other lanes keep their explicit timing. */
export function setClipTransition(
  value: Timeline,
  id: string,
  transition: Clip["transition"],
  milliseconds = 500,
): Timeline {
  const c = value.clips.find((c) => c.id === id);
  if (!c) return value;
  const ordered = value.clips
    .filter((n) => lane(n) === lane(c))
    .sort((a, b) => a.start - b.start);
  const previous = ordered[ordered.findIndex((n) => n.id === id) - 1];
  const old = isCrossTransition(c.transition)
    ? (c.transitionDuration ?? 500)
    : 0;
  const overlap = isCrossTransition(transition) ? milliseconds : 0;
  if (
    overlap &&
    (!previous ||
      !["video", "overlay"].includes(c.track) ||
      previous.track !== c.track ||
      Math.abs(previous.start + clipLength(previous) - old - c.start) > 1 ||
      overlap > clipLength(previous) / 2 ||
      overlap > clipLength(c) / 2)
  )
    throw new Error("transition_needs_adjacent_clips");
  const delta = old - overlap;
  const result = {
    ...value,
    clips: value.clips.map((n) =>
      lane(n) === lane(c) && n.start >= c.start
        ? {
            ...n,
            start: n.start + delta,
            ...(n.id === id
              ? { transition, transitionDuration: milliseconds }
              : {}),
          }
        : n,
    ),
  };
  validateTimeline(result);
  return result;
}
export const previewFilters = {
  normal: "none",
  warm: "sepia(0.12) saturate(1.06)",
  cool: "sepia(0.1) hue-rotate(170deg) saturate(0.96)",
  cinematic: "contrast(1.08) saturate(0.85) brightness(0.985)",
  bw: "grayscale(1)",
  vivid: "saturate(1.18) contrast(1.04)",
};
