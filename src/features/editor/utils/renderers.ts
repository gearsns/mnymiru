import type { CellValue } from "@/components/CanvasTableGrid";
import type { TableData } from "@/db/types";
import { ItemIndex } from "../constants";

export const convertTableToCellValue = (data: TableData)
    : CellValue[][] => {
    const rows: CellValue[][] = [];
    for (const item of data) {
        if (item?.line_no !== undefined) {
            rows[item.line_no] =
                [
                    item.day || null,
                    item.shop_name ?? null,
                    item.time ?? null,
                    item.item_name ?? null,
                    item.detail ?? null,
                    item.expenses || null,
                    item.quantity || null,
                    item.incomes || null,
                    item.total || null,
                    item.account ?? null,
                    item.note ?? null
                ];
        }
    }
    const maxrow = Math.floor(rows.length / 1000 + 1) * 1000;
    rows[maxrow] = [];
    return rows;
}

export const convertCellValueToTable = (
    data: CellValue[][]
): TableData => {
    const rows = data.length;
    const tableData: TableData = [];
    for (let row = 0; row < rows; row++) {
        const item = data[row] ?? [];
        tableData.push({
            day: Number(item[ItemIndex.day] ?? 0) || 0,
            shop_name: String(item[ItemIndex.shop_name] ?? ""),
            time: String(item[ItemIndex.time] ?? ""),
            item_name: String(item[ItemIndex.item_name] ?? ""),
            detail: String(item[ItemIndex.detail] ?? ""),
            expenses: Number(item[ItemIndex.expenses] ?? 0),
            quantity: Number(item[ItemIndex.quantity] ?? 0),
            incomes: Number(item[ItemIndex.incomes] ?? 0),
            total: Number(item[ItemIndex.total] ?? 0),
            account: String(item[ItemIndex.account] ?? ""),
            note: String(item[ItemIndex.note] ?? ""),
        });
    }
    return tableData;
}
