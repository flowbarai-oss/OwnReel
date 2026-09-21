"use client";
import { useEffect, useRef, useState } from "react";
import { api, type Asset } from "./api";
import type { Clip } from "./video-timeline";
type Preview = {
  id: string;
  state: "queued" | "processing" | "ready" | "failed";
  proxyUrl?: string;
  framesUrl?: string;
  waveformUrl?: string;
  hasAudio?: boolean;
};
export function useWorkstationPreviews(
  clips: Clip[],
  assets: Map<string, Asset>,
) {
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    // Only prepare sources actually placed in the edit, never the whole library.
    for (const clip of clips) {
      if (
        !["video", "audio"].includes(
          assets.get(clip.sourceAssetId)?.kind || "",
        ) ||
        requested.current.has(clip.sourceAssetId)
      )
        continue;
      requested.current.add(clip.sourceAssetId);
      void api<Preview>("/api/v1/media-previews", {
        method: "POST",
        body: JSON.stringify({
          sourceId: clip.sourceAssetId,
          sourceKind: clip.sourceKind || "asset",
        }),
      })
        .then((p) =>
          setPreviews((current) => ({ ...current, [clip.sourceAssetId]: p })),
        )
        .catch(() =>
          setPreviews((current) => ({
            ...current,
            [clip.sourceAssetId]: { id: "", state: "failed" },
          })),
        );
    }
  }, [clips, assets]);
  useEffect(() => {
    const pending = Object.entries(previews).filter(
      ([, p]) => p.state === "queued" || p.state === "processing",
    );
    if (!pending.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void Promise.all(
        pending.map(async ([sourceId, p]) => {
          try {
            return [
              sourceId,
              await api<Preview>(`/api/v1/media-previews/${p.id}`, {
                signal: controller.signal,
              }),
            ] as const;
          } catch {
            return [sourceId, { ...p, state: "failed" as const }] as const;
          }
        }),
      ).then((results) => {
        if (!controller.signal.aborted)
          setPreviews((current) => ({
            ...current,
            ...Object.fromEntries(results),
          }));
      });
    }, 5000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [previews]);
  return previews;
}
