import { CAPTION_FONTS, captionAppearance, type CaptionAppearance } from "@flowbar/gen-contracts";

export const subtitleText = (text: string) => Array.from(text)
  .filter(character => { const code = character.charCodeAt(0); return code !== 127 && (code >= 32 || code === 9 || code === 10 || code === 13); }).join("")
  .replace(/<[^>]{0,256}>/g, "")
  .replace(/\\/g, "＼").replace(/\{/g, "｛").replace(/\}/g, "｝");
const assColor = (hex: string) => `&H00${hex.slice(5,7)}${hex.slice(3,5)}${hex.slice(1,3)}`;
export function captionForceStyle(value: CaptionAppearance & { captionStyle?: string }, width = 720, height = 720) {
  const a = captionAppearance(value);
  // Convert the shared 720px-short-edge size into libass SRT's 288px reference height.
  const ratio = 288 / 720 * Math.min(width,height) / height;
  return `FontName=${CAPTION_FONTS[a.captionFont]},FontSize=${a.captionSize * ratio},PrimaryColour=${assColor(a.captionColor)},Bold=${a.captionBold ? -1 : 0},OutlineColour=${a.captionBackground ? "&H9A000000" : "&H00000000"},BorderStyle=${a.captionBackground ? 3 : 1},Outline=${a.captionOutline * ratio},Shadow=0,Alignment=${{left:1,center:2,right:3}[a.captionAlign]},MarginV=42`;
}
const time = (ms: number) => {
  const cs = Math.round(ms / 10);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2,"0")}:${String(Math.floor(cs / 100) % 60).padStart(2,"0")}.${String(cs % 100).padStart(2,"0")}`;
};
export function captionAss(clip: CaptionAppearance & { captionStyle?: string; captionX?: number; captionY?: number; text: string; start: number; in: number; out: number; speed: number }, width: number, height: number) {
  const a = captionAppearance(clip), ratio = Math.min(width,height) / 720;
  const x = width * (clip.captionX ?? 50) / 100;
  const y = height * (clip.captionY ?? 82) / 100;
  const anchor = (clip.captionX === undefined ? 7 : 4) + {left:0,center:1,right:2}[a.captionAlign];
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${CAPTION_FONTS[a.captionFont]},${a.captionSize * ratio},${assColor(a.captionColor)},&H000000FF,${a.captionBackground ? "&H9A000000" : "&H00000000"},&H9A000000,${a.captionBold ? -1 : 0},0,0,0,100,100,0,0,${a.captionBackground ? 3 : 1},${a.captionOutline * ratio},0,${{left:1,center:2,right:3}[a.captionAlign]},${Math.round(width*.07)},${Math.round(width*.07)},0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,${time(clip.start)},${time(clip.start+(clip.out-clip.in)/clip.speed)},Default,,0,0,0,,{\\an${anchor}\\pos(${x},${y})}${subtitleText(clip.text).replace(/\r\n?|\n/g,"\\N")}\n`;
}
