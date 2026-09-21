export function previewPointerPosition(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
) {
  return {
    x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
  };
}

export function previewDragPosition(
  initial: { x: number; y: number },
  delta: { x: number; y: number },
  rect: Pick<DOMRect, "width" | "height">,
  overlay: { widthPercent: number; heightPercent: number },
) {
  const remainingWidth = 100 - overlay.widthPercent;
  const remainingHeight = 100 - overlay.heightPercent;
  const x = Math.abs(remainingWidth) < 0.001
    ? initial.x
    : initial.x + (delta.x / rect.width) * 10000 / remainingWidth;
  const y = Math.abs(remainingHeight) < 0.001
    ? initial.y
    : initial.y + (delta.y / rect.height) * 10000 / remainingHeight;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}
