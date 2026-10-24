import { describe, expect, it } from "vitest";
import { planRowMove } from "./rowMove";
import { normalizeLevels } from "./tree";

//  0 A ─┬ 1 A1
//       └ 2 A2 ─┬ 3 A2a
//               └ 4 A2b
//  5 B ── 6 B1
//  7 C
const levels = [0, 1, 1, 2, 2, 0, 1, 0];
const allOpen = Array(8).fill(true);
const names = ["A", "A1", "A2", "A2a", "A2b", "B", "B1", "C"];

/** 計画を適用した結果（名前の並びと階層）を返す */
function apply(plan: NonNullable<ReturnType<typeof planRowMove>>, lv = levels) {
  const n = names.slice();
  const l = lv.slice();
  plan.order.forEach((old, i) => {
    n[plan.start + i] = names[old];
    l[plan.start + i] = plan.levels![i];
  });
  return { names: n, levels: l };
}
const tree = (sources: number[], row: number, position: "before" | "after" | "inside", ex = allOpen) =>
  planRowMove({ count: 8, sources, target: { row, position }, levels, expanded: ex });

describe("ツリーでない行の移動", () => {
  const flat = (sources: number[], row: number, position: "before" | "after") => planRowMove({ count: 6, sources, target: { row, position } });
  const run = (p: ReturnType<typeof flat>) => {
    const base = ["a", "b", "c", "d", "e", "f"];
    const out = base.slice();
    p!.order.forEach((old, i) => (out[p!.start + i] = base[old]));
    return out;
  };

  it("1行を前方・後方へ移動", () => {
    expect(run(flat([4], 1, "before"))).toEqual(["a", "e", "b", "c", "d", "f"]);
    expect(run(flat([1], 4, "after"))).toEqual(["a", "c", "d", "e", "b", "f"]);
    expect(run(flat([0], 5, "after"))).toEqual(["b", "c", "d", "e", "f", "a"]);
    expect(run(flat([5], 0, "before"))).toEqual(["f", "a", "b", "c", "d", "e"]);
  });
  it("複数行（離れていても）は元の並び順のまま、まとめて移動する", () => {
    expect(run(flat([1, 3], 5, "after"))).toEqual(["a", "c", "e", "f", "b", "d"]);
    expect(run(flat([3, 1], 0, "before"))).toEqual(["b", "d", "a", "c", "e", "f"]);
    expect(run(flat([1, 2], 4, "before"))).toEqual(["a", "d", "b", "c", "e", "f"]);
  });
  it("書き換える範囲は必要な部分だけ", () => {
    const p = flat([1], 3, "after")!;
    expect([p.start, p.end]).toEqual([1, 3]);
  });
  it("移動できない・動かない場合は null", () => {
    expect(flat([2], 2, "before")).toBeNull(); // 自分自身
    expect(flat([2, 3], 3, "after")).toBeNull(); // 移動する行の中
    expect(flat([2], 3, "before")).toBeNull(); // 同じ位置
    expect(flat([2], 1, "after")).toBeNull(); // 同じ位置
    expect(flat([], 1, "before")).toBeNull();
    expect(flat([9], 1, "before")).toBeNull();
    expect(planRowMove({ count: 6, sources: [1], target: { row: 3, position: "inside" } })).toBeNull(); // ツリーでない
  });
  it("新しい位置を返す", () => {
    const p = flat([1, 3], 5, "after")!;
    expect(p.moved).toEqual([1, 3]);
    expect(p.newIndices).toEqual([4, 5]);
  });
});

describe("ツリーの移動: before / after", () => {
  it("子ごと兄弟として前へ移動し、階層は移動先に合わせる", () => {
    // B(子B1つき) を A2 の前へ → A2 と兄弟(階層1)、B1 は階層2
    const r = apply(tree([5], 2, "before")!);
    expect(r.names).toEqual(["A", "A1", "B", "B1", "A2", "A2a", "A2b", "C"]);
    expect(r.levels).toEqual([0, 1, 1, 2, 1, 2, 2, 0]);
  });
  it("ルートの前へ移動すると階層が浅くなる", () => {
    // A2(子A2a,A2b) を B の前へ → ルート(階層0)、子は階層1
    const r = apply(tree([2], 5, "before")!);
    expect(r.names).toEqual(["A", "A1", "A2", "A2a", "A2b", "B", "B1", "C"]);
    expect(r.levels).toEqual([0, 1, 0, 1, 1, 0, 1, 0]);
  });
  it("after: 子がない行の後ろ → 兄弟", () => {
    // C を A1 の後ろへ → A1 と兄弟(階層1)
    const r = apply(tree([7], 1, "after")!);
    expect(r.names).toEqual(["A", "A1", "C", "A2", "A2a", "A2b", "B", "B1"]);
    expect(r.levels).toEqual([0, 1, 1, 1, 2, 2, 0, 1]);
  });
  it("after: 展開されている親の後ろ → 最初の子", () => {
    // C を B(展開) の after → B の最初の子（階層1、B1 の前）
    const r = apply(tree([7], 5, "after")!);
    expect(r.names).toEqual(["A", "A1", "A2", "A2a", "A2b", "B", "C", "B1"]);
    expect(r.levels).toEqual([0, 1, 1, 2, 2, 0, 1, 1]);
  });
  it("after: 折りたたまれた親の後ろ → 子孫の後ろの兄弟", () => {
    const ex = allOpen.slice(); ex[5] = false;
    // C は B(折りたたみ) の子孫の後ろ（= B の after）にすでにいるので、動きなし
    expect(tree([7], 5, "after", ex)).toBeNull();
    // A を B(折りたたみ) の after → B のサブツリーの後ろ
    const r2 = apply(tree([0], 5, "after", ex)!);
    expect(r2.names).toEqual(["B", "B1", "A", "A1", "A2", "A2a", "A2b", "C"]);
    expect(r2.levels).toEqual([0, 1, 0, 1, 1, 2, 2, 0]);
  });
});

describe("ツリーの移動: inside（子にする）", () => {
  it("最後の子になり、階層は target + 1", () => {
    const r = apply(tree([7], 5, "inside")!);
    expect(r.names).toEqual(["A", "A1", "A2", "A2a", "A2b", "B", "B1", "C"]);
    expect(r.levels).toEqual([0, 1, 1, 2, 2, 0, 1, 1]);
  });
  it("子のなかった行の子にする → 親になり、開閉は展開される", () => {
    const ex = allOpen.slice(); ex[7] = false;
    const p = tree([6], 7, "inside", ex)!; // B1 を C の中へ
    const r = apply(p);
    expect(r.names).toEqual(["A", "A1", "A2", "A2a", "A2b", "B", "C", "B1"]);
    expect(r.levels).toEqual([0, 1, 1, 2, 2, 0, 0, 1]);
    // C は折りたたまれているので、移動時に展開する行として返る（展開は履歴に積まず、Undo でも戻さない）
    expect(p.expandRow).toBe(7);
  });
  it("折りたたまれた target に入れると展開される", () => {
    const ex = allOpen.slice(); ex[5] = false;
    const p = tree([7], 5, "inside", ex)!;
    expect(p.expandRow).toBe(5);
  });
  it("すでに展開されている target には、展開する行は付かない", () => {
    expect(tree([7], 5, "inside")!.expandRow).toBeUndefined();
    expect(tree([7], 2, "before")!.expandRow).toBeUndefined();
  });
  it("上にある行を下の行の子にしても、 target の位置が正しく追従する", () => {
    // A1 を C の中へ
    const r = apply(tree([1], 7, "inside")!);
    expect(r.names).toEqual(["A", "A2", "A2a", "A2b", "B", "B1", "C", "A1"]);
    expect(r.levels).toEqual([0, 1, 2, 2, 0, 1, 0, 1]);
  });
});

describe("ツリーの移動: ブロックと禁止", () => {
  it("折りたたまれて見えない子孫も一緒に動く", () => {
    const p = tree([2], 7, "after")!; // A2 を C の後ろへ
    expect(p.moved).toEqual([2, 3, 4]);
    const r = apply(p);
    expect(r.names).toEqual(["A", "A1", "B", "B1", "C", "A2", "A2a", "A2b"]);
    expect(r.levels).toEqual([0, 1, 0, 1, 0, 0, 1, 1]);
  });
  it("選択に親と子が両方入っていれば、親のブロックにまとまる", () => {
    const p = tree([2, 3, 4], 7, "after")!;
    expect(p.heads).toEqual([2]);
    expect(p.moved).toEqual([2, 3, 4]);
  });
  it("複数のブロックは同じ階層に揃い、元の前後関係を保つ", () => {
    // A1(階層1) と B(階層0, 子B1) を C の後ろへ → どちらも階層0
    const r = apply(tree([5, 1], 7, "after")!);
    expect(r.names).toEqual(["A", "A2", "A2a", "A2b", "C", "A1", "B", "B1"]);
    expect(r.levels).toEqual([0, 1, 2, 2, 0, 0, 0, 1]);
  });
  it("自分自身・自分の子孫の中へは移動できない", () => {
    expect(tree([0], 0, "inside")).toBeNull();
    expect(tree([0], 3, "before")).toBeNull();
    expect(tree([2], 4, "after")).toBeNull();
    expect(tree([0], 2, "inside")).toBeNull();
  });
  it("動きがなければ null（同じ親の同じ位置）", () => {
    expect(tree([1], 2, "before")).toBeNull(); // A1 は A2 の前にすでにいる
    expect(tree([7], 5, "after", allOpen.map((_, i) => i !== 5))).toBeNull();
  });
  it("階層だけが変わる移動は有効（位置は同じ）", () => {
    // A2b を A2 の子から、A2 の次の兄弟へ（A2 の after は展開中なので最初の子…なので before B にする）
    const p = tree([4], 5, "before");
    expect(p).not.toBeNull();
    expect(apply(p!).levels).toEqual([0, 1, 1, 2, 0, 0, 1, 0]);
  });
  it("移動後の階層は常に正しい並び（先頭 0、各行は直前 + 1 以下）", () => {
    for (const src of [[0], [1], [2], [5], [7], [1, 5]]) {
      for (let t = 0; t < 8; t++) {
        for (const pos of ["before", "after", "inside"] as const) {
          const p = tree(src, t, pos);
          if (!p) continue;
          const lv = apply(p).levels;
          expect(normalizeLevels(lv, lv.length)).toEqual(lv);
          expect([...p.order].sort((a, b) => a - b)).toEqual(Array.from({ length: p.end - p.start + 1 }, (_, i) => p.start + i));
        }
      }
    }
  });
});
