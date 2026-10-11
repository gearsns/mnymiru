import type { CashTable } from "@/db/types";
import type { CellValue } from "@/components/CanvasTableGrid";

export const convertCashTableToCellValue = (data: CashTable[])
    : { rows: CellValue[][], lines: number[] } => {
    const lines: number[] = [];
    const rows: CellValue[][] = [];
    for (const item of data) {
        rows.push(
            [
                item.year_month,
                item.day,
                item.shop_name,
                item.time,
                item.item_name,
                item.detail,
                item.expenses || null,
                item.quantity || null,
                item.incomes || null,
                item.total || null,
                item.account,
                item.note
            ]
        );
        lines.push(item.line_no);
    }
    return { rows, lines };
}
