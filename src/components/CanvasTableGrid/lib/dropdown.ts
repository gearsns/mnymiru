import type { DropdownOption } from "../types";

/** 入力中の文字列で選択肢を絞り込む（label、無ければ value の文字列表現に部分一致） */
export function filterDropdownOptions(options: DropdownOption[], query: string): DropdownOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => optionLabel(o).toLowerCase().includes(q));
}

/** 選択肢の表示ラベルを返す（label省略時は value の文字列表現） */
export function optionLabel(option: DropdownOption): string {
  return option.label ?? (option.value == null ? "" : String(option.value));
}

/** ↓/↑ キーでのハイライト移動先インデックスを求める（末尾/先頭で循環する） */
export function cycleHighlightIndex(current: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return -1;
  if (direction === 1) return (current + 1) % length;
  return current <= 0 ? length - 1 : current - 1;
}

export function clampHighlightIndex(current: number, length: number, direction: 1 | -1): number {
  if (length <= 0) return -1;
  const start = current === -1 ? (direction === 1 ? 0 : length - 1) : current + direction;
  return Math.max(0, Math.min(length - 1, start));
}
