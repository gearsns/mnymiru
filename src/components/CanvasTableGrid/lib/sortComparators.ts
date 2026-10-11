import type { CellValue } from "../types";

export type RowComparator = (a: CellValue[], b: CellValue[]) => number;

/** 指定列で比較。null/空は昇順・降順どちらでも末尾。数値は数値順、それ以外は自然順の文字列比較 */
export function byColumn(col: number, dir: "asc" | "desc" = "asc"): RowComparator {
    const sign = dir === "asc" ? 1 : -1;
    return (a, b) => {
        const x = a[col];
        const y = b[col];
        const xEmpty = x == null || x === "";
        const yEmpty = y == null || y === "";
        if (xEmpty && yEmpty) return 0;
        if (xEmpty) return 1;
        if (yEmpty) return -1;
        if (typeof x === "number" && typeof y === "number") return sign * (x - y);
        return sign * String(x).localeCompare(String(y), "ja", { numeric: true });
    };
}

/** 複数条件を優先順に合成（第1キーが同値なら第2キー…） */
export function combine(...comparators: RowComparator[]): RowComparator {
    return (a, b) => {
        for (const cmp of comparators) {
            const r = cmp(a, b);
            if (r !== 0) return r;
        }
        return 0;
    };
}
