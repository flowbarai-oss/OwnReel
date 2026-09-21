import { EFFECT_PRESETS, type EffectPreset } from "@flowbar/gen-contracts";
export const STYLE_EFFECT_PRESETS = EFFECT_PRESETS;
export type StyleEffectPreset = EffectPreset;
export type EffectPreview = { filter: string; className: string };

export const previewEffectStyles: Record<StyleEffectPreset, EffectPreview> = {
  normal: { filter: "none", className: "" },
  glitch: { filter: "var(--vw-effect-preview)", className: "vw-preview-effect-glitch" },
  vhs: { filter: "var(--vw-effect-preview)", className: "vw-preview-effect-vhs" },
  oldfilm: { filter: "var(--vw-effect-preview)", className: "vw-preview-effect-oldfilm" },
  grain: { filter: "var(--vw-effect-preview)", className: "vw-preview-effect-grain" },
  bloom: { filter: "var(--vw-effect-preview)", className: "vw-preview-effect-bloom" },
  neon: { filter: "var(--vw-effect-preview)", className: "vw-preview-effect-neon" },
};

export function effectPreview(preset: string): EffectPreview {
  return (STYLE_EFFECT_PRESETS as readonly string[]).includes(preset)
    ? previewEffectStyles[preset as StyleEffectPreset]
    : previewEffectStyles.normal;
}
