import { describe, expect, it } from "vitest";
import { SCROLLBAR_SIZE, barDragRatio, barThumb, computeScrollbars, hitScrollbar } from "./scrollbar";

const S = SCROLLBAR_SIZE;
const base = { width: 440, height: 220, headerWidth: 40, headerHeight: 20 };

describe("computeScrollbars", () => {
  it("分割しなければ縦1本・横1本（内容が収まっている軸のバーは出ない）", () => {
    const bars = computeScrollbars({ ...base, leftW: 0, topH: 0, splitCols: 0, splitRows: 0, content: { left: 0, right: 1000, top: 0, bottom: 600 }, scroll: { x: 0, y: 0 } });
    expect(bars.map((b) => b.scrollKey)).toEqual(["y", "x"]);
    expect(bars[0].track).toEqual({ x: 440 - S, y: 20, w: S, h: 220 - 20 - S });
    expect(bars[1].track).toEqual({ x: 40, y: 220 - S, w: 440 - 40 - S, h: S });
    const small = computeScrollbars({ ...base, leftW: 0, topH: 0, splitCols: 0, splitRows: 0, content: { left: 0, right: 100, top: 0, bottom: 100 }, scroll: { x: 0, y: 0 } });
    expect(small).toEqual([]);
  });

  it("分割すると pane ごとに別のバーが出る（縦: 下・上、横: 右・左）。それぞれ自分の pane の範囲に置かれる", () => {
    const bars = computeScrollbars({
      ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
      content: { left: 300, right: 1000, top: 100, bottom: 600 },
      scroll: { x: 10, y: 20, lx: 30, ty: 5 },
    });
    expect(bars.map((b) => b.scrollKey)).toEqual(["y", "ty", "x", "lx"]);
    const [y, ty, x, lx] = bars;
    expect(y.track).toEqual({ x: 440 - S, y: 60, w: S, h: 220 - 20 - 40 - S }); // 下 pane の高さの範囲
    expect(ty.track).toEqual({ x: 440 - S, y: 20, w: S, h: 40 }); // 上 pane の高さの範囲
    expect(x.track).toEqual({ x: 140, y: 220 - S, w: 440 - 40 - 100 - S, h: S }); // 右 pane の幅の範囲
    expect(lx.track).toEqual({ x: 40, y: 220 - S, w: 100, h: S }); // 左 pane の幅の範囲
    // それぞれのバーが、自分のスクロール量・内容・見えているサイズを持つ
    expect([y.scroll, ty.scroll, x.scroll, lx.scroll]).toEqual([20, 5, 10, 30]);
    expect([y.content, ty.content, x.content, lx.content]).toEqual([600, 100, 1000, 300]);
    expect([y.viewport, ty.viewport, x.viewport, lx.viewport]).toEqual([148, 40, 288, 100]);
  });

  it("分割していて、ペアの片方だけバーが必要なら、もう片方も「無効なバー」として場所を確保する（見た目をそろえる）", () => {
    const bars = computeScrollbars({
      ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
      content: { left: 100, right: 1000, top: 40, bottom: 600 }, // 左・上は pane にちょうど収まる（スクロール不要）
      scroll: { x: 0, y: 0 },
    });
    expect(bars.map((b) => [b.scrollKey, b.enabled])).toEqual([["y", true], ["ty", false], ["x", true], ["lx", false]]);
    // 無効なバーも、有効なバーと同じ位置・大きさのトラックを持つ
    const ty = bars.find((b) => b.scrollKey === "ty")!;
    const lx = bars.find((b) => b.scrollKey === "lx")!;
    expect(ty.track).toEqual({ x: 440 - S, y: 20, w: S, h: 40 });
    expect(lx.track).toEqual({ x: 40, y: 220 - S, w: 100, h: S });
  });

  it("縦のペアと横のペアは別々に判定する（縦だけ必要なら、横は出さない）", () => {
    const bars = computeScrollbars({
      ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
      content: { left: 100, right: 100, top: 40, bottom: 600 }, // 縦（下 pane）だけがはみ出す
      scroll: { x: 0, y: 0 },
    });
    expect(bars.map((b) => [b.scrollKey, b.enabled])).toEqual([["y", true], ["ty", false]]);
  });

  it("分割していても、どの pane もバーが不要なら何も出さない", () => {
    const bars = computeScrollbars({
      ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
      content: { left: 100, right: 100, top: 40, bottom: 100 },
      scroll: { x: 0, y: 0 },
    });
    expect(bars).toEqual([]);
  });

  it("左右だけ・上下だけの分割でも、その軸のペアでそろえる", () => {
    const bars = computeScrollbars({
      ...base, leftW: 100, topH: 0, splitCols: 1, splitRows: 0,
      content: { left: 300, right: 100, top: 0, bottom: 100 }, // 左 pane だけが横にはみ出す
      scroll: { x: 0, y: 0 },
    });
    expect(bars.map((b) => [b.scrollKey, b.enabled])).toEqual([["x", false], ["lx", true]]);
  });

  it("分割していなければ、従来どおり必要なバーだけ（無効なバーは出ない）", () => {
    const bars = computeScrollbars({ ...base, leftW: 0, topH: 0, splitCols: 0, splitRows: 0, content: { left: 0, right: 100, top: 0, bottom: 1000 }, scroll: { x: 0, y: 0 } });
    expect(bars.map((b) => [b.scrollKey, b.enabled])).toEqual([["y", true]]);
  });
});

describe("computeScrollbars: 固定モード（freeze）", () => {
  const input = {
    ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
    content: { left: 100, right: 1000, top: 40, bottom: 600 },
    scroll: { x: 0, y: 0 }, freeze: true,
  };
  it("縦横1本ずつで、トラックは全長（ヘッダの下〜端）。つまみの大きさは、スクロールする側の内容と見えている大きさで決まる", () => {
    const bars = computeScrollbars(input);
    expect(bars.map((b) => [b.scrollKey, b.enabled])).toEqual([["y", true], ["x", true]]);
    const [y, x] = bars;
    expect(y.track).toEqual({ x: 440 - S, y: 20, w: S, h: 220 - 20 - S }); // 上 pane の部分も含む全長
    expect(y.viewport).toBe(220 - 20 - S - 40); // 見えているのは、固定した行を除いた分
    expect(y.content).toBe(600);
    expect(x.track).toEqual({ x: 40, y: 220 - S, w: 440 - 40 - S, h: S });
    expect(x.viewport).toBe(440 - 40 - S - 100);
  });
  it("pane ごとのバー（lx / ty）や、無効なバーは出ない（必要な軸のバーだけ）", () => {
    const bars = computeScrollbars({ ...input, content: { left: 999, right: 100, top: 999, bottom: 600 } });
    expect(bars.map((b) => b.scrollKey)).toEqual(["y"]); // 左・上の内容が大きくても、固定ではスクロールしないので対象外
    expect(computeScrollbars({ ...input, content: { left: 0, right: 100, top: 0, bottom: 100 } })).toEqual([]);
  });
});

describe("hitScrollbar", () => {
  const bars = computeScrollbars({
    ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
    content: { left: 300, right: 1000, top: 100, bottom: 600 }, scroll: { x: 0, y: 0 },
  });
  it("座標に応じて、どの pane のバーかを返す", () => {
    expect(hitScrollbar(bars, 435, 100)?.scrollKey).toBe("y"); // 右端の下 pane の範囲
    expect(hitScrollbar(bars, 435, 30)?.scrollKey).toBe("ty"); // 右端の上 pane の範囲
    expect(hitScrollbar(bars, 200, 214)?.scrollKey).toBe("x"); // 下端の右 pane の範囲
    expect(hitScrollbar(bars, 80, 214)?.scrollKey).toBe("lx"); // 下端の左 pane の範囲
  });
  it("無効なバー（場所だけ確保したトラック）も、当たり判定には含まれる（クリックを受け止めてセル選択に落とさないため）", () => {
    const withDisabled = computeScrollbars({
      ...base, leftW: 100, topH: 40, splitCols: 1, splitRows: 2,
      content: { left: 100, right: 1000, top: 40, bottom: 600 }, scroll: { x: 0, y: 0 },
    });
    const hit = hitScrollbar(withDisabled, 435, 30);
    expect(hit?.scrollKey).toBe("ty");
    expect(hit?.enabled).toBe(false);
  });
  it("バー以外の場所は null", () => {
    expect(hitScrollbar(bars, 200, 100)).toBeNull();
    expect(hitScrollbar(bars, 435, 10)).toBeNull(); // ヘッダの高さ
    expect(hitScrollbar(bars, 20, 214)).toBeNull(); // 行ヘッダの下
  });
});

describe("つまみ", () => {
  const [bar] = computeScrollbars({
    ...base, leftW: 0, topH: 0, splitCols: 0, splitRows: 0,
    content: { left: 0, right: 100, top: 0, bottom: 1000 }, scroll: { x: 0, y: 0 },
  });
  it("バーごとに、そのトラックの長さを基準にした大きさ・位置になる", () => {
    const t = barThumb(bar);
    expect(t.size).toBeGreaterThan(0);
    expect(t.size).toBeLessThan(bar.track.h);
    expect(barThumb({ ...bar, scroll: 500 }).offset).toBeGreaterThan(t.offset);
  });
  it("ドラッグの比率は正の値（つまみ1pxで、スクロール量が何px動くか）", () => {
    expect(barDragRatio(bar)).toBeGreaterThan(1);
  });
});
