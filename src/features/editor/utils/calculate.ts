import { type CellValue, type SelectionRange } from "@/components/CanvasTableGrid/types";
import { formatNumber } from "@/components/CanvasTableGrid/format";
import { ItemIndex } from "../constants";

export const calculateRange = (
    range: SelectionRange
    , getCell: (row: number, col: number) => CellValue
): string => {
    const row = range.r1;
    const col = range.c1;
    if (range.c1 === range.c2 && range.r1 === range.r2) {
        return String(getCell(row, col) ?? "");
    }
    let total = 0;
    for (let r = range.r1; r <= range.r2; r++) {
        const val = Number(getCell(r, ItemIndex.total));
        if (!isNaN(val)) {
            total += val;
        }
    }
    return `選択範囲の合計：${formatNumber(total, "#,##0")}`;
}

export const calculateShopTotal = (
    row: number, rows: number
    , getCell: (row: number, col: number) => CellValue
): string => {
    const shopName = getCell(row, ItemIndex.shop_name);
    if (!shopName) {
        return "";
    }
    const targetKey = {
        day: getCell(row, ItemIndex.day),
        shopName: shopName,
        time: getCell(row, ItemIndex.time),
        account: getCell(row, ItemIndex.account),
    };

    let total = Number(getCell(row, ItemIndex.total));
    const isMatchingRow = (r: number) => {
        return (
            getCell(r, ItemIndex.day) === targetKey.day &&
            getCell(r, ItemIndex.shop_name) === targetKey.shopName &&
            getCell(r, ItemIndex.time) === targetKey.time &&
            getCell(r, ItemIndex.account) === targetKey.account
        );
    };

    for (let r = row - 1; r >= 0; r--) {
        if (isMatchingRow(r)) {
            const val = Number(getCell(r, ItemIndex.total));
            if (!isNaN(val)) total += val;
        } else {
            break;
        }
    }
    for (let r = row + 1; r < rows; r++) {
        if (isMatchingRow(r)) {
            const val = Number(getCell(r, ItemIndex.total));
            if (!isNaN(val)) total += val;
        } else {
            break;
        }
    }
    return `${shopName} ${formatNumber(total, "#,##0")}`;
}
