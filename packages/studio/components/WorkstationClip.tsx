"use client";

import { useRef, useState, type DragEvent, type PointerEvent } from "react";
import { AudioLines, Type, ArrowRightLeft, Plus } from "lucide-react";
import type { Asset } from "@/lib/api";
import {
  duration,
  emptyTimeline,
  trimClip,
  type Clip,
} from "@/lib/video-timeline";
import { isCrossTransition } from "@flowbar/gen-contracts";
import { MediaThumbnail, mediaName } from "./WorkstationPanels";

export function WorkstationClip({
  clip,
  asset,
  selected,
  zoom,
  en,
  framesUrl,
  waveformUrl,
  onSelect,
  onDragStart,
  onTrim,
  onTrimStart,
  canAddTransition,
  onTransition,
}: {
  clip: Clip;
  asset?: Asset;
  selected: boolean;
  zoom: number;
  en: boolean;
  framesUrl?: string;
  waveformUrl?: string;
  onSelect: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onTrim: (edge: "in" | "out", delta: number) => void;
  onTrimStart: () => void;
  canAddTransition?: boolean;
  onTransition?: () => void;
}) {
  const gesture = useRef<{ edge: "in" | "out"; x: number } | null>(null);
  const [delta, setDelta] = useState(0);
  const audio = ["voice", "music", "sfx"].includes(clip.track);
  const caption = clip.track === "caption";
  const limit =
    caption || asset?.kind === "image"
      ? 7200000
      : asset?.duration_ms || clip.out;
  const draft = gesture.current
    ? trimClip(
        { ...emptyTimeline(), clips: [clip] },
        clip.id,
        gesture.current.edge,
        delta,
        limit,
      ).clips[0]
    : clip;
  const title = caption ? clip.text : mediaName(asset, en);
  const thumbnail = caption
    ? undefined
    : audio
      ? waveformUrl
      : framesUrl ||
        asset?.thumbnailUrl ||
        (asset?.kind === "image" ? asset.signedUrl : undefined);
  const start = (event: PointerEvent<HTMLSpanElement>, edge: "in" | "out") => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { edge, x: event.clientX };
    setDelta(0);
    onTrimStart();
  };
  return (
    <div
      className={`vw-clip${selected ? " selected" : ""}${audio ? " is-audio" : ""}${caption ? " is-caption" : ""}`}
      draggable={!gesture.current}
      onDragStart={onDragStart}
      style={{
        left: (draft.start / 1000) * zoom,
        width: Math.max(18, (duration(draft) / 1000) * zoom),
      }}
    >
      <button
        className="vw-clip-select"
        aria-pressed={selected}
        aria-label={title}
        title={`${title} · ${(duration(draft) / 1000).toFixed(1)} s`}
        onClick={onSelect}
      >
        <span
          className="vw-clip-visual"
          style={
            thumbnail ? { backgroundImage: `url("${thumbnail}")` } : undefined
          }
        >
          {!audio && !caption && !thumbnail && asset && (
            <MediaThumbnail asset={asset} />
          )}
        </span>
        <span className="vw-clip-name">
          {audio ? <AudioLines /> : caption ? <Type /> : null}
          {title}
        </span>
        <span className="vw-clip-length">
          {(duration(draft) / 1000).toFixed(1)} s
        </span>
      </button>
      {(isCrossTransition(clip.transition) || canAddTransition) && (
        <button
          className="vw-transition-badge"
          aria-label={isCrossTransition(clip.transition)
            ? (en ? "Edit boundary transition" : "编辑边界转场")
            : (en ? "Add boundary transition" : "添加边界转场")}
          onClick={onTransition ?? onSelect}
          title={isCrossTransition(clip.transition) ? `${clip.transition} · ${(clip.transitionDuration ?? 500) / 1000}s` : (en ? "Add transition" : "添加转场")}
        >
          {isCrossTransition(clip.transition) ? <ArrowRightLeft /> : <Plus />}
        </button>
      )}
      {(["in", "out"] as const).map((edge) => (
        <span
          key={edge}
          className={`vw-trim-handle vw-trim-${edge}`}
          role="slider"
          tabIndex={selected ? 0 : -1}
          aria-label={`${en ? (edge === "in" ? "Trim start" : "Trim end") : edge === "in" ? "裁剪起点" : "裁剪终点"} · ${title}`}
          aria-valuemin={0}
          aria-valuemax={limit / 1000}
          aria-valuenow={draft[edge] / 1000}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => start(event, edge)}
          onPointerMove={(event) => {
            if (gesture.current)
              setDelta(((event.clientX - gesture.current.x) / zoom) * 1000);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            const active = gesture.current;
            gesture.current = null;
            setDelta(0);
            if (active && event.clientX !== active.x)
              onTrim(edge, ((event.clientX - active.x) / zoom) * 1000);
          }}
          onPointerCancel={() => {
            gesture.current = null;
            setDelta(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
              onTrim(
                edge,
                (event.key === "ArrowLeft" ? -1 : 1) *
                  (event.shiftKey ? 1000 : 100),
              );
            }
          }}
        />
      ))}
    </div>
  );
}
