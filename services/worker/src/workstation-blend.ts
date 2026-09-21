export const WORKSTATION_BLEND_MODES = [
  "normal",
  "screen",
  "multiply",
  "overlay",
  "softlight",
] as const;

export type WorkstationBlendMode = (typeof WORKSTATION_BLEND_MODES)[number];

type BlendOverlayGraphOptions = {
  base: string;
  foreground: string;
  output: string;
  start: number;
  end: number;
  width: number;
  height: number;
  mode?: WorkstationBlendMode;
};

const safeLabel = /^[A-Za-z0-9_]+$/;

export function blendOverlayGraph({
  base,
  foreground,
  output,
  start,
  end,
  width,
  height,
  mode = "normal",
}: BlendOverlayGraphOptions): string[] {
  if (![base, foreground, output].every((label) => safeLabel.test(label)))
    throw new Error("workstation_blend_label_invalid");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  )
    throw new Error("workstation_blend_interval_invalid");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 2 ||
    height < 2 ||
    width % 2 !== 0 ||
    height % 2 !== 0
  )
    throw new Error("workstation_blend_size_invalid");
  if (!(WORKSTATION_BLEND_MODES as readonly string[]).includes(mode))
    throw new Error("workstation_blend_mode_invalid");

  const overlay = `[${base}][${foreground}]overlay=x=0:y=0:eof_action=pass:repeatlast=0:enable='between(t,${start},${end})'[${output}]`;
  if (mode === "normal") return [overlay];

  const prefix = `blend_${base}`;
  return [
    `[${base}]fps=30,settb=AVTB,format=gbrp,split=3[${prefix}_a][${prefix}_mask][${prefix}_out]`,
    `[${foreground}]fps=30,settb=AVTB,format=rgba,scale=${width}:${height}:flags=bicubic,setsar=1,format=gbrap,split=2[${prefix}_fg_alpha][${prefix}_fg_color]`,
    `[${prefix}_fg_alpha]alphaextract[${prefix}_alpha]`,
    `[${prefix}_fg_color]format=gbrp[${prefix}_fg_rgb]`,
    `[${prefix}_a][${prefix}_fg_rgb]blend=all_mode=${mode}:all_opacity=1[${prefix}_mode_rgb]`,
    `[${prefix}_mask][${prefix}_mode_rgb][${prefix}_alpha]maskedmerge[${prefix}_merged]`,
    `[${prefix}_out][${prefix}_merged]overlay=x=0:y=0:eof_action=pass:repeatlast=0:enable='between(t,${start},${end})'[${output}]`,
  ];
}
