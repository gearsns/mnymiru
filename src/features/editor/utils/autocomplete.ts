import type { CellValue, DropdownOption } from "@/components/CanvasTableGrid";
import { columnDefs } from "../constants";
import { isEmpty } from "@/utils";

export type ItemCount = [string, number];

export function isAutocompleteIndex(colIndex: number): boolean {
    const column = columnDefs[colIndex];
    // columnDefs[colIndex]?.type が "autocomplete" と一致するかチェック
    return column !== undefined && 'type' in column && column.type === 'autocomplete';
}

/**
 * データの出現回数を集計し、降順（同数の場合は辞書順）でソートする
 */
export function getSortedCounts(data: CellValue[][], col: number): DropdownOption[] {
    const counts = new Map<string, number>();
    for (const row of data) {
        const val = String(row[col] || "");
        if (!isEmpty(val)) counts.set(val, (counts.get(val) || 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map((item) => ({ value: item[0], label: item[0] }));
}

/**
 * 現在のデータとDBデータから、クエリにマッチするものを抽出する
 */
export function filterResults(
    curItems: DropdownOption[],
    dbItems: DropdownOption[],
    regex: RegExp,
    limit: number = 20
): DropdownOption[] {
    const result: DropdownOption[] = [];
    const seenValues = new Set<string>();

    const filter = (item: DropdownOption) => {
        if (result.length >= limit) return;
        if (item && item.value != null) {
            const valStr = String(item.value).trimEnd();
            if (regex.test(valStr)) {
                // value がまだ追加されていなければ結果に含める
                if (!seenValues.has(valStr)) {
                    seenValues.add(valStr);
                    result.push({ ...item, value: valStr, label: String(item.label || valStr).trim() });
                }
            }
        }
    };

    curItems.forEach((item) => filter(item));
    dbItems.forEach(item => filter(item));

    return result;
}
