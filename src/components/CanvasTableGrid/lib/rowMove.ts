/**
 * 行の移動（ドラッグ＆ドロップによる並べ替え・ツリーの階層変更）の「計画」を立てる純粋関数。
 * DOM・Solid・store には依存しない。実際の書き換えと履歴への記録は store/edits.ts が行う。
 *
 * 行はすべて「データ行」（元のデータ配列の行番号）で扱う。
 *
 * 移動の単位（ブロック）:
 *   ツリーでは、移動する行は子孫ごと（折りたたまれて見えない子孫も含めて）動く。
 *   選択した行の中に、別の選択行の子孫が含まれていれば、その行は親と一緒に動くので単独のブロックにはしない。
 *   移動する行どうしの前後関係（元の並び順）は保たれる。
 *
 * ドロップ位置（target.position）:
 *   "before" … target の直前（target と同じ階層の兄弟）
 *   "after"  … target の直後。ただし target が「子を持ち、展開されている」ときは、最初の子になる。
 *              それ以外（子がない／折りたたまれている）は、target の子孫の後ろ（target と同じ階層の兄弟）
 *   "inside" … target の最後の子（ツリーのみ。target が折りたたまれていれば展開する）
 *   ツリーでない場合は "before" / "after" のみ。
 */
import { hasChildren, normalizeLevels, subtreeEnd } from "./tree";

export type DropPosition = "before" | "after" | "inside";

export interface RowMovePlan {
  /** 書き換える範囲（データ行、両端を含む） */
  start: number;
  end: number;
  /** order[i] = 「start + i 行目に来る、元のデータ行」 */
  order: number[];
  /** ツリーのとき、範囲内の移動後の階層の深さ（order と同じ並び） */
  levels?: number[];
  /**
   * ツリーで "inside" の target が折りたたまれているとき、その行（元のデータ行）。移動時に展開する。
   * （開閉状態は行に付いて動く。Undo では開閉状態を戻さないので、ここでは「展開する行」だけを返す）
   */
  expandRow?: number;
  /** 移動するブロックの先頭行（元のデータ行、元の並び順） */
  heads: number[];
  /** 移動するすべての行（子孫を含む。元のデータ行、元の並び順） */
  moved: number[];
  /** moved の各行の、移動後のデータ行 */
  newIndices: number[];
  /** 移動後の、先頭行の階層の深さ（ツリーでなければ 0） */
  level: number;
}

export interface RowMoveInput {
  /** 全データ行の数 */
  count: number;
  /** 移動する行（データ行。順不同・重複可） */
  sources: number[];
  target: { row: number; position: DropPosition };
  /** ツリーのときだけ渡す */
  levels?: ArrayLike<number>;
  expanded?: ArrayLike<boolean>;
}

/**
 * 移動の計画を立てる。次の場合は null（移動できない／動きがない）:
 *   - 移動する行がない／範囲外
 *   - ドロップ先が、移動する行の中（自分自身・自分の子孫）
 *   - ツリーでないのに "inside" を指定した
 *   - 移動しても何も変わらない（同じ場所への移動）
 */
export function planRowMove(input: RowMoveInput): RowMovePlan | null {
  const { count, levels, expanded } = input;
  const tree = !!levels;
  const T = input.target.row;
  if (!(Number.isInteger(T) && T >= 0 && T < count)) return null;

  const sorted = [...new Set(input.sources.filter((r) => Number.isInteger(r) && r >= 0 && r < count))].sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  // 移動するブロック（先頭行〜子孫の最後の行）。別のブロックの子孫にあたる行は、その親と一緒に動く
  const blocks: Array<{ head: number; end: number }> = [];
  let lastEnd = -1;
  for (const s of sorted) {
    if (s <= lastEnd) continue;
    const end = tree ? subtreeEnd(levels!, s, count) : s;
    blocks.push({ head: s, end });
    lastEnd = end;
  }

  // 自分自身・自分の子孫の中へは移動できない
  if (blocks.some((b) => T >= b.head && T <= b.end)) return null;

  // 挿入位置 pos（元の行番号で「この行の直前」）、移動後の階層 level、target を展開する必要があるか
  let pos: number;
  let level = 0;
  let needExpand = false;
  if (!tree) {
    if (input.target.position === "inside") return null;
    pos = input.target.position === "before" ? T : T + 1;
  } else {
    const lv = levels!;
    const ex = expanded!;
    if (input.target.position === "before") {
      pos = T;
      level = lv[T];
    } else if (input.target.position === "after") {
      if (hasChildren(lv, T, count) && ex[T]) {
        pos = T + 1;
        level = lv[T] + 1;
      } else {
        pos = subtreeEnd(lv, T, count) + 1;
        level = lv[T];
      }
    } else {
      pos = subtreeEnd(lv, T, count) + 1;
      level = lv[T] + 1;
      needExpand = !ex[T];
    }
  }

  const moved: number[] = [];
  const isMoved = new Uint8Array(count);
  for (const b of blocks) {
    for (let r = b.head; r <= b.end; r++) {
      moved.push(r);
      isMoved[r] = 1;
    }
  }

  // 書き換える範囲: 移動する行・挿入位置・target（展開する場合）をすべて含む
  const lo = Math.min(blocks[0].head, pos, T);
  const hi = Math.max(blocks[blocks.length - 1].end, pos - 1, T);

  // 並べ替え後: 動かさない行のうち挿入位置より前 → 移動する行 → 挿入位置以降
  const before: number[] = [];
  const after: number[] = [];
  for (let r = lo; r <= hi; r++) {
    if (isMoved[r]) continue;
    (r < pos ? before : after).push(r);
  }
  const order = [...before, ...moved, ...after];

  const newIndex = new Map<number, number>();
  order.forEach((oldRow, i) => newIndex.set(oldRow, lo + i));
  const newIndices = moved.map((r) => newIndex.get(r)!);
  const heads = blocks.map((b) => b.head);

  const plan: RowMovePlan = { start: lo, end: hi, order, heads, moved, newIndices, level };

  if (tree) {
    const lv = levels!;
    // 移動する行の階層: ブロックの先頭行を level に合わせ、子孫も同じだけずらす
    const newLevelOf = new Map<number, number>();
    for (const b of blocks) {
      const delta = level - lv[b.head];
      for (let r = b.head; r <= b.end; r++) newLevelOf.set(r, lv[r] + delta);
    }
    const afterLevels = order.map((r) => newLevelOf.get(r) ?? lv[r]);

    // 階層が正しい並び（先頭は 0、各行は直前の行 + 1 以下）になっているか確認し、はみ出す分は丸める。
    // 範囲の外の行まで変わってしまう場合は、構造が壊れるので移動しない
    const full = Array.from({ length: count }, (_, i) => lv[i]);
    afterLevels.forEach((v, i) => (full[lo + i] = v));
    const norm = normalizeLevels(full, count);
    for (let i = 0; i < count; i++) {
      if (norm[i] !== full[i] && (i < lo || i > hi)) return null;
    }
    plan.levels = norm.slice(lo, hi + 1);
    if (needExpand) plan.expandRow = T;
  }

  // 何も変わらない移動は動きなしとして扱う
  const sameOrder = order.every((r, i) => r === lo + i);
  if (sameOrder) {
    if (!tree) return null;
    const lv = levels!;
    const sameLevels = plan.levels!.every((v, i) => v === lv[lo + i]);
    if (sameLevels && !needExpand) return null;
  }
  return plan;
}
