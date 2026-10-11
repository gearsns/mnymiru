import type { CellValue } from "@/components/CanvasTableGrid";
import { ItemIndex } from "../constants";

export const rowsCompare = (
    a: CellValue[], b: CellValue[]
): number => {
    // 1. day の比較 (数値またはInfinity)
    const day = Number(a[0] ?? Infinity) - Number(b[0] ?? Infinity);
    if (day !== 0) {
        return day;
    }

    // 補助関数: 空白（null, undefined, ""）を判定して常に上(-1)にする
    const compareWithEmptyTop = (valA: CellValue, valB: CellValue): number => {
        const isEmptyA = valA == null || valA === "";
        const isEmptyB = valB == null || valB === "";

        // 両方空白なら等しい
        if (isEmptyA && isEmptyB) return 0;
        // Aだけ空白なら、Aを上にするため -1 を返す
        if (isEmptyA) return -1;
        // Bだけ空白なら、Bを上にするため 1 を返す
        if (isEmptyB) return 1;

        // どちらも空白でなければ通常の localeCompare
        return String(valA).localeCompare(String(valB));
    };

    // 2. time の比較 (index: 2)
    const time = compareWithEmptyTop(a[ItemIndex.time], b[ItemIndex.time]);
    if (time !== 0) {
        return time;
    }

    // 3. shop の比較 (index: 1)
    const shop = compareWithEmptyTop(a[ItemIndex.shop_name], b[ItemIndex.shop_name]);
    if (shop !== 0) {
        return shop;
    }

    // 4. name / account の比較 (index: 9)
    const account = compareWithEmptyTop(a[ItemIndex.account], b[ItemIndex.account]);
    if (account !== 0) {
        return account;
    }

    return 0;
};
