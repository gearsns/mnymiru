import { describe, expect, it } from "vitest";
import { SCROLLBAR_SIZE } from "./scrollbar";
import { MIN_PANE_FLOOR, MIN_PANE_SIZE, clampPaneHeight, clampPaneWidth, hitSplitBar, maxPaneHeight, maxPaneWidth, minPaneSize } from "./split";

const base = { width: 440, height: 220, headerWidth: 40, headerHeight: 20, leftW: 100, topH: 40, splitCols: 1, splitRows: 2 };

describe("hitSplitBar", () => {
  it("縦のバー（左右 pane の境界）・横のバー（上下 pane の境界）・交点を判定する", () => {
    expect(hitSplitBar({ ...base, px: 140, py: 150 })).toEqual({ v: true, h: false });
    expect(hitSplitBar({ ...base, px: 143, py: 150 })).toEqual({ v: true, h: false }); // 余裕を含めてつかめる
    expect(hitSplitBar({ ...base, px: 300, py: 60 })).toEqual({ v: false, h: true });
    expect(hitSplitBar({ ...base, px: 140, py: 60 })).toEqual({ v: true, h: true }); // 交点
  });
  it("バーから離れていれば null", () => {
    expect(hitSplitBar({ ...base, px: 150, py: 150 })).toBeNull();
    expect(hitSplitBar({ ...base, px: 300, py: 100 })).toBeNull();
  });
  it("バーはスクロールバーの帯の中（キャンバスの端）まで貫いていて、つかめる。ヘッダの上・キャンバスの外は対象外", () => {
    expect(hitSplitBar({ ...base, px: 140, py: 220 - SCROLLBAR_SIZE + 2 })).toEqual({ v: true, h: false }); // 下端のスクロールバーの帯の中
    expect(hitSplitBar({ ...base, px: 140, py: 219 })).toEqual({ v: true, h: false }); // キャンバスの最下端
    expect(hitSplitBar({ ...base, px: 140, py: 220 })).toBeNull(); // キャンバスの外
    expect(hitSplitBar({ ...base, px: 440 - SCROLLBAR_SIZE + 2, py: 60 })).toEqual({ v: false, h: true }); // 右端のスクロールバーの帯の中
    expect(hitSplitBar({ ...base, px: 439, py: 60 })).toEqual({ v: false, h: true });
    expect(hitSplitBar({ ...base, px: 440, py: 60 })).toBeNull();
    expect(hitSplitBar({ ...base, px: 140, py: 10 })).toBeNull(); // 列ヘッダの高さ（列幅の変更に使うので対象外）
    expect(hitSplitBar({ ...base, px: 20, py: 60 })).toBeNull(); // 行ヘッダの幅
  });
  it("その向きに分割していなければ反応しない", () => {
    expect(hitSplitBar({ ...base, splitCols: 0, leftW: 0, px: 40, py: 150 })).toBeNull();
    expect(hitSplitBar({ ...base, splitRows: 0, topH: 0, px: 300, py: 20 })).toBeNull();
  });
});

describe("pane サイズの上限・下限", () => {
  it("右・下の pane に最低限の大きさを残す", () => {
    expect(maxPaneWidth(440, 40)).toBe(440 - 40 - SCROLLBAR_SIZE - MIN_PANE_SIZE);
    expect(maxPaneHeight(220, 20)).toBe(220 - 20 - SCROLLBAR_SIZE - MIN_PANE_SIZE);
  });
  it("指定値を最小〜上限に収める", () => {
    expect(clampPaneWidth(10, 440, 40)).toBe(MIN_PANE_SIZE);
    expect(clampPaneWidth(9999, 440, 40)).toBe(maxPaneWidth(440, 40));
    expect(clampPaneWidth(200, 440, 40)).toBe(200);
    expect(clampPaneHeight(0, 220, 20)).toBe(MIN_PANE_SIZE);
  });
  it("画面が小さくて収まらない場合は、左・上の pane の最小サイズを優先する", () => {
    expect(maxPaneWidth(60, 40)).toBe(MIN_PANE_SIZE);
    expect(clampPaneWidth(500, 60, 40)).toBe(MIN_PANE_SIZE);
  });
});

describe("minPaneSize: 左・上の pane の最小サイズ（先頭の列・行に合わせる）", () => {
  it("先頭の列（行）が 40px より小さければ、その大きさまで縮められる（1行だけの上 pane など）", () => {
    expect(minPaneSize(28)).toBe(28);
    expect(minPaneSize(39)).toBe(39);
  });
  it("先頭の列（行）が大きければ 40px まで（広い列は、狭い pane の中でスクロールして見る）", () => {
    expect(minPaneSize(40)).toBe(40);
    expect(minPaneSize(150)).toBe(MIN_PANE_SIZE);
  });
  it("極端に小さくても、下限（16px）より小さくならない", () => {
    expect(minPaneSize(5)).toBe(MIN_PANE_FLOOR);
    expect(minPaneSize(0)).toBe(MIN_PANE_FLOOR);
  });
  it("clamp に渡すと、その最小値までしか縮まず、広がることもない", () => {
    expect(clampPaneHeight(10, 220, 20, minPaneSize(28))).toBe(28); // 28px の1行だけの pane を縮めても 28px
    expect(clampPaneHeight(28, 220, 20, minPaneSize(28))).toBe(28); // 動かさなければそのまま（40 に広がらない）
    expect(clampPaneWidth(10, 440, 40, minPaneSize(150))).toBe(40);
    expect(clampPaneWidth(10, 440, 40)).toBe(MIN_PANE_SIZE); // 省略時は従来どおり 40
  });
  it("上限（右・下の pane に残す大きさ）は、左・上の最小値によらず変わらない", () => {
    expect(clampPaneHeight(9999, 220, 20, 16)).toBe(maxPaneHeight(220, 20));
  });
});
