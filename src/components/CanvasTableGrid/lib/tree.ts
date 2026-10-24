/**
 * ツリーグリッドの純粋関数。DOM・Solid・store には依存しない。
 *
 * データは「深さ優先（親の直後に子が並ぶ）」の平坦な行配列で持ち、各行の階層の深さを
 * levels[row]（0 = ルート）で表す。ある行の子孫は、その直後に続く「より深い行」の連なり。
 *
 *   levels = [0, 1, 1, 2, 0]
 *     行0 ─┬ 行1
 *          └ 行2 ── 行3
 *     行4
 */
import type { CellValue } from "../types";
import { TEXT_PADDING, type Rect } from "./geometry";

// ---------------------------------------------------------------------------
// 階層の正規化・構造
// ---------------------------------------------------------------------------

/**
 * levels を「正しい深さ優先の並び」に正規化する。
 * - 長さを count に合わせる（不足は 0 = ルート）
 * - 先頭は必ず 0
 * - 各行は 0 以上、かつ「直前の行の深さ + 1」を超えない（親のいない深い行が生まれないように）
 */
export function normalizeLevels(levels: ArrayLike<number> | undefined, count: number): number[] {
  const out: number[] = new Array(count);
  let prev = -1;
  for (let i = 0; i < count; i++) {
    const raw = levels?.[i];
    let lv = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 0;
    lv = Math.max(0, Math.min(lv, prev + 1));
    out[i] = lv;
    prev = lv;
  }
  return out;
}

/** 行 i が子を持つか（直後の行のほうが深ければ子がある） */
export function hasChildren(levels: ArrayLike<number>, i: number, count = levels.length): boolean {
  return i + 1 < count && levels[i + 1] > levels[i];
}

/** 行 i の子孫の最後の行（子孫がなければ i 自身）。levels[i] より深い行が続く間が子孫 */
export function subtreeEnd(levels: ArrayLike<number>, i: number, count = levels.length): number {
  let j = i;
  while (j + 1 < count && levels[j + 1] > levels[i]) j++;
  return j;
}

/** 行 i の親の行番号（ルートなら -1）。前方へさかのぼって、最初に見つかる「より浅い行」 */
export function parentOf(levels: ArrayLike<number>, i: number): number {
  for (let j = i - 1; j >= 0; j--) if (levels[j] < levels[i]) return j;
  return -1;
}

/** expanded の初期指定から、行ごとの開閉状態の配列を作る（既定はすべて展開） */
export function initExpanded(
  spec: boolean | boolean[] | ((row: number) => boolean) | undefined,
  count: number
): boolean[] {
  const out: boolean[] = new Array(count);
  for (let i = 0; i < count; i++) {
    if (spec === undefined) out[i] = true;
    else if (typeof spec === "boolean") out[i] = spec;
    else if (Array.isArray(spec)) out[i] = spec[i] ?? true;
    else out[i] = !!spec(i);
  }
  return out;
}

/**
 * 画面に表示される行（データ行の番号）を、表示順に求める。
 * 折りたたまれた行の子孫は含まれない。
 */
export function computeVisibleRows(levels: ArrayLike<number>, expanded: ArrayLike<boolean>, count = levels.length): number[] {
  const visible: number[] = [];
  let skipBelow = Infinity; // この深さより深い行は、折りたたまれた祖先の中にある
  for (let i = 0; i < count; i++) {
    if (levels[i] > skipBelow) continue;
    skipBelow = Infinity;
    visible.push(i);
    if (hasChildren(levels, i, count) && !expanded[i]) skipBelow = levels[i];
  }
  return visible;
}

// ---------------------------------------------------------------------------
// ソート
// ---------------------------------------------------------------------------

/**
 * 行 start〜end（データ行）をツリーの構造を保ったまま並べ替えた結果を求める。
 * 「同じ親の下にある兄弟どうし」を compare で並べ替え、各行は子孫ごと（サブツリー単位）で移動する。
 *
 * 戻り値 order[i] は「start + i 番目に来る、元のデータ行番号」。
 * 範囲の先頭が子の途中（親が範囲の外にある）の場合、最も浅い行より前の行は位置を変えない。
 */
export function planTreeSort(
  levels: ArrayLike<number>,
  start: number,
  end: number,
  compare: (a: number, b: number) => number
): number[] {
  const out: number[] = [];

  function sortRange(lo: number, hi: number) {
    if (lo > hi) return;
    let base = Infinity;
    for (let i = lo; i <= hi; i++) if (levels[i] < base) base = levels[i];

    // 最も浅い行より前に取り残された行は、並べ替えずそのまま
    let i = lo;
    while (i <= hi && levels[i] > base) out.push(i++);

    // 最も浅い行ごとにブロック（その行 + 子孫）に分け、ブロックの先頭行どうしを比較して並べ替える
    const blocks: Array<{ head: number; last: number }> = [];
    while (i <= hi) {
      let j = i + 1;
      while (j <= hi && levels[j] > base) j++;
      blocks.push({ head: i, last: j - 1 });
      i = j;
    }
    blocks.sort((a, b) => compare(a.head, b.head) || a.head - b.head);

    for (const b of blocks) {
      out.push(b.head);
      sortRange(b.head + 1, b.last); // 子孫も同様に、兄弟どうしで並べ替える
    }
  }

  sortRange(start, end);
  return out;
}

// ---------------------------------------------------------------------------
// ネストしたデータ → 平坦なデータ
// ---------------------------------------------------------------------------

/** ネストしたツリー形式のデータの1ノード */
export interface TreeNode {
  /** この行の各列の値 */
  values: CellValue[];
  /** 子ノード */
  children?: TreeNode[];
  /** 初期状態で展開するか（省略時は true） */
  expanded?: boolean;
}

export interface FlatTree {
  /** 深さ優先で並べた各行の値（GridOptions.data にそのまま渡せる） */
  data: CellValue[][];
  /** 各行の階層の深さ（GridOptions.tree.levels に渡す） */
  levels: number[];
  /** 各行の初期の開閉状態（GridOptions.tree.expanded に渡す） */
  expanded: boolean[];
}

/** ネストしたツリー形式のデータを、グリッドに渡せる平坦な形式（深さ優先）へ変換する（各行は複製される） */
export function flattenTree(nodes: TreeNode[]): FlatTree {
  const data: CellValue[][] = [];
  const levels: number[] = [];
  const expanded: boolean[] = [];
  const walk = (list: TreeNode[], level: number) => {
    for (const node of list) {
      data.push(node.values.slice()); // グリッドの編集が元のノードを書き換えないよう、行をコピーする
      levels.push(level);
      expanded.push(node.expanded ?? true);
      if (node.children?.length) walk(node.children, level + 1);
    }
  };
  walk(nodes, 0);
  return { data, levels, expanded };
}

// ---------------------------------------------------------------------------
// 開閉アイコン・インデントの寸法（描画とクリック判定で同じ値を使う）
// ---------------------------------------------------------------------------

/** 既定のインデント幅(px/階層) */
export const DEFAULT_TREE_INDENT = 16;
/** セルの左端から、最初の階層のアイコンまでの余白 */
export const TREE_LEFT_PADDING = 4;
/** 開閉アイコンの一辺 */
export const TREE_TOGGLE_SIZE = 12;
/** アイコンとテキストの間隔 */
export const TREE_TOGGLE_GAP = 4;

/** 開閉アイコンを描く正方形の位置（cell はセルの矩形） */
export function treeToggleBox(cell: Rect, level: number, indent: number): Rect {
  return {
    x: cell.x + TREE_LEFT_PADDING + level * indent,
    y: cell.y + (cell.h - TREE_TOGGLE_SIZE) / 2,
    w: TREE_TOGGLE_SIZE,
    h: TREE_TOGGLE_SIZE,
  };
}

/**
 * ツリー列のテキストを右へずらす量。
 * テキストは通常セルの左端 + TEXT_PADDING から始まるので、
 * 「インデント + アイコン + 間隔」の位置に始まるよう、その差分を返す。
 */
export function treeTextInset(level: number, indent: number): number {
  return Math.max(0, TREE_LEFT_PADDING + level * indent + TREE_TOGGLE_SIZE + TREE_TOGGLE_GAP - TEXT_PADDING);
}

/**
 * セル内の座標 (px, py) が開閉アイコンの上か。クリックしやすいよう、
 * アイコンの左右には余白を持たせ、縦はセルの高さいっぱいを対象にする。
 */
export function hitTreeToggle(cell: Rect, level: number, indent: number, px: number, py: number): boolean {
  const box = treeToggleBox(cell, level, indent);
  const slop = 3;
  return px >= box.x - slop && px <= box.x + box.w + slop && py >= cell.y && py < cell.y + cell.h;
}
