"use client";

import { useRef, useEffect, useState, type PointerEvent } from "react";
import { CAPTION_FONTS, captionAppearance } from "@flowbar/gen-contracts";
import type { Clip } from "@/lib/video-timeline";

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function WorkstationCaption({ clip, selected, label, onStart, onPosition, onEnd }: {
  clip: Clip; selected: boolean; label: string;
  onStart: () => void; onPosition: (x: number, y: number) => void; onEnd: () => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1);
  const appearance = captionAppearance(clip);
  useEffect(() => {
    const canvas = elementRef.current?.parentElement;
    if (!canvas) return;
    const measure = () => setRatio(Math.min(canvas.clientWidth, canvas.clientHeight) / 720);
    measure(); const observer = new ResizeObserver(measure); observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ id: number; clientX: number; clientY: number; x: number; y: number; width: number; height: number } | null>(null);
  const readPosition = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    const canvas = element.parentElement!.getBoundingClientRect();
    const width = canvas.width, height = canvas.height;
    const anchor = {left:0,center:0.5,right:1}[appearance.captionAlign];
    return { width, height, x: width ? clamp((box.left + box.width * anchor - canvas.left) / width * 100) : 50,
      y: height ? clamp((box.top + box.height / 2 - canvas.top) / height * 100) : 50 };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const origin = drag.current;
    if (!origin || origin.id !== e.pointerId) return;
    if (e.clientX === origin.clientX && e.clientY === origin.clientY) return;
    place(e.currentTarget, origin.x + (origin.width ? (e.clientX - origin.clientX) / origin.width * 100 : 0),
      origin.y + (origin.height ? (e.clientY - origin.clientY) / origin.height * 100 : 0));
  };
  const place = (element: HTMLElement, x: number, y: number) => {
    const box = element.getBoundingClientRect(), canvas = element.parentElement!.getBoundingClientRect();
    const anchor = {left:0,center:0.5,right:1}[appearance.captionAlign];
    const w = canvas.width ? Math.min(100, box.width / canvas.width * 100) : 100;
    const h = canvas.height ? Math.min(100, box.height / canvas.height * 100) : 100;
    onPosition(Math.max(w * anchor, Math.min(100 - w * (1-anchor), x)), Math.max(h/2, Math.min(100-h/2,y)));
  };
  const finish = () => { if (drag.current) { drag.current = null; onEnd(); } };
  return <div ref={elementRef} className={`vw-caption vw-caption-draggable${selected ? " selected" : ""}`}
    role="button" tabIndex={0} aria-label={`${label}: ${clip.text}`} aria-pressed={selected}
    style={{
      left: `${clip.captionX ?? 50}%`, top: `${clip.captionY ?? 82}%`, bottom: "auto",
      transform: `translate(-${{left:0,center:50,right:100}[appearance.captionAlign]}%, ${clip.captionX === undefined ? "0" : "-50%"})`,
      fontFamily: `"${CAPTION_FONTS[appearance.captionFont]}", ${appearance.captionFont === "serif" ? "serif" : appearance.captionFont === "mono" ? "monospace" : "sans-serif"}`,
      fontSize: appearance.captionSize * ratio, fontWeight: appearance.captionBold ? 700 : 400,
      color: appearance.captionColor, textAlign: appearance.captionAlign,
      backgroundColor: appearance.captionBackground ? "#00000065" : "transparent",
      WebkitTextStroke: appearance.captionBackground ? undefined : `${appearance.captionOutline * ratio}px black`,
      paintOrder: "stroke fill", textShadow: "none",
    }}
    onPointerDown={e => {
      if (e.button !== 0 || drag.current) return;
      e.preventDefault(); e.stopPropagation();
      drag.current = { ...readPosition(e.currentTarget), id: e.pointerId, clientX: e.clientX, clientY: e.clientY };
      e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); onStart();
    }}
    onPointerMove={move}
    onPointerUp={e => { if (drag.current?.id === e.pointerId) { move(e); finish(); } }}
    onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={e => {
      const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[e.key];
      if (!direction) return;
      e.preventDefault(); e.stopPropagation();
      const position = readPosition(e.currentTarget), step = e.shiftKey ? 5 : 1;
      onStart(); place(e.currentTarget, position.x + direction[0] * step, position.y + direction[1] * step); onEnd();
    }}
  >{clip.text}</div>;
}
