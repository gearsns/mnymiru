import { describe, expect, it } from "vitest";
import {
  computeVisibleRows,
  flattenTree,
  hasChildren,
  hitTreeToggle,
  initExpanded,
  normalizeLevels,
  parentOf,
  planTreeSort,
  subtreeEnd,
  treeTextInset,
  treeToggleBox,
  TREE_LEFT_PADDING,
  TREE_TOGGLE_SIZE,
} from "./tree";

//  0 ─┬ 1
//     └ 2 ── 3
//  4 ── 5
const levels = [0, 1, 1, 2, 0, 1];

describe("構造", () => {
  it("子の有無・子孫の範囲・親", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => hasChildren(levels, i))).toEqual([true, false, true, false, true, false]);
    expect(subtreeEnd(levels, 0)).toBe(3);
    expect(subtreeEnd(levels, 2)).toBe(3);
    expect(subtreeEnd(levels, 1)).toBe(1);
    expect(subtreeEnd(levels, 4)).toBe(5);
    expect(parentOf(levels, 3)).toBe(2);
    expect(parentOf(levels, 2)).toBe(0);
    expect(parentOf(levels, 5)).toBe(4);
    expect(parentOf(levels, 0)).toBe(-1);
    expect(parentOf(levels, 4)).toBe(-1);
  });
});

describe("normalizeLevels", () => {
  it("先頭は0、前の行+1を超えない、負数や小数・欠損も丸める", () => {
    expect(normalizeLevels([3, 5, 1, 4, -2], 5)).toEqual([0, 1, 1, 2, 0]);
    expect(normalizeLevels([0, 1.9, NaN as number], 4)).toEqual([0, 1, 0, 0]);
    expect(normalizeLevels(undefined, 3)).toEqual([0, 0, 0]);
    expect(normalizeLevels([0, 1, 2], 2)).toEqual([0, 1]);
  });
});

describe("initExpanded", () => {
  it("既定はすべて展開。boolean・配列・関数で指定できる", () => {
    expect(initExpanded(undefined, 3)).toEqual([true, true, true]);
    expect(initExpanded(false, 2)).toEqual([false, false]);
    expect(initExpanded([false], 3)).toEqual([false, true, true]);
    expect(initExpanded((i) => i % 2 === 0, 4)).toEqual([true, false, true, false]);
  });
});

describe("computeVisibleRows", () => {
  it("すべて展開なら全行", () => {
    expect(computeVisibleRows(levels, initExpanded(true, 6))).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("折りたたむと子孫が隠れる（兄弟・親の兄弟は残る）", () => {
    const ex = [false, true, true, true, true, true];
    expect(computeVisibleRows(levels, ex)).toEqual([0, 4, 5]);
    const ex2 = [true, true, false, true, true, true];
    expect(computeVisibleRows(levels, ex2)).toEqual([0, 1, 2, 4, 5]);
  });
  it("子孫の中の折りたたみ状態は、親が閉じている間は無視され、開くと復活する", () => {
    // 行2 は閉じているが、親(行0)が閉じているので全体として行0 だけ見える
    expect(computeVisibleRows(levels, [false, true, false, true, true, true])).toEqual([0, 4, 5]);
    expect(computeVisibleRows(levels, [true, true, false, true, true, true])).toEqual([0, 1, 2, 4, 5]);
  });
  it("子のない行は expanded が false でも影響しない", () => {
    expect(computeVisibleRows(levels, [true, false, true, false, true, false])).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("planTreeSort", () => {
  // 兄弟どうしを値で比較（行番号 -> 値）
  const run = (lv: number[], values: number[], start = 0, end = lv.length - 1) =>
    planTreeSort(lv, start, end, (a, b) => values[a] - values[b]);

  it("ルートはサブツリーごと、子どうしは親の下で並べ替わる", () => {
    //  0:(5) ─ 1:(9), 2:(1)      4:(3) ─ 5:(7), 6:(2)
    const lv = [0, 1, 1, 0, 1, 1];
    const v = [5, 9, 1, 3, 7, 2];
    // ルート: 3(値3) が 0(値5) より前。子: 各親の下で昇順 → 2(1),1(9) / 5(2),4(7)
    expect(run(lv, v)).toEqual([3, 5, 4, 0, 2, 1]);
  });
  it("深い階層も再帰的に並べ替える", () => {
    const lv = [0, 1, 2, 2, 1];
    const v = [0, 5, 9, 4, 1];
    expect(run(lv, v)).toEqual([0, 4, 1, 3, 2]);
  });
  it("同順位は元の順序を保つ（安定）", () => {
    expect(run([0, 0, 0], [1, 1, 1])).toEqual([0, 1, 2]);
  });
  it("結果は元の行の並べ替え（過不足なし）で、階層が正しい列になる", () => {
    const lv = [0, 1, 1, 2, 0, 1];
    const order = run(lv, [9, 3, 8, 1, 2, 7]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    const after = order.map((i) => lv[i]);
    expect(normalizeLevels(after, after.length)).toEqual(after);
  });
  it("範囲の先頭が子の途中でも、より浅い行より前は動かさない", () => {
    // 行1,2 (深さ1) の後にルート 3,4。範囲は 1..4
    const lv = [0, 1, 1, 0, 0];
    const order = run(lv, [0, 9, 1, 5, 2], 1, 4);
    expect(order).toEqual([1, 2, 4, 3]);
  });
});

describe("flattenTree", () => {
  it("ネストしたノードを深さ優先で平坦にする", () => {
    const t = flattenTree([
      { values: ["A"], children: [{ values: ["A1"] }, { values: ["A2"], children: [{ values: ["A2a"] }], expanded: false }] },
      { values: ["B"] },
    ]);
    expect(t.data).toEqual([["A"], ["A1"], ["A2"], ["A2a"], ["B"]]);
    expect(t.levels).toEqual([0, 1, 1, 2, 0]);
    expect(t.expanded).toEqual([true, true, false, true, true]);
  });
});

describe("flattenTree: 元のノードを共有しない", () => {
  it("返した行を書き換えても、元のノードは変わらない", () => {
    const nodes = [{ values: ["A", 1] }];
    const t = flattenTree(nodes);
    t.data[0][0] = "changed";
    expect(nodes[0].values[0]).toBe("A");
  });
});

describe("開閉アイコンの寸法", () => {
  const cell = { x: 100, y: 50, w: 200, h: 28 };
  it("アイコンは階層ぶん右にずれ、縦は中央", () => {
    const b0 = treeToggleBox(cell, 0, 16);
    const b2 = treeToggleBox(cell, 2, 16);
    expect(b0).toEqual({ x: 100 + TREE_LEFT_PADDING, y: 50 + (28 - TREE_TOGGLE_SIZE) / 2, w: TREE_TOGGLE_SIZE, h: TREE_TOGGLE_SIZE });
    expect(b2.x - b0.x).toBe(32);
  });
  it("テキストのずれ量は階層に比例して増える", () => {
    expect(treeTextInset(2, 16) - treeTextInset(0, 16)).toBe(32);
    expect(treeTextInset(0, 16)).toBeGreaterThan(0);
  });
  it("クリック判定は、アイコンの周囲とセルの高さいっぱい", () => {
    const b = treeToggleBox(cell, 1, 16);
    expect(hitTreeToggle(cell, 1, 16, b.x + 2, cell.y + 1)).toBe(true);
    expect(hitTreeToggle(cell, 1, 16, b.x - 2, cell.y + 27)).toBe(true);
    expect(hitTreeToggle(cell, 1, 16, b.x + b.w + 10, cell.y + 5)).toBe(false);
    expect(hitTreeToggle(cell, 1, 16, b.x + 2, cell.y - 1)).toBe(false);
    // 子が深いほど右にずれるので、浅い位置のクリックは反応しない
    expect(hitTreeToggle(cell, 3, 16, b.x, cell.y + 5)).toBe(false);
  });
});
