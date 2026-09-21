import { z } from "zod";

export const CAPTION_FONTS = {
  sans: "Noto Sans CJK SC",
  serif: "Noto Serif CJK SC",
  mono: "Noto Sans Mono CJK SC",
} as const;
export const captionAppearanceShape = {
  captionFont: z.enum(["sans", "serif", "mono"]).optional(),
  captionSize: z.number().finite().int().min(16).max(96).optional(),
  captionColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  captionOutline: z.number().finite().min(0).max(6).optional(),
  captionBold: z.boolean().optional(),
  captionBackground: z.boolean().optional(),
  captionAlign: z.enum(["left", "center", "right"]).optional(),
};
export const captionAppearanceSchema = z.object(captionAppearanceShape);
export type CaptionAppearance = z.infer<typeof captionAppearanceSchema>;
export function captionAppearance(value: CaptionAppearance & { captionStyle?: string }) {
  const parsed = captionAppearanceSchema.parse(value);
  const style = value.captionStyle ?? "clean";
  if (!["clean", "bold", "commerce"].includes(style)) throw new Error("caption_style_invalid");
  return {
    captionFont: parsed.captionFont ?? "sans",
    captionSize: parsed.captionSize ?? (style === "bold" ? 48 : style === "commerce" ? 44 : 40),
    captionColor: parsed.captionColor ?? (style === "commerce" ? "#FFFF00" : "#FFFFFF"),
    captionOutline: parsed.captionOutline ?? (style === "bold" ? 3 : 1),
    captionBold: parsed.captionBold ?? style !== "clean",
    captionBackground: parsed.captionBackground ?? style !== "bold",
    captionAlign: parsed.captionAlign ?? "center",
  };
}
