"use client";

import { useRef, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";

export function WorkstationPlayhead({
  position,
  total,
  zoom,
  en,
  onSeek,
  onPause,
}: {
  position: number;
  total: number;
  zoom: number;
  en: boolean;
  onSeek: (position: number) => void;
  onPause: () => void;
}) {
  const pointer = useRef<number | null>(null);
  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    onSeek(Math.max(0, Math.min(total, Math.round((x / zoom) * 1000))));
  };
  return (
    <div
      className="vw-scrub-strip"
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current !== null) return;
        event.preventDefault();
        onPause();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        seek(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) seek(event);
      }}
      onPointerUp={(event) => {
        if (pointer.current === event.pointerId) {
          seek(event);
          pointer.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        pointer.current = null;
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
      }}
    >
      <span
        className="vw-playhead-grip"
        role="slider"
        tabIndex={0}
        aria-label={en ? "Timeline playhead" : "时间线指针"}
        aria-valuemin={0}
        aria-valuemax={total / 1000}
        aria-valuenow={position / 1000}
        aria-valuetext={`${(position / 1000).toFixed(2)} ${en ? "seconds" : "秒"}`}
        title={en ? "Drag to seek" : "左右拖动定位"}
        style={{ left: (position / 1000) * zoom }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          event.stopPropagation();
          onPause();
          onSeek(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? total
                : Math.max(
                    0,
                    Math.min(
                      total,
                      position +
                        (event.key === "ArrowLeft" ? -1 : 1) *
                          (event.shiftKey ? 1000 : 100),
                    ),
                  ),
          );
        }}
      >
        <GripVertical />
      </span>
    </div>
  );
}
