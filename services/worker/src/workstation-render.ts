import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  workstationSchema,
  transitionGroups,
  type WorkstationManifest,
} from "@flowbar/gen-contracts";
import { presetFilters, audioFades } from "./workstation-effects.js";
import { blurredCanvasGraph } from "./workstation-canvas.js";
import { buildEffectGraph } from "./workstation-effect-presets.js";
import { blendOverlayGraph } from "./workstation-blend.js";
import type { MediaFile } from "./media.js";
import { captionAss } from "./caption-render.js";

const escaped = (path: string) =>
  path.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
export function workstationGraph(
  manifest: WorkstationManifest,
  sources: Array<{ id: string; media: MediaFile }>,
  directory: string,
) {
  const t = workstationSchema.parse(manifest),
    [rw, rh] = t.aspectRatio.split(":").map(Number);
  const edge = t.resolution === "720p" ? 720 : 1080,
    width = rw < rh ? edge : Math.round((edge * rw) / rh / 2) * 2,
    height = rw < rh ? Math.round((edge * rh) / rw / 2) * 2 : edge;
  const seconds = Math.max(
    ...t.clips.map((c) => (c.start + (c.out - c.in) / c.speed) / 1000),
  );
  const graph = [`color=c=black:s=${width}x${height}:r=30:d=${seconds}[base0]`];
  const audio: string[] = [],
    texts: Array<{ path: string; text: string }> = [];
  const applyEffect = (
    input: string,
    output: string,
    preset: WorkstationManifest["clips"][number]["effectPreset"],
    graphId: number,
    preserveAlpha: boolean,
  ) => {
    const effect = buildEffectGraph(
      input,
      output,
      preset ?? "normal",
      graphId,
      preserveAlpha,
    );
    if (effect.graph) graph.push(effect.graph);
    return effect.output;
  };
  let base = 0;
  const ordered = [
    ...t.clips.filter((c) => c.track === "video"),
    ...t.clips.filter((c) => c.track === "overlay"),
    ...t.clips.filter((c) => !["video", "overlay"].includes(c.track)),
  ];
  const groups = transitionGroups(t.clips).filter((g) => g.length > 1);
  const grouped = new Set(groups.flat().map((c) => c.id));
  for (const [n, c] of ordered.entries()) {
    const index = sources.findIndex((s) => s.id === c.sourceAssetId),
      source = sources[index]?.media;
    if (!source) throw new Error("workstation_source_missing");
    const start = c.start / 1000,
      length = (c.out - c.in) / c.speed / 1000;
    if (
      c.track !== "caption" &&
      !source.contentType.startsWith("image/") &&
      source.durationMs &&
      c.out > source.durationMs + 50
    )
      throw new Error("workstation_trim_out_of_bounds");
    if (c.track === "caption") {
      const path = join(directory, `caption-${n}.ass`);
      texts.push({ path, text: captionAss(c, width, height) });
      graph.push(
        `[base${base}]ass=filename='${escaped(path)}'[base${base + 1}]`,
      );
      base++;
      continue;
    }
    if (c.track === "video" || c.track === "overlay") {
      if (
        !source.width ||
        !source.height ||
        source.contentType.startsWith("audio/")
      )
        throw new Error("workstation_visual_source_required");
      const group = groups.find((g) => g[0].id === c.id);
      if (group) {
        let previous = "";
        for (const [k, item] of group.entries()) {
          const si = sources.findIndex((s) => s.id === item.sourceAssetId),
            sm = sources[si]?.media;
          if (!sm?.width || !sm.height || sm.contentType.startsWith("audio/"))
            throw new Error("workstation_visual_source_required");
          if (
            !sm.contentType.startsWith("image/") &&
            sm.durationMs &&
            item.out > sm.durationMs + 50
          )
            throw new Error("workstation_trim_out_of_bounds");
          const blurred = item.track === "video" && item.canvasBackground === "blur";
          const ratio =
            blurred || item.fit !== "cover"
              ? Math.min(width / sm.width, height / sm.height)
              :
                Math.max(width / sm.width, height / sm.height);
          const sw = Math.max(
              2,
              Math.round((sm.width * ratio * item.scale) / 2) * 2,
            ),
            sh = Math.max(
              2,
              Math.round((sm.height * ratio * item.scale) / 2) * 2,
            );
          // Each xfade input has identical frame rate, timebase, pixel format and canvas.
          const cropW = Math.min(sw, width),
            cropH = Math.min(sh, height);
          const label = `transition${n}_${k}`;
          // Overlay chains need alpha across the entire canvas; opaque padding
          // would otherwise cover lower tracks while a contained clip transitions.
          const overlay = item.track === "overlay";
          const format = overlay ? "yuva444p" : "yuv444p";
          const effectEnabled = (item.effectPreset ?? "normal") !== "normal";
          const sourceLabel = effectEnabled ? `${label}source` : label;
          const legacyFade =
            item.transition === "fade"
              ? `,fade=t=in:st=0:d=${Math.min(0.5, (item.out - item.in) / item.speed / 2000)}${overlay ? ":alpha=1" : ""}`
              : "";
          if (blurred)
            graph.push(...blurredCanvasGraph({
              input: si, output: sourceLabel, width, height,
              sourceWidth: sm.width, sourceHeight: sm.height,
              sourceIn: item.in, sourceOut: item.out, speed: item.speed,
              scale: item.scale, x: item.x, y: item.y,
              darkening: item.canvasBackgroundDarkening ?? 0.25,
              filters: presetFilters[item.filterPreset ?? "normal"], fade: legacyFade,
            }));
          else
            graph.push(
              `[${si}:v]trim=start=${item.in / 1000}:end=${item.out / 1000},setpts=(PTS-STARTPTS)/${item.speed},scale=${sw}:${sh},crop=${cropW}:${cropH}:${((sw - cropW) * item.x) / 100}:${((sh - cropH) * item.y) / 100}${overlay ? ",format=yuva444p" : ""},pad=${width}:${height}:${((width - cropW) * item.x) / 100}:${((height - cropH) * item.y) / 100}:${overlay ? "black@0" : "black"},setsar=1,fps=30,settb=AVTB,format=${format}${presetFilters[item.filterPreset ?? "normal"]}${legacyFade}[${sourceLabel}]`,
            );
          applyEffect(sourceLabel, label, item.effectPreset, n * 32 + k, overlay);
          if (!k) previous = label;
          else {
            const output = `mix${n}_${k}`,
              kind = item.transition === "crossfade" ? "fade" : item.transition;
            graph.push(
              `[${previous}][${label}]xfade=transition=${kind}:duration=${(item.transitionDuration ?? 500) / 1000}:offset=${(item.start - group[0].start) / 1000}[${output}]`,
            );
            previous = output;
          }
        }
        const last = group[group.length - 1],
          finish = (last.start + (last.out - last.in) / last.speed) / 1000;
        graph.push(`[${previous}]setpts=PTS+${start}/TB[chain${n}]`);
        if (c.track === "overlay" && (c.blendMode ?? "normal") !== "normal")
          graph.push(...blendOverlayGraph({ base: `base${base}`, foreground: `chain${n}`, output: `base${base + 1}`, start, end: finish, width, height, mode: c.blendMode }));
        else
          graph.push(
            `[base${base}][chain${n}]overlay=eof_action=pass:repeatlast=0:enable='between(t,${start},${finish})'[base${base + 1}]`,
          );
        base++;
      }
      if (!grouped.has(c.id)) {
        const blurred = c.track === "video" && c.canvasBackground === "blur";
        const ratio =
          blurred || c.fit !== "cover"
            ? Math.min(width / source.width, height / source.height)
            : Math.max(width / source.width, height / source.height);
        const sw = Math.max(
            2,
            Math.round((source.width * ratio * c.scale) / 2) * 2,
          ),
          sh = Math.max(
            2,
            Math.round((source.height * ratio * c.scale) / 2) * 2,
          );
        const fade =
          c.transition === "fade"
            ? `,format=rgba,fade=t=in:st=0:d=${Math.min(0.5, length / 2)}:alpha=1`
            : "";
        const effectEnabled = (c.effectPreset ?? "normal") !== "normal";
        const blendedOverlay = c.track === "overlay" && (c.blendMode ?? "normal") !== "normal";
        if (blurred) {
          const canvasSource = effectEnabled ? `canvas${n}source` : `canvas${n}`;
          graph.push(...blurredCanvasGraph({
            input: index, output: canvasSource, width, height,
            sourceWidth: source.width, sourceHeight: source.height,
            sourceIn: c.in, sourceOut: c.out, speed: c.speed,
            scale: c.scale, x: c.x, y: c.y,
            darkening: c.canvasBackgroundDarkening ?? 0.25,
            filters: presetFilters[c.filterPreset ?? "normal"], fade,
          }));
          const canvas = applyEffect(canvasSource, `canvas${n}`, c.effectPreset, n, false);
          graph.push(`[${canvas}]setpts=PTS+${start}/TB[v${n}]`);
        } else
          if (effectEnabled) {
            graph.push(
              `[${index}:v]trim=start=${c.in / 1000}:end=${c.out / 1000},setpts=(PTS-STARTPTS)/${c.speed},scale=${sw}:${sh},setsar=1${presetFilters[c.filterPreset ?? "normal"]}${fade}[v${n}source]`,
            );
            const effected = applyEffect(`v${n}source`, `v${n}effect`, c.effectPreset, n, c.track === "overlay");
            graph.push(`[${effected}]setpts=PTS+${start}/TB[v${n}${blendedOverlay ? "blendSource" : ""}]`);
          } else
            graph.push(
              `[${index}:v]trim=start=${c.in / 1000}:end=${c.out / 1000},setpts=(PTS-STARTPTS)/${c.speed},scale=${sw}:${sh},setsar=1${presetFilters[c.filterPreset ?? "normal"]}${fade},setpts=PTS+${start}/TB[v${n}${blendedOverlay ? "blendSource" : ""}]`,
            );
        if (blendedOverlay) {
          const cropW = Math.min(sw, width), cropH = Math.min(sh, height);
          graph.push(`[v${n}blendSource]format=rgba,crop=${cropW}:${cropH}:${((sw - cropW) * c.x) / 100}:${((sh - cropH) * c.y) / 100},pad=${width}:${height}:${((width - cropW) * c.x) / 100}:${((height - cropH) * c.y) / 100}:black@0,fps=30,settb=AVTB[v${n}]`);
          graph.push(...blendOverlayGraph({ base: `base${base}`, foreground: `v${n}`, output: `base${base + 1}`, start, end: start + length, width, height, mode: c.blendMode }));
        } else
          graph.push(
            `[base${base}][v${n}]overlay=x=${blurred ? 0 : ((width - sw) * c.x) / 100}:y=${blurred ? 0 : ((height - sh) * c.y) / 100}:eof_action=pass:repeatlast=0:enable='between(t,${start},${start + length})'[base${base + 1}]`,
          );
        base++;
      }
    }
    if (source.hasAudio && !c.muted && c.volume > 0) {
      // Split tempo into supported 0.5–2 factors without altering pitch.
      let speed = c.speed;
      const tempos: number[] = [];
      while (speed < 0.5) {
        tempos.push(0.5);
        speed /= 0.5;
      }
      while (speed > 2) {
        tempos.push(2);
        speed /= 2;
      }
      tempos.push(speed);
      graph.push(
        `[${index}:a]atrim=start=${c.in / 1000}:end=${c.out / 1000},asetpts=PTS-STARTPTS,${tempos.map((s) => `atempo=${s}`).join(",")},volume=${c.volume}${audioFades(c, t.clips)},adelay=${Math.round(c.start)}:all=1[a${n}]`,
      );
      audio.push(`[a${n}]`);
    } else if (["voice", "music", "sfx"].includes(c.track) && !source.hasAudio)
      throw new Error("workstation_audio_source_required");
  }
  graph.push(`[base${base}]format=yuv420p[vout]`);
  if (audio.length)
    graph.push(
      `${audio.join("")}amix=inputs=${audio.length}:normalize=0:duration=longest,alimiter=limit=0.95[aout]`,
    );
  return {
    graph: graph.join(";"),
    texts,
    seconds,
    audio: audio.length > 0,
    width,
    height,
  };
}
export async function workstationArguments(
  manifest: unknown,
  sources: Array<{ id: string; media: MediaFile }>,
  directory: string,
) {
  const plan = workstationGraph(
    workstationSchema.parse(manifest),
    sources,
    directory,
  );
  for (const text of plan.texts)
    await writeFile(text.path, text.text, { encoding: "utf8", mode: 0o600 });
  const filter = join(directory, "workstation-filter.txt");
  await writeFile(filter, plan.graph, { encoding: "utf8", mode: 0o600 });
  return [
    ...sources.flatMap((s) => [
      ...(s.media.contentType.startsWith("image/") ? ["-loop", "1"] : []),
      "-i",
      s.media.path,
    ]),
    "-filter_complex_threads",
    "1",
    "-filter_complex_script",
    filter,
    "-map",
    "[vout]",
    ...(plan.audio ? ["-map", "[aout]"] : []),
    "-t",
    String(plan.seconds),
  ];
}
