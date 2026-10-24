import { describe, expect, it } from "vitest";
import {
  cellRect,
  colEdgeX,
  colEndX,
  computeEnsureVisibleScroll,
  computeMetrics,
  computeViewLayout,
  findColumnBorderNear,
  paneExtent,
  pixelToCell,
  rangeRect,
  rowEdgeY,
  rowEndY,
  type GridLayout,
  type PaneViewport,
} from "./geometry";

/** 10行×6列、列幅100・行高20、ヘッダ 40×20 */
const base: GridLayout = {
  rows: 10,
  cols: 6,
  colWidths: Array(6).fill(100),
  rowHeights: Array(10).fill(20),
  headerWidth: 40,
  headerHeight: 20,
};
/** 先頭2行・先頭1列を分割。pane のサイズは省略（= 左・上の行列の合計。スクロール不要で、従来の「固定」と同じ見た目） */
const natural: GridLayout = { ...base, splitRows: 2, splitCols: 1 };
/** 左 pane を 60px、上 pane を 30px に絞った分割（左・上の pane の中がスクロールする） */
const narrow: GridLayout = { ...base, splitRows: 2, splitCols: 1, leftWidth: 60, topHeight: 30 };

describe("分割していない場合", () => {
  const m = computeMetrics(base);
  it("pane の大きさは 0、座標は従来どおり（ヘッダ幅 + 位置 - スクロール）", () => {
    expect(paneExtent(base, m)).toEqual({ w: 0, h: 0 });
    expect(colEdgeX(base, m, { x: 30, y: 0 }, 2)).toBe(40 + 200 - 30);
    expect(rowEdgeY(base, m, { x: 0, y: 25 }, 3)).toBe(20 + 60 - 25);
    expect(pixelToCell(base, m, { x: 250, y: 100 }, 200, 70)).toEqual({ row: 7, col: 4 }); // x: 160+250=410, y: 50+100=150
  });
});

describe("分割（pane のサイズ省略 = 合計）: 従来の固定と同じ見た目", () => {
  const m = computeMetrics(natural);

  it("pane の大きさは、左・上の行列の合計", () => {
    expect(paneExtent(natural, m)).toEqual({ w: 100, h: 40 });
  });

  it("左・上の pane はスクロールしない（スクロール量は 0）", () => {
    const scroll = { x: 30, y: 50 };
    expect(colEdgeX(natural, m, scroll, 0)).toBe(40);
    expect(colEndX(natural, m, scroll, 0)).toBe(140);
    expect(rowEdgeY(natural, m, scroll, 1)).toBe(40);
  });

  it("右・下の pane は、左・上の pane のすぐ隣から並び、スクロール量だけ動く", () => {
    const scroll = { x: 30, y: 50 };
    expect(colEdgeX(natural, m, scroll, 1)).toBe(110);
    expect(colEndX(natural, m, scroll, 1)).toBe(210);
    expect(rowEdgeY(natural, m, scroll, 2)).toBe(10); // 上 pane(~60)より上に隠れている
    expect(colEdgeX(natural, m, { x: 0, y: 0 }, 1)).toBe(40 + 100);
    expect(rowEdgeY(natural, m, { x: 0, y: 0 }, 2)).toBe(20 + 40);
  });

  it("cellRect / rangeRect / rowEndY", () => {
    const scroll = { x: 30, y: 50 };
    expect(cellRect(natural, m, scroll, 0, 0)).toEqual({ x: 40, y: 20, w: 100, h: 20 });
    expect(cellRect(natural, m, scroll, 5, 3)).toEqual({ x: 40 + 300 - 30, y: 20 + 100 - 50, w: 100, h: 20 });
    expect(rangeRect(natural, m, scroll, { r1: 5, c1: 2, r2: 6, c2: 3 })).toEqual({ x: 40 + 200 - 30, y: 20 + 100 - 50, w: 200, h: 40 });
    expect(rowEndY(natural, m, scroll, 5)).toBe(20 + 120 - 50);
  });

  it("pixelToCell: pane ごとのスクロール量で判定する", () => {
    const scroll = { x: 250, y: 100 };
    expect(pixelToCell(natural, m, scroll, 60, 30)).toEqual({ row: 0, col: 0 });
    expect(pixelToCell(natural, m, scroll, 200, 70)).toEqual({ row: 7, col: 4 });
    expect(pixelToCell(natural, m, scroll, 60, 70)).toEqual({ row: 7, col: 0 });
    expect(pixelToCell(natural, m, scroll, 200, 30)).toEqual({ row: 0, col: 4 });
    expect(pixelToCell(natural, m, scroll, 10, 70)).toBeNull();
    expect(pixelToCell(natural, m, scroll, 200, 10)).toBeNull();
  });
});

describe("分割（pane を絞る）: 左・上の pane が独自にスクロールする", () => {
  const m = computeMetrics(narrow);
  /** x, y = 右・下の pane、lx, ty = 左・上の pane のスクロール量 */
  const scroll = { x: 30, y: 50, lx: 25, ty: 5 };

  it("pane の大きさは指定した値", () => {
    expect(paneExtent(narrow, m)).toEqual({ w: 60, h: 30 });
  });

  it("左 pane は lx、右 pane は x で動き、右 pane は左 pane の右端（ヘッダ幅 + 左 pane の幅）から始まる", () => {
    expect(colEdgeX(narrow, m, scroll, 0)).toBe(40 - 25); // 内容が pane からはみ出して見える部分は、描画側でクリップする
    expect(colEndX(narrow, m, scroll, 0)).toBe(40 + 100 - 25);
    expect(colEdgeX(narrow, m, scroll, 1)).toBe(40 + 60 + 0 - 30); // 右 pane の先頭列
    expect(colEdgeX(narrow, m, scroll, 2)).toBe(40 + 60 + 100 - 30);
    expect(colEdgeX(narrow, m, { x: 0, y: 0 }, 1)).toBe(100); // スクロール 0 なら左 pane のすぐ隣
  });

  it("上 pane は ty、下 pane は y で動き、下 pane は上 pane の下端から始まる", () => {
    expect(rowEdgeY(narrow, m, scroll, 0)).toBe(20 - 5);
    expect(rowEdgeY(narrow, m, scroll, 1)).toBe(20 + 20 - 5);
    expect(rowEdgeY(narrow, m, scroll, 2)).toBe(20 + 30 + 0 - 50);
    expect(rowEdgeY(narrow, m, scroll, 3)).toBe(20 + 30 + 20 - 50);
  });

  it("スクロール量 lx / ty を省略した場合は 0 として扱う", () => {
    expect(colEdgeX(narrow, m, { x: 0, y: 0 }, 0)).toBe(40);
    expect(rowEdgeY(narrow, m, { x: 0, y: 0 }, 1)).toBe(40);
  });

  it("pixelToCell: 左・上の pane では lx / ty、右・下の pane では x / y を使って判定する", () => {
    // 左 pane(px 40〜100): dx=10 → 内容 10+25=35 → 列0
    expect(pixelToCell(narrow, m, scroll, 50, 200)).toMatchObject({ col: 0 });
    // 右 pane: px=120 → dx=80 → 100(右 pane の先頭) + (80-60) + 30 = 150 → 列1
    expect(pixelToCell(narrow, m, scroll, 120, 200)).toMatchObject({ col: 1 });
    // 上 pane(py 20〜50): dy=10 → 内容 10+5=15 → 行0
    expect(pixelToCell(narrow, m, scroll, 200, 30)).toMatchObject({ row: 0 });
    // 上 pane: dy=25 → 25+5=30 → 行1
    expect(pixelToCell(narrow, m, scroll, 200, 45)).toMatchObject({ row: 1 });
    // 下 pane: py=80 → dy=60 → 行の先頭は 40(上 pane の内容の合計) + (60-30) + 50 = 120 → 行6
    expect(pixelToCell(narrow, m, scroll, 200, 80)).toMatchObject({ row: 6 });
  });

  it("左・上の pane の内容より広い余白は、その pane の最後の列・行とみなす", () => {
    const wide: GridLayout = { ...base, splitCols: 1, leftWidth: 150, splitRows: 1, topHeight: 60 };
    const wm = computeMetrics(wide);
    expect(pixelToCell(wide, wm, { x: 0, y: 0 }, 40 + 120, 200)).toMatchObject({ col: 0 }); // 列0(100px)の右の余白
    expect(pixelToCell(wide, wm, { x: 0, y: 0 }, 200, 20 + 40)).toMatchObject({ row: 0 }); // 行0(20px)の下の余白
  });
});

describe("computeViewLayout", () => {
  it("分割しなければ領域は表全体で1つ", () => {
    const pm = computeMetrics(base);
    const v = computeViewLayout(base, pm, { x: 0, y: 0 }, { width: 440, height: 220 });
    expect(v.panes).toHaveLength(1);
    expect(v.panes[0].clip).toEqual({ x: 40, y: 20, w: 400, h: 200 });
    expect(v.panes[0].rows).toMatchObject({ start: 0, end: 10, first: 0, leading: false });
  });

  it("分割すると 2×2 の4領域で、順に 右下・左下・右上・左上", () => {
    const m = computeMetrics(natural);
    const v = computeViewLayout(natural, m, { x: 250, y: 100 }, { width: 440, height: 220 });
    expect(v.panes).toHaveLength(4);
    const [main, left, top, corner] = v.panes;
    expect(main.clip).toEqual({ x: 140, y: 60, w: 300, h: 160 });
    expect(main.cols).toMatchObject({ start: 1, end: 6, first: 3, leading: false });
    expect(main.rows).toMatchObject({ start: 2, end: 10, first: 7, leading: false });
    expect(corner.clip).toEqual({ x: 40, y: 20, w: 100, h: 40 });
    expect(top.rows.leading).toBe(true);
    expect(top.cols.leading).toBe(false);
    expect(left.rows.leading).toBe(false);
    expect(left.cols.leading).toBe(true);
  });

  it("pane を絞ると、clip と描画範囲は各 pane のサイズ・スクロール量で決まる", () => {
    const m = computeMetrics(narrow);
    const v = computeViewLayout(narrow, m, { x: 30, y: 50, lx: 25, ty: 5 }, { width: 440, height: 220 });
    const [main, left, top, corner] = v.panes;
    // 右下: 左 pane(60)・上 pane(30)の右下から。先頭列は 100+30 から、先頭行は 40+50 から
    expect(main.clip).toEqual({ x: 100, y: 50, w: 340, h: 170 });
    expect(main.cols).toMatchObject({ start: 1, end: 6, first: 1 });
    expect(main.rows).toMatchObject({ start: 2, end: 10, first: 4 });
    // 左上: 左 pane の lx=25 / 上 pane の ty=5 から
    expect(corner.clip).toEqual({ x: 40, y: 20, w: 60, h: 30 });
    expect(corner.cols).toMatchObject({ start: 0, end: 1, first: 0 });
    expect(corner.cols.lastOffset).toBe(25 + 60 + 1);
    expect(corner.rows.lastOffset).toBe(5 + 30 + 1);
    expect(left.clip).toEqual({ x: 40, y: 50, w: 60, h: 170 });
    expect(top.clip).toEqual({ x: 100, y: 20, w: 340, h: 30 });
  });

  it("左 pane が横にスクロールしている場合、見えている最初の列が変わる", () => {
    const wideLeft: GridLayout = { ...base, splitCols: 3, leftWidth: 120 }; // 左 pane は3列(300)を 120px に
    const m = computeMetrics(wideLeft);
    const v = computeViewLayout(wideLeft, m, { x: 0, y: 0, lx: 150 }, { width: 440, height: 220 });
    const left = v.cols.find((c) => c.leading)!;
    expect(left.first).toBe(1); // 150 は列1(100〜200)の途中
  });

  it("canvas が pane より小さくてもクリップ幅は負にならない", () => {
    const m = computeMetrics(natural);
    const v = computeViewLayout(natural, m, { x: 0, y: 0 }, { width: 100, height: 40 });
    for (const p of v.panes) {
      expect(p.clip.w).toBeGreaterThanOrEqual(0);
      expect(p.clip.h).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("computeEnsureVisibleScroll: セルが属する pane のスクロールだけを動かす", () => {
  const m = computeMetrics(natural);
  const view: PaneViewport = { leftW: 100, rightW: 300, topH: 40, bottomH: 100 };
  const split = { rows: 2, cols: 1 };

  it("下に隠れた行へ移動すると、その行が見える位置まで y をスクロールする", () => {
    // 行9 の下端 200 - 上 pane(40) = 160 > 0 + 100 → y = 160 - 100
    expect(computeEnsureVisibleScroll(m, { x: 0, y: 0 }, view, 9, 1, split).y).toBe(60);
  });

  it("上 pane の上端より上に隠れた下 pane の行へ戻ると、下 pane の先頭に来るよう y を動かす", () => {
    // y=60 のとき行2(下 pane の先頭、内容 0〜20)は隠れている → y = 0
    expect(computeEnsureVisibleScroll(m, { x: 0, y: 60 }, view, 2, 1, split).y).toBe(0);
  });

  it("列も同様（右 pane は x）", () => {
    expect(computeEnsureVisibleScroll(m, { x: 0, y: 0 }, view, 2, 5, split).x).toBe(200); // 列5 の右端 500 > 300
    expect(computeEnsureVisibleScroll(m, { x: 150, y: 0 }, view, 2, 1, split).x).toBe(0);
  });

  it("左・上の pane のセルは、その pane のスクロール（lx / ty）だけを動かす", () => {
    const narrowView: PaneViewport = { leftW: 60, rightW: 300, topH: 30, bottomH: 100 };
    const nm = computeMetrics(narrow);
    const r = computeEnsureVisibleScroll(nm, { x: 70, y: 40, lx: 0, ty: 0 }, narrowView, 1, 0, split);
    expect(r.lx).toBe(40); // 列0 の右端 100 > 0 + 60
    expect(r.ty).toBe(10); // 行1 の下端 40 > 0 + 30
    expect(r.x).toBe(70); // 右・下の pane は動かない
    expect(r.y).toBe(40);
  });

  it("すでに pane に収まって見えているセルは、スクロールを変えない", () => {
    const r = computeEnsureVisibleScroll(m, { x: 20, y: 30, lx: 0, ty: 0 }, view, 0, 0, split); // 列0(100) は左 pane(100) に、行0(20) は上 pane(40) に収まる
    expect(r).toEqual({ x: 20, y: 30, lx: 0, ty: 0 });
  });

  it("右・下の pane のセルは、左・上の pane のスクロールに影響しない", () => {
    const r = computeEnsureVisibleScroll(m, { x: 0, y: 0, lx: 33, ty: 7 }, view, 9, 5, split);
    expect(r.lx).toBe(33);
    expect(r.ty).toBe(7);
  });

  it("分割の指定が無ければ従来どおり", () => {
    const pm = computeMetrics(base);
    expect(computeEnsureVisibleScroll(pm, { x: 0, y: 0 }, { leftW: 0, rightW: 300, topH: 0, bottomH: 100 }, 9, 5)).toMatchObject({ x: 300, y: 100 });
  });
});

describe("findColumnBorderNear（列幅リサイズの当たり判定）", () => {
  const m = computeMetrics(natural);
  const baseP = { metrics: m, cols: 6, headerWidth: 40, resizeHandlePx: 5, splitCols: 1 };

  it("左 pane との境目は、最後の左 pane の列の右端として反応する", () => {
    expect(findColumnBorderNear({ ...baseP, scrollX: 0, px: 140 })).toBe(0);
    expect(findColumnBorderNear({ ...baseP, scrollX: 80, px: 138 })).toBe(0);
  });

  it("右 pane の境界は、右のスクロール量を加味して判定する", () => {
    expect(findColumnBorderNear({ ...baseP, scrollX: 0, px: 240 })).toBe(1);
    expect(findColumnBorderNear({ ...baseP, scrollX: 50, px: 190 })).toBe(1);
  });

  it("左 pane の外にはみ出して隠れた列の境界には反応しない（pane を絞った場合）", () => {
    const nm = computeMetrics(narrow);
    const p = { metrics: nm, cols: 6, headerWidth: 40, resizeHandlePx: 5, splitCols: 1, leftWidth: 60 };
    // 列0 の右端(100)は、左 pane(60px)の外（画面上 40+100=140 > 100）。右 pane の列でもない
    expect(findColumnBorderNear({ ...p, scrollX: 0, px: 140 })).toBeNull();
    // 左 pane を lx=40 スクロールすると、列0 の右端が左 pane の右端(100)に来る → 反応する
    expect(findColumnBorderNear({ ...p, scrollX: 0, leftScrollX: 40, px: 100 })).toBe(0);
  });

  it("左 pane のスクロールを反映する（複数列）", () => {
    const wl: GridLayout = { ...base, splitCols: 3, leftWidth: 200 };
    const wm = computeMetrics(wl);
    const p = { metrics: wm, cols: 6, headerWidth: 40, resizeHandlePx: 5, splitCols: 3, leftWidth: 200 };
    // lx=0: 列0 の右端 = 画面 140。lx=50: 90
    expect(findColumnBorderNear({ ...p, scrollX: 0, px: 140 })).toBe(0);
    expect(findColumnBorderNear({ ...p, scrollX: 0, leftScrollX: 50, px: 90 })).toBe(0);
    expect(findColumnBorderNear({ ...p, scrollX: 0, leftScrollX: 50, px: 190 })).toBe(1); // 列1 の右端: 40+200-50
    expect(findColumnBorderNear({ ...p, scrollX: 0, leftScrollX: 50, px: 140 })).toBeNull(); // どの境界でもない
  });

  it("分割がなければ従来どおり", () => {
    const pm = computeMetrics(base);
    const p = { metrics: pm, cols: 6, headerWidth: 40, resizeHandlePx: 5 };
    expect(findColumnBorderNear({ ...p, scrollX: 0, px: 140 })).toBe(0);
    expect(findColumnBorderNear({ ...p, scrollX: 0, px: 41 })).toBeNull();
  });
});
