import { EFFECT_PRESETS, type EffectPreset } from "@flowbar/gen-contracts";
export { EFFECT_PRESETS };
export type { EffectPreset };

/** Fixed FFmpeg recipes. User supplied filter expressions never enter this module. */

export const presetEffects: Record<EffectPreset, string> = {
  normal: "",
  glitch: "format=gbrp,rgbashift=rh=6:gh=0:bh=-6:edge=wrap,format=yuv444p",
  vhs: "eq=contrast=1.08:saturation=0.82:gamma=0.96,noise=alls=12:allf=t+u:all_seed=8128,drawgrid=w=iw:h=4:t=1:c=black@0.12",
  oldfilm: "colorchannelmixer=rr=1.06:rg=0.04:rb=-0.03:gr=0.02:gg=0.93:gb=0.02:br=-0.03:bg=0.05:bb=0.78,eq=contrast=0.92:brightness=0.025:saturation=0.72,vignette=PI/5,noise=alls=7:allf=t+u:all_seed=1903",
  grain: "noise=alls=16:allf=t+u:all_seed=4242",
  bloom: "gblur=sigma=12:steps=2,blend=all_mode=screen:all_opacity=0.32",
  neon: "edgedetect=mode=colormix:high=0.18,eq=saturation=2.2:contrast=1.35,gblur=sigma=1.2,blend=all_mode=screen:all_opacity=0.62",
};

export type EffectGraph = { graph: string; output: string };

const labelPattern = /^[A-Za-z0-9_]+$/;

function assertGraphInput(input: string, output: string, graphId: number) {
  if (!labelPattern.test(input) || !labelPattern.test(output))
    throw new Error("workstation_effect_invalid_label");
  if (!Number.isSafeInteger(graphId) || graphId < 0)
    throw new Error("workstation_effect_invalid_graph_id");
}

function effectBody(input: string, output: string, preset: Exclude<EffectPreset, "normal">, prefix: string) {
  if (preset === "bloom") {
    return `[${input}]split=2[${prefix}_bloom_sharp][${prefix}_bloom_blur];[${prefix}_bloom_blur]gblur=sigma=12:steps=2[${prefix}_bloom_glow];[${prefix}_bloom_sharp][${prefix}_bloom_glow]blend=all_mode=screen:all_opacity=0.32[${output}]`;
  }
  if (preset === "neon") {
    return `[${input}]split=2[${prefix}_neon_base][${prefix}_neon_edge];[${prefix}_neon_edge]edgedetect=mode=colormix:high=0.18,eq=saturation=2.2:contrast=1.35,colorchannelmixer=rr=0.35:rg=0.15:rb=0.10:gr=0.05:gg=0.65:gb=0.25:br=0.25:bg=0.30:bb=1.20,gblur=sigma=1.2[${prefix}_neon_glow];[${prefix}_neon_base]eq=saturation=1.35:contrast=1.12[${prefix}_neon_graded];[${prefix}_neon_graded][${prefix}_neon_glow]blend=all_mode=screen:all_opacity=0.62[${output}]`;
  }
  return `[${input}]${presetEffects[preset]}[${output}]`;
}

/** Builds an effect stage after color grading and before composition. */
export function buildEffectGraph(
  input: string,
  output: string,
  preset: EffectPreset,
  graphId: number,
  preserveAlpha: boolean,
): EffectGraph {
  assertGraphInput(input, output, graphId);
  if (preset === "normal") return { graph: "", output: input };

  const prefix = `effect_${graphId}`;
  if (!preserveAlpha)
    return { graph: effectBody(input, output, preset, prefix), output };

  const color = `${prefix}_color`;
  const alphaSource = `${prefix}_alpha_source`;
  const alpha = `${prefix}_alpha`;
  const rgb = `${prefix}_rgb`;
  const effected = `${prefix}_effected`;
  return {
    graph: `[${input}]format=rgba,split=2[${color}][${alphaSource}];[${alphaSource}]alphaextract[${alpha}];[${color}]format=gbrp[${rgb}];${effectBody(rgb, effected, preset, prefix)};[${effected}]format=gbrp[${prefix}_effected_rgb];[${prefix}_effected_rgb][${alpha}]alphamerge,format=yuva444p[${output}]`,
    output,
  };
}
