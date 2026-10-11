import { formatDate, type CellFormat, type CellValue } from "@/components/CanvasTableGrid";
import { getNumFormat } from "@/features/common/utils/numFormatter";
import { ItemIndex } from "../constants";
import { getLastDayOfMonth } from "@/utils";

export const getCellFormat = (
    row: number, col: number
    , value: CellValue
    , getCell: (row: number, col: number) => CellValue
    , date: Date
): CellFormat | undefined => {
    if (!value) return { type: "text" };
    if (col === ItemIndex.day) {
        let day = Number(value);
        if (day <= 0) {
            return { type: "text" };
        }
        let rowDay = new Date(date);
        const lastDay = getLastDayOfMonth(rowDay);
        if (day > lastDay) {
            return {
                color: "#ff0000",
                type: "text"
            };
        }
        rowDay.setDate(day);
        const rowDate = `${rowDay.getFullYear()}/${rowDay.getMonth() + 1}/${rowDay.getDate()}`;

        let color = "#000000";
        switch (rowDay.getDay()) {
            case 0: color = "#ff7f50"; break; // 日曜
            case 6: color = "#6495ed"; break; // 土曜
        }
        const preDay = Number(getCell(row - 1, col));
        const isSameDay = preDay === day;
        if (isSameDay) {
            color += "44";
        }
        return {
            color,
            border: isSameDay ? { top: false } : undefined,
            type: "date",
            align: "right",
            formatter: (): string => formatDate(rowDate, "D(ddd)")
        };
    }
    if (col === ItemIndex.shop_name || col === ItemIndex.time) {
        let preDay = Number(getCell(row - 1, ItemIndex.day));
        let day = Number(getCell(row, ItemIndex.day));
        if (day > 0 && preDay === day
            && getCell(row - 1, ItemIndex.shop_name) == getCell(row, ItemIndex.shop_name)
            && getCell(row - 1, ItemIndex.time) == getCell(row, ItemIndex.time)
            && getCell(row - 1, ItemIndex.account) == getCell(row, ItemIndex.account)
        ) {
            return {
                type: "text",
                color: "#aaa",
                border: { top: false },
            };
        }
    }
    if (col === ItemIndex.expenses) {
        return getNumFormat(-Number(value));
    }
    if (col === ItemIndex.incomes || col === ItemIndex.quantity || col === ItemIndex.total) {
        return getNumFormat(Number(value));
    }
    return { type: "text" };
}
