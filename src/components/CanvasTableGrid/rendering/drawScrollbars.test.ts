import { describe, expect, it, vi } from "vitest";
import { defaultTheme } from "./drawGrid";
import { drawScrollbars } from "./drawScrollbars";

function createFakeCtx() {
  const calls: { fillStyle: string[]; fillRect: number[][] } = { fillStyle: [], fillRect: [] };
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.fillRect.push([x, y, w, h]);
    }),
    set fillStyle(v: string) {
      calls.fillStyle.push(v);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const baseOpts = {
  width: 500,
  height: 400,
  dpr: 1,
  headerWidth: 40,
  headerHeight: 24,
  scroll: { x: 0, y: 0 },
  theme: defaultTheme,
};

describe("drawScrollbars", () => {
  it("縦・横ともコンテンツが表示領域に収まっていれば何も描画しない", () => {
    const { ctx, calls } = createFakeCtx();
    drawScrollbars(ctx, { ...baseOpts, viewport: { w: 400, h: 300 }, content: { w: 400, h: 300 } });
    expect(calls.fillRect.length).toBe(0);
  });

  it("縦にはみ出していれば縦スクロールバーのトラック・つまみを描画する", () => {
    const { ctx, calls } = createFakeCtx();
    drawScrollbars(ctx, { ...baseOpts, viewport: { w: 400, h: 100 }, content: { w: 400, h: 1000 } });
    expect(calls.fillRect.length).toBe(2); // トラック1回 + つまみ1回
    expect(calls.fillStyle).toContain(defaultTheme.scrollbarTrackColor);
    expect(calls.fillStyle).toContain(defaultTheme.scrollbarThumbColor);
  });

  it("横にもはみ出していれば横スクロールバーも追加で描画する", () => {
    const { ctx, calls } = createFakeCtx();
    drawScrollbars(ctx, { ...baseOpts, viewport: { w: 100, h: 100 }, content: { w: 1000, h: 1000 } });
    expect(calls.fillRect.length).toBe(4); // 縦2回 + 横2回
  });

  it("dpr倍にスケールする", () => {
    const { ctx } = createFakeCtx();
    const scaleSpy = vi.spyOn(ctx, "scale");
    drawScrollbars(ctx, { ...baseOpts, dpr: 2, viewport: { w: 100, h: 100 }, content: { w: 1000, h: 1000 } });
    expect(scaleSpy).toHaveBeenCalledWith(2, 2);
  });
});
