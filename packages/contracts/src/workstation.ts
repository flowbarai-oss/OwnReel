import { z } from "zod";
import { captionAppearanceShape } from "./caption-appearance";
import {
  TRANSITIONS,
  FILTER_PRESETS,
  EFFECT_PRESETS,
  validTransitions,
  validBlendModes,
  BLEND_MODES,
} from "./workstation-effects";
export const workstationClipSchema = z
  .object({
    sourceKind: z.enum(["asset", "upload"]).optional(),
    id: z.string().uuid(),
    sourceAssetId: z.string().uuid(),
    track: z.enum(["video", "overlay", "caption", "voice", "music", "sfx"]),
    start: z.number().finite().min(0).max(300000),
    in: z.number().finite().min(0).max(7200000),
    out: z.number().finite().positive().max(7200000),
    speed: z.number().min(0.25).max(4),
    volume: z.number().min(0).max(2),
    muted: z.boolean(),
    fit: z.enum(["contain", "cover"]),
    text: z.string().max(1000),
    scale: z.number().min(0.1).max(3),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    captionX: z.number().finite().min(0).max(100).optional(),
    captionY: z.number().finite().min(0).max(100).optional(),
    captionStyle: z.enum(["clean", "bold", "commerce"]).optional(),
    ...captionAppearanceShape,
    transition: z.enum(["cut", "fade", ...TRANSITIONS]),
    trackId: z.string().min(1).max(80).optional(),
    transitionDuration: z.number().finite().min(300).max(1000).optional(),
    filterPreset: z.enum(FILTER_PRESETS).optional(),
    effectPreset: z.enum(EFFECT_PRESETS).optional(),
    blendMode: z.enum(BLEND_MODES).optional(),
    audioFadeIn: z.number().finite().min(0).max(1000).optional(),
    audioFadeOut: z.number().finite().min(0).max(1000).optional(),
    canvasBackground: z.enum(["black", "blur"]).optional(),
    canvasBackgroundDarkening: z.number().finite().min(0).max(0.6).optional(),
  })
  .strict()
  .refine(c => c.track === "caption" || ["captionStyle", ...Object.keys(captionAppearanceShape)].every(key => c[key as keyof typeof c] === undefined), "Caption appearance is only valid on captions")
  .refine(
    (c) => (c.captionX === undefined && c.captionY === undefined) ||
      (c.track === "caption" && c.captionX !== undefined && c.captionY !== undefined),
    "Caption position requires both coordinates on a caption clip",
  )
  .refine(
    (c) =>
      c.track === "video" ||
      (c.canvasBackground === undefined &&
        c.canvasBackgroundDarkening === undefined),
    "Canvas background is only valid on video clips",
  )
  .refine(
    (c) => c.track === "overlay" || c.scale >= 1,
    "Only overlay clips may be scaled below their fitted canvas size",
  )
  .refine(
    (c) => c.track === "overlay" || c.blendMode === undefined,
    "Blend mode is only valid on overlay clips",
  )
  .refine(
    (c) => c.out > c.in && c.start + (c.out - c.in) / c.speed <= 300000,
    "Clip duration invalid",
  );
export const workstationSchema = z
  .object({
    version: z.literal(1),
    quality: z.enum(["fast", "balanced", "high"]).optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "4:3", "3:4", "21:9"]),
    resolution: z.enum(["720p", "1080p"]),
    clips: z.array(workstationClipSchema).min(1).max(32),
  })
  .strict()
  .refine(
    (t) => new Set(t.clips.map((c) => c.sourceAssetId)).size <= 8,
    "At most eight source assets",
  )
  .refine((t) => validTransitions(t.clips), "Invalid adjacent video transition")
  .refine((t) => validBlendModes(t.clips), "Connected overlay clips must use one blend mode")
  .refine(
    (t) => new Set(t.clips.map((c) => c.id)).size === t.clips.length,
    "Duplicate clip identifiers",
  );
export type WorkstationManifest = z.infer<typeof workstationSchema>;
export function validateWorkstationReferences(
  manifest: WorkstationManifest | undefined,
  assetIds: string[],
  modality: string,
  uploadIds: string[] = [],
) {
  if (!manifest) return;
  if (
    modality !== "smart-cut" ||
    manifest.clips.some(
      (c) =>
        !(c.sourceKind === "upload" ? uploadIds : assetIds).includes(
          c.sourceAssetId,
        ),
    )
  )
    throw new Error("timeline_invalid");
}
