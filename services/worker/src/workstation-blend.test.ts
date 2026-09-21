import { describe, expect, it } from "vitest";
import { blendOverlayGraph } from "./workstation-blend.js";

describe("overlay blend graph", () => {
  it("keeps the normal default on the existing overlay graph", () => {
    expect(
      blendOverlayGraph({
        base: "base0",
        foreground: "v1",
        output: "base1",
        start: 0.5,
        end: 2.5,
        width: 320,
        height: 180,
      }),
    ).toEqual([
      "[base0][v1]overlay=x=0:y=0:eof_action=pass:repeatlast=0:enable='between(t,0.5,2.5)'[base1]",
    ]);
  });

  it.each(["screen", "multiply", "overlay", "softlight"] as const)(
    "builds the bounded %s recipe with base as A and foreground as B",
    (mode) => {
      const graph = blendOverlayGraph({
        base: "base0",
        foreground: "transition4",
        output: "base1",
        start: 0.5,
        end: 2.5,
        width: 320,
        height: 180,
        mode,
      }).join(";");

      expect(graph).toContain(
        "[base0]fps=30,settb=AVTB,format=gbrp,split=3[blend_base0_a][blend_base0_mask][blend_base0_out]",
      );
      expect(graph).toContain(
        "[transition4]fps=30,settb=AVTB,format=rgba,scale=320:180:flags=bicubic,setsar=1,format=gbrap,split=2[blend_base0_fg_alpha][blend_base0_fg_color]",
      );
      expect(graph).toContain("[blend_base0_fg_alpha]alphaextract[blend_base0_alpha]");
      expect(graph).toContain(
        `[blend_base0_a][blend_base0_fg_rgb]blend=all_mode=${mode}:all_opacity=1[blend_base0_mode_rgb]`,
      );
      expect(graph).toContain(
        "[blend_base0_mask][blend_base0_mode_rgb][blend_base0_alpha]maskedmerge[blend_base0_merged]",
      );
      expect(graph).toContain(
        "[blend_base0_out][blend_base0_merged]overlay=x=0:y=0:eof_action=pass:repeatlast=0:enable='between(t,0.5,2.5)'[base1]",
      );
      expect(graph.indexOf("[transition4]")).toBeLessThan(
        graph.indexOf(`blend=all_mode=${mode}`),
      );
    },
  );

  it("rejects labels and numeric values that could inject a filter expression", () => {
    const valid = {
      base: "base0",
      foreground: "v1",
      output: "base1",
      start: 0.5,
      end: 2.5,
      width: 320,
      height: 180,
    };
    expect(() => blendOverlayGraph({ ...valid, mode: "addition" as "screen" })).toThrow(
      "workstation_blend_mode_invalid",
    );
    expect(() => blendOverlayGraph({ ...valid, foreground: "v1];movie=/etc/passwd[bad" })).toThrow(
      "workstation_blend_label_invalid",
    );
    expect(() => blendOverlayGraph({ ...valid, start: Number.NaN })).toThrow(
      "workstation_blend_interval_invalid",
    );
  });
});
