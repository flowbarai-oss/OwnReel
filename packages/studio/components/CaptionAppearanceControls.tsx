"use client";
import "./caption-appearance.css";
import { captionAppearance, type CaptionAppearance } from "@flowbar/gen-contracts";

type Settings = CaptionAppearance & { captionStyle?: "clean" | "bold" | "commerce" };
export function CaptionAppearanceControls({ value, onChange, en, showPreset = true }: { value: Settings; onChange: (patch: Settings) => void; en: boolean; showPreset?: boolean }) {
  const a = captionAppearance(value);
  const say = (zh: string, english: string) => en ? english : zh;
  return <div className="caption-appearance-controls">
    {showPreset && <label>{say("样式预设", "Style preset")}<select aria-label={say("样式预设", "Style preset")} value={value.captionStyle ?? "clean"} onChange={e => onChange({captionStyle:e.target.value as Settings["captionStyle"],captionSize:undefined,captionColor:undefined,captionOutline:undefined,captionBold:undefined,captionBackground:undefined})}>
      <option value="clean">{say("简洁底栏", "Clean")}</option><option value="bold">{say("醒目描边", "Bold outline")}</option><option value="commerce">{say("电商强调", "Commerce")}</option>
    </select></label>}
    <label>{say("字体", "Font")}<select aria-label={say("字体", "Font")} value={a.captionFont} onChange={e => onChange({captionFont:e.target.value as Settings["captionFont"]})}>
      <option value="sans">{say("思源黑体", "Noto Sans CJK")}</option><option value="serif">{say("思源宋体", "Noto Serif CJK")}</option><option value="mono">{say("等宽黑体", "Noto Sans Mono CJK")}</option>
    </select></label>
    <label>{say("字号", "Font size")}<input aria-label={say("字号", "Font size")} type="number" min={16} max={96} step={1} value={a.captionSize} onChange={e => {const n=Number(e.target.value); if(Number.isInteger(n)&&n>=16&&n<=96)onChange({captionSize:n});}} /></label>
    <label>{say("文字颜色", "Text color")}<input aria-label={say("文字颜色", "Text color")} type="color" value={a.captionColor} onChange={e=>onChange({captionColor:e.target.value})}/></label>
    <label>{say("描边宽度", "Outline width")}<input aria-label={say("描边宽度", "Outline width")} type="number" min={0} max={6} step={0.5} value={a.captionOutline} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0&&n<=6)onChange({captionOutline:n});}}/></label>
    <label>{say("对齐", "Alignment")}<select aria-label={say("对齐", "Alignment")} value={a.captionAlign} onChange={e=>onChange({captionAlign:e.target.value as Settings["captionAlign"]})}>
      <option value="left">{say("左对齐", "Left")}</option><option value="center">{say("居中", "Center")}</option><option value="right">{say("右对齐", "Right")}</option>
    </select></label>
    <label><input type="checkbox" checked={a.captionBold} onChange={e=>onChange({captionBold:e.target.checked})}/>{say("粗体", "Bold")}</label>
    <label><input type="checkbox" checked={a.captionBackground} onChange={e=>onChange({captionBackground:e.target.checked})}/>{say("半透明底色", "Background box")}</label>
  </div>;
}
