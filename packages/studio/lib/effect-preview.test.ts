import { describe, expect, it } from "vitest";
import { effectPreview, previewEffectStyles } from "./effect-preview";

describe("style effect previews", () => {
  it("keeps normal preview unchanged", () => {
    expect(effectPreview("normal")).toEqual({ filter: "none", className: "" });
  });

  it.each(["glitch", "vhs", "oldfilm", "grain", "bloom", "neon"] as const)(
    "provides a bounded approximation for %s",
    (preset) => {
      expect(effectPreview(preset)).toEqual(previewEffectStyles[preset]);
      expect(effectPreview(preset).className).toBe(`vw-preview-effect-${preset}`);
      expect(effectPreview(preset).filter).toBe("var(--vw-effect-preview)");
    },
  );

  it("falls back to normal instead of accepting arbitrary CSS", () => {
    expect(effectPreview("url(javascript:alert(1))")).toEqual(previewEffectStyles.normal);
  });
});
