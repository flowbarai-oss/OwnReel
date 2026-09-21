import { describe, expect, it } from "vitest";
import { EFFECT_PRESETS, workstationSchema } from "@flowbar/gen-contracts";
import {
  buildEffectGraph,
  presetEffects,
  type EffectPreset,
} from "./workstation-effect-presets.js";

const expectedLinearEffects: Record<Exclude<EffectPreset, "normal" | "bloom" | "neon">, string> = {
  glitch: "format=gbrp,rgbashift=rh=6:gh=0:bh=-6:edge=wrap,format=yuv444p",
  vhs: "eq=contrast=1.08:saturation=0.82:gamma=0.96,noise=alls=12:allf=t+u:all_seed=8128,drawgrid=w=iw:h=4:t=1:c=black@0.12",
  oldfilm: "colorchannelmixer=rr=1.06:rg=0.04:rb=-0.03:gr=0.02:gg=0.93:gb=0.02:br=-0.03:bg=0.05:bb=0.78,eq=contrast=0.92:brightness=0.025:saturation=0.72,vignette=PI/5,noise=alls=7:allf=t+u:all_seed=1903",
  grain: "noise=alls=16:allf=t+u:all_seed=4242",
};

describe("bounded workstation effect presets", () => {
  it("shares the exact contract whitelist and rejects injected presets", () => {
    expect(EFFECT_PRESETS).toEqual(["normal", "glitch", "vhs", "oldfilm", "grain", "bloom", "neon"]);
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      sourceAssetId: "11111111-1111-4111-8111-111111111111",
      track: "video", start: 0, in: 0, out: 1000, speed: 1, volume: 1,
      muted: false, fit: "contain", text: "", scale: 1, x: 50, y: 50,
      transition: "cut",
    };
    expect(workstationSchema.parse({ version: 1, aspectRatio: "16:9", resolution: "720p", clips: [{ ...base, effectPreset: "neon" }] }).clips[0].effectPreset).toBe("neon");
    expect(() => workstationSchema.parse({ version: 1, aspectRatio: "16:9", resolution: "720p", clips: [{ ...base, effectPreset: "movie=/etc/passwd" }] })).toThrow();
  });
  it.each(Object.entries(expectedLinearEffects))("uses the tested %s recipe", (preset, recipe) => {
    expect(presetEffects[preset as keyof typeof expectedLinearEffects]).toBe(recipe);
  });

  it("keeps normal as an exact empty chain", () => {
    expect(presetEffects.normal).toBe("");
    expect(buildEffectGraph("clip_in", "clip_out", "normal", 3, false)).toEqual({
      graph: "",
      output: "clip_in",
    });
  });

  it.each(["glitch", "vhs", "oldfilm", "grain", "bloom", "neon"] as const)(
    "restores the original alpha after %s",
    (preset) => {
      const result = buildEffectGraph("clip_in", "clip_out", preset, 7, true);
      expect(result.output).toBe("clip_out");
      expect(result.graph).toContain("[clip_in]format=rgba,split=2");
      expect(result.graph).toContain("alphaextract");
      expect(result.graph).toContain("alphamerge,format=yuva444p[clip_out]");
    },
  );

  it("uses unique labels for bloom and neon graph branches", () => {
    const bloom = buildEffectGraph("a", "b", "bloom", 4, false).graph;
    const neon = buildEffectGraph("c", "d", "neon", 9, false).graph;
    expect(bloom).toContain("[effect_4_bloom_blur]");
    expect(neon).toContain("[effect_9_neon_edge]");
    expect(`${bloom}${neon}`).not.toMatch(/\[(sharp|blur|glow|base|edge|edgeglow|graded)\]/);
  });

  it("rejects labels and graph ids outside the renderer-owned contract", () => {
    expect(() => buildEffectGraph("clip];movie=/etc/passwd[", "out", "grain", 1, false)).toThrow("workstation_effect_invalid_label");
    expect(() => buildEffectGraph("in", "out", "grain", -1, false)).toThrow("workstation_effect_invalid_graph_id");
  });
});
