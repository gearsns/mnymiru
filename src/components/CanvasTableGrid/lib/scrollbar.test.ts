import { describe, expect, it } from "vitest";
import { computeScrollbarThumb, needsScrollbar, scrollbarDragRatio, scrollbarHitTest } from "./scrollbar";

describe("needsScrollbar", () => {
  it("コンテンツが表示領域より大きければ true", () => {
    expect(needsScrollbar({ viewport: 100, content: 200 })).toBe(true);
  });
  it("コンテンツが表示領域に収まっていれば false", () => {
    expect(needsScrollbar({ viewport: 200, content: 100 })).toBe(false);
    expect(needsScrollbar({ viewport: 100, content: 100 })).toBe(false);
  });
});

describe("computeScrollbarThumb", () => {
  it("つまみのサイズは表示割合に比例する", () => {
    const thumb = computeScrollbarThumb({ viewport: 50, content: 200, scroll: 0, track: 400 });
    expect(thumb.size).toBe(100); // (50/200)*400
    expect(thumb.offset).toBe(0);
  });

  it("最小サイズを下回らない", () => {
    const thumb = computeScrollbarThumb({ viewport: 5, content: 10000, scroll: 0, track: 400 });
    expect(thumb.size).toBe(24);
  });

  it("スクロール位置に応じてoffsetが動く", () => {
    const layout = { viewport: 50, content: 200, scroll: 75, track: 400 }; // maxScroll=150
    const thumb = computeScrollbarThumb(layout);
    // offset = (75/150) * (400-100) = 150
    expect(thumb.offset).toBe(150);
  });
});

describe("scrollbarDragRatio", () => {
  it("トラックの移動量に対するスクロール量の比率を返す", () => {
    const ratio = scrollbarDragRatio({ viewport: 50, content: 200, scroll: 0, track: 400 });
    // maxScroll=150, track-thumb=400-100=300 -> ratio=0.5
    expect(ratio).toBe(0.5);
  });
});

describe("scrollbarHitTest", () => {
  const base = {
    width: 500,
    height: 400,
    headerWidth: 40,
    headerHeight: 24,
    viewportWidth: 100, // content > viewport で縦・横ともスクロールバーが出る設定
    viewportHeight: 100,
    contentWidth: 1000,
    contentHeight: 1000,
  };

  it("右端付近は縦スクロールバー判定になる", () => {
    const hit = scrollbarHitTest({ ...base, px: 495, py: 200 });
    expect(hit.overVertical).toBe(true);
    expect(hit.overHorizontal).toBe(false);
  });

  it("下端付近は横スクロールバー判定になる", () => {
    const hit = scrollbarHitTest({ ...base, px: 200, py: 395 });
    expect(hit.overHorizontal).toBe(true);
    expect(hit.overVertical).toBe(false);
  });

  it("中央付近はどちらでもない", () => {
    const hit = scrollbarHitTest({ ...base, px: 200, py: 200 });
    expect(hit.overVertical).toBe(false);
    expect(hit.overHorizontal).toBe(false);
  });

  it("スクロールバーが不要（コンテンツが収まっている）なら判定しない", () => {
    const hit = scrollbarHitTest({ ...base, contentWidth: 50, contentHeight: 50, px: 495, py: 200 });
    expect(hit.overVertical).toBe(false);
  });
});
