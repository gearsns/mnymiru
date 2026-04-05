import { isEmpty } from "lodash";
import type { TableData, TableRow } from "../../../db/types";

export type ItemCount = [string, number];

/**
 * データの出現回数を集計し、降順（同数の場合は辞書順）でソートする
 */
export function getSortedCounts(data: TableData, colName: keyof TableRow): ItemCount[] {
  const counts = new Map<string, number>();
  for (const row of data) {
    const val = String(row[colName] || "");
	if (!isEmpty(val)) counts.set(val, (counts.get(val) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * 現在のデータとDBデータから、クエリにマッチするものを抽出する
 */
export function filterResults(
  curItems: ItemCount[],
  dbItems: { value: string }[],
  regex: RegExp,
  limit: number = 20
): string[] {
  const result = new Set<string>();

  const filter = (val: string) => {
    if (result.size >= limit) return;
    if (val && regex.test(val)) result.add(val);
  };

  curItems.forEach(([val]) => filter(val));
  dbItems.forEach(item => filter(item.value));

  return Array.from(result);
}