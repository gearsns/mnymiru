import type { GridStore } from "@/components/CanvasTableGrid";
import { setNavigationTarget } from "@/store/dataStore";
import { ColumnIndexToName, ItemIndex } from "./constants";

export const setNavigation = (row: number, col: number, lines: number[], store: GridStore) => {
    const sheetId = String(store!.getCell(row, ItemIndex.year_month));
    let colName = ColumnIndexToName[col];
    if (colName === "year_month") {
        colName = "day";
    }
    setNavigationTarget({ row: lines[row], col: colName, sheetId });
}
