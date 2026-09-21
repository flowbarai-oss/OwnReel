export interface BlurredCanvasInput {
  input: number;
  output: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceIn: number;
  sourceOut: number;
  speed: number;
  scale: number;
  x: number;
  y: number;
  darkening: number;
  filters: string;
  fade: string;
}

/** Builds a fixed, trusted FFmpeg graph; no value is an FFmpeg expression from a request. */
export function blurredCanvasGraph(input: BlurredCanvasInput): string[] {
  const ratio = Math.min(
    input.width / input.sourceWidth,
    input.height / input.sourceHeight,
  );
  const foregroundWidth = Math.max(
    2,
    Math.round((input.sourceWidth * ratio * input.scale) / 2) * 2,
  );
  const foregroundHeight = Math.max(
    2,
    Math.round((input.sourceHeight * ratio * input.scale) / 2) * 2,
  );
  const x = ((input.width - foregroundWidth) * input.x) / 100;
  const y = ((input.height - foregroundHeight) * input.y) / 100;
  const stem = input.output;
  return [
    `[${input.input}:v]trim=start=${input.sourceIn / 1000}:end=${input.sourceOut / 1000},setpts=(PTS-STARTPTS)/${input.speed},split=2[${stem}bgsrc][${stem}fgsrc]`,
    `[${stem}bgsrc]scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height},boxblur=luma_radius=24:luma_power=1${input.darkening ? `,eq=brightness=-${input.darkening}` : ""},setsar=1,fps=30,settb=AVTB,format=yuv444p[${stem}bg]`,
    `[${stem}fgsrc]scale=${foregroundWidth}:${foregroundHeight},setsar=1,fps=30,settb=AVTB,format=yuv444p${input.filters}${input.fade}[${stem}fg]`,
    `[${stem}bg][${stem}fg]overlay=${input.x === 50 ? "(W-w)/2" : x}:${input.y === 50 ? "(H-h)/2" : y}:format=auto[${stem}]`,
  ];
}
