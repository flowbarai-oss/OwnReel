"use client";

import { ArrowRightLeft, SlidersHorizontal, Check } from "lucide-react";
import { TRANSITIONS, FILTER_PRESETS, type Clip } from "@/lib/video-timeline";

export function EffectDuration({ value, onChange, en }: {
  value: number; onChange: (value: number) => void; en: boolean;
}) {
  return <label className="vw-effect-duration">
    {en ? "Shared fade duration" : "统一过渡时长"}
    <select aria-label={en ? "Shared fade duration" : "统一过渡时长"}
      value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[300, 500, 750, 1000].map(ms => <option key={ms} value={ms}>{ms / 1000} s</option>)}
    </select>
  </label>;
}

export function WorkstationEffectLibrary({ mode, clip, en, duration, onDuration, onApply }: {
  mode: "transitions" | "filters"; clip?: Clip; en: boolean;
  duration: number; onDuration: (value: number) => void;
  onApply: (patch: Partial<Clip>) => void;
}) {
  const visual = !!clip && ["video", "overlay"].includes(clip.track);
  const transitions = mode === "transitions";
  const names: Record<string, [string, string]> = {
    cut: ["无转场", "No transition"], crossfade: ["交叉淡化", "Crossfade"],
    dissolve: ["溶解", "Dissolve"], wipeleft: ["向左擦除", "Wipe left"],
    wiperight: ["向右擦除", "Wipe right"], slideleft: ["向左滑动", "Slide left"],
    slideup: ["向上滑动", "Slide up"], zoomin: ["缩放进入", "Zoom in"],
    normal: ["原色", "Original"], warm: ["暖调", "Warm"], cool: ["冷调", "Cool"],
    cinematic: ["电影", "Cinematic"], bw: ["黑白", "Black & white"], vivid: ["鲜明", "Vivid"],
  };
  const Icon = transitions ? ArrowRightLeft : SlidersHorizontal;
  return <section className="vw-effect-library">
    <p className="vw-help">{visual
      ? (en ? "Apply to the selected clip. Undo remains available." : "应用到当前选中片段，可撤销修改。")
      : (en ? "Select a video or overlay clip on the timeline first." : "请先在时间线选中视频或叠加素材片段。")}</p>
    {transitions && <EffectDuration value={duration} onChange={onDuration} en={en} />}
    <div className="vw-effect-options">
      {(transitions ? ["cut", ...TRANSITIONS] : FILTER_PRESETS).map(key => {
        const active = visual && (transitions ? clip.transition : clip.filterPreset ?? "normal") === key;
        return <button key={key} disabled={!visual} aria-pressed={active}
          onClick={() => onApply(transitions
            ? { transition: key as Clip["transition"], transitionDuration: duration }
            : { filterPreset: key as Clip["filterPreset"] })}>
          <Icon aria-hidden="true" /><span>{names[key][en ? 1 : 0]}</span>
          {active && <Check aria-hidden="true" />}
        </button>;
      })}
    </div>
    <p className="vw-help">{transitions
      ? (en ? "Connect adjacent clips on the same video or overlay lane. Other lanes keep their timing." : "连接同一视频或叠加轨上的相邻片段；其他轨道保持原时间。")
      : (en ? "Original adds no color filter." : "原色不增加调色处理。")}</p>
    <p className="vw-help">{en ? "Preview is approximate; export is definitive." : "预览为近似效果，最终以导出为准。"}</p>
  </section>;
}
