import type { CellFormat, CellFormatContext } from "@/components/CanvasTableGrid";
import { getNumFormat } from "../utils/numFormatter";
import { getDayFormat, getYearMonthFormat } from "../utils/dayFormatter";
import { ItemIndex } from "./constants";

export const getCellFormat = (row: number, col: number, ctx: CellFormatContext)
    : CellFormat | undefined => {
    const { value, getCell } = ctx;
    if (col === ItemIndex.year_month) {
        return getYearMonthFormat(value);
    }
    if (col === ItemIndex.day) {
        return getDayFormat(getCell(row, ItemIndex.year_month), value);
    }
    if (col === ItemIndex.expenses) {
        return getNumFormat(-Number(value));
    }
    if (col === ItemIndex.quantity
        || col === ItemIndex.incomes
        || col === ItemIndex.total
    ) {
        return getNumFormat(Number(value));
    }
    return;
}
