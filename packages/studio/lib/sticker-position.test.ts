import { describe, expect, it } from "vitest";
import { previewDragPosition, previewPointerPosition } from "./sticker-position";

describe("previewPointerPosition", () => {
  it("maps pointer coordinates to bounded canvas percentages", () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(previewPointerPosition(300, 100, rect)).toEqual({ x: 50, y: 25 });
    expect(previewPointerPosition(50, 400, rect)).toEqual({ x: 0, y: 100 });
  });
  it("moves from the original position by pointer delta without an off-center jump", () => {
    expect(previewDragPosition(
      { x: 50, y: 50 },
      { x: 40, y: -20 },
      { width: 400, height: 200 },
      { widthPercent: 30, heightPercent: 20 },
    )).toEqual({ x: expect.closeTo(64.2857, 4), y: 37.5 });
  });
  it("keeps an axis position when the overlay fills that axis", () => {
    expect(previewDragPosition(
      { x: 35, y: 60 },
      { x: 100, y: 0 },
      { width: 400, height: 200 },
      { widthPercent: 100, heightPercent: 50 },
    ).x).toBe(35);
  });
});
