"use client";

import { Check, Sparkles } from "lucide-react";
import { STYLE_EFFECT_PRESETS } from "@/lib/effect-preview";

const labels: Record<(typeof STYLE_EFFECT_PRESETS)[number], [string, string]> = {
  normal: ["无特效", "No effect"],
  glitch: ["故障色差", "Glitch"],
  vhs: ["录像带", "VHS"],
  oldfilm: ["老电影", "Old film"],
  grain: ["胶片颗粒", "Film grain"],
  bloom: ["柔光", "Bloom"],
  neon: ["霓虹", "Neon"],
};

export function WorkstationStyleEffects({
  en,
  activePreset,
  disabled,
  onSelect,
}: {
  en: boolean;
  activePreset: string;
  disabled: boolean;
  onSelect: (preset: string) => void;
}) {
  return <section className="vw-effect-library" aria-label={en ? "Style effects" : "风格特效"}>
    <h3>{en ? "Style effects" : "风格特效"}</h3>
    <p className="vw-help">{disabled
      ? (en ? "Select a video or overlay clip on the timeline first." : "请先在时间线选中视频或叠加素材片段。")
      : (en ? "Apply an export effect independently from color grading." : "独立于调色，为当前片段应用导出特效。")}</p>
    <div className="vw-effect-options">
      {STYLE_EFFECT_PRESETS.map((preset) => {
        const active = !disabled && activePreset === preset;
        return <button
          key={preset}
          type="button"
          disabled={disabled}
          aria-pressed={active}
          onClick={() => onSelect(preset)}
        >
          <Sparkles aria-hidden="true" />
          <span>{labels[preset][en ? 1 : 0]}</span>
          {active && <Check aria-hidden="true" />}
        </button>;
      })}
    </div>
    <p className="vw-help">{en
      ? "Preview is approximate; export is definitive."
      : "预览为近似效果，最终以导出为准。"}</p>
  </section>;
}
