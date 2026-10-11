import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  findColumnBorderNear,
  findFirstVisible,
  inRange,
  pixelToCell,
  clamp,
  cellRect,
  computeEnsureVisibleScroll,
} from "./geometry";

const layout = {
  rows: 5,
  cols: 4,
  colWidths: [100, 50, 80, 60],
  rowHeights: [20, 30, 25, 25, 25],
  headerWidth: 40,
  headerHeight: 24,
};

describe("computeMetrics", () => {
  it("累積オフセットを計算する", () => {
    const m = computeMetrics(layout);
    expect(m.colOffsets).toEqual([0, 100, 150, 230, 290]);
    expect(m.rowOffsets).toEqual([0, 20, 50, 75, 100, 125]);
  });
});

describe("findFirstVisible", () => {
  it("スクロール位置0なら先頭を返す", () => {
    const offsets = [0, 100, 150, 230, 290];
    expect(findFirstVisible(offsets, 0)).toBe(0);
  });

  it("スクロール位置がちょうど境界なら次のインデックスを返す", () => {
    const offsets = [0, 100, 150, 230, 290];
    expect(findFirstVisible(offsets, 100)).toBe(1);
  });

  it("スクロール位置が範囲の途中でも該当インデックスを返す", () => {
    const offsets = [0, 100, 150, 230, 290];
    expect(findFirstVisible(offsets, 160)).toBe(2);
  });

  it("配列が要素0件（範囲なし）なら0を返す", () => {
    expect(findFirstVisible([0], 50)).toBe(0);
  });
});

describe("pixelToCell", () => {
  const metrics = computeMetrics(layout);
  const scroll = { x: 0, y: 0 };

  it("ヘッダ領域なら null を返す", () => {
    expect(pixelToCell(layout, metrics, scroll, 10, 50)).toBeNull(); // 列ヘッダ幅の内側
    expect(pixelToCell(layout, metrics, scroll, 60, 10)).toBeNull(); // 行ヘッダ高さの内側
  });

  it("セル領域なら正しい row/col を返す", () => {
    // headerWidth=40, headerHeight=24
    // col0: 0-100, col1: 100-150 ...
    expect(pixelToCell(layout, metrics, scroll, 40 + 50, 24 + 10)).toEqual({ row: 0, col: 0 });
    expect(pixelToCell(layout, metrics, scroll, 40 + 120, 24 + 10)).toEqual({ row: 0, col: 1 });
  });

  it("スクロールした分だけ内部座標がずれる", () => {
    const scrolled = { x: 100, y: 20 };
    // スクロールX=100なので、見た目上の同じピクセル位置は1つ右の列を指す
    expect(pixelToCell(layout, metrics, scrolled, 40 + 10, 24 + 10)).toEqual({ row: 1, col: 1 });
  });

  it("グリッド範囲を超える座標は最終行/列にクランプする", () => {
    expect(pixelToCell(layout, metrics, scroll, 40 + 10000, 24 + 10000)).toEqual({ row: 4, col: 3 });
  });
});

describe("findColumnBorderNear", () => {
  const metrics = computeMetrics(layout);

  it("列の境界付近ならその左側の列番号を返す", () => {
    // col0/col1 の境界は colOffsets[1]=100 -> headerWidth+100-scrollX = 140
    const result = findColumnBorderNear({
      metrics,
      cols: layout.cols,
      headerWidth: layout.headerWidth,
      scrollX: 0,
      px: 140,
      resizeHandlePx: 5,
    });
    expect(result).toBe(0);
  });

  it("境界から離れていれば null", () => {
    const result = findColumnBorderNear({
      metrics,
      cols: layout.cols,
      headerWidth: layout.headerWidth,
      scrollX: 0,
      px: 70,
      resizeHandlePx: 5,
    });
    expect(result).toBeNull();
  });

  it("一番左の境界(0列目の左端)は列番号-1になるので null を返す", () => {
    const result = findColumnBorderNear({
      metrics,
      cols: layout.cols,
      headerWidth: layout.headerWidth,
      scrollX: 0,
      px: layout.headerWidth, // colOffsets[0]=0 の位置
      resizeHandlePx: 5,
    });
    expect(result).toBeNull();
  });
});

describe("inRange", () => {
  it("範囲内なら true", () => {
    expect(inRange({ r1: 1, c1: 1, r2: 3, c2: 3 }, 2, 2)).toBe(true);
  });
  it("範囲外なら false", () => {
    expect(inRange({ r1: 1, c1: 1, r2: 3, c2: 3 }, 0, 2)).toBe(false);
    expect(inRange({ r1: 1, c1: 1, r2: 3, c2: 3 }, 2, 4)).toBe(false);
  });
});

describe("clamp", () => {
  it("範囲内はそのまま", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("下限未満は下限に", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  it("上限超過は上限に", () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("cellRect", () => {
  const metrics = computeMetrics(layout);

  it("ヘッダ幅・高さ分オフセットしたセルの矩形を返す", () => {
    const rect = cellRect(layout, metrics, { x: 0, y: 0 }, 1, 1);
    // col1: offset 100, row1: offset 20
    expect(rect).toEqual({ x: 40 + 100, y: 24 + 20, w: 50, h: 30 });
  });

  it("スクロール分だけ位置がずれる", () => {
    const rect = cellRect(layout, metrics, { x: 10, y: 5 }, 0, 0);
    expect(rect.x).toBe(40 - 10);
    expect(rect.y).toBe(24 - 5);
  });
});

describe("computeEnsureVisibleScroll", () => {
  const metrics = computeMetrics(layout);
  const viewport = { w: 120, h: 40 };

  it("すでに表示範囲内なら変更しない", () => {
    const scroll = { x: 0, y: 0 };
    const result = computeEnsureVisibleScroll(metrics, scroll, viewport, 0, 0);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("対象セルが右にはみ出していれば右端に合わせてスクロールする", () => {
    const scroll = { x: 0, y: 0 };
    // col3: 230-290, viewport幅120なら290-120=170まで必要
    const result = computeEnsureVisibleScroll(metrics, scroll, viewport, 0, 3);
    expect(result.x).toBe(290 - 120);
  });

  it("対象セルが左にはみ出していればその左端に合わせる", () => {
    const scroll = { x: 200, y: 0 };
    const result = computeEnsureVisibleScroll(metrics, scroll, viewport, 0, 0);
    expect(result.x).toBe(0);
  });

  it("縦方向も同様に補正する", () => {
    const scroll = { x: 0, y: 0 };
    const result = computeEnsureVisibleScroll(metrics, scroll, viewport, 4, 0);
    // row4: 100-125, viewport高さ40なら125-40=85まで必要
    expect(result.y).toBe(125 - 40);
  });
});
