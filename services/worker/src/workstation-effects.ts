import {
  audioEnvelope,
  type FilterPreset,
  type WorkstationManifest,
} from "@flowbar/gen-contracts";
export const presetFilters: Record<FilterPreset, string> = {
  normal: "",
  warm: ",colorbalance=rs=0.05:bs=-0.04,eq=saturation=1.06",
  cool: ",colorbalance=rs=-0.04:bs=0.06,eq=saturation=0.96",
  cinematic: ",eq=contrast=1.08:saturation=0.85:brightness=-0.015",
  bw: ",hue=s=0",
  vivid: ",eq=saturation=1.18:contrast=1.04",
};
export function audioFades(
  c: WorkstationManifest["clips"][number],
  clips: WorkstationManifest["clips"],
) {
  const { fadeIn, fadeOut } = audioEnvelope(c, clips),
    length = (c.out - c.in) / c.speed;
  return `${fadeIn ? `,afade=t=in:st=0:d=${fadeIn / 1000}` : ""}${fadeOut ? `,afade=t=out:st=${(length - fadeOut) / 1000}:d=${fadeOut / 1000}` : ""}`;
}
