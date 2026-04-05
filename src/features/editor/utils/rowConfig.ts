import { RowKind, type TableData, type TableRow } from "../../../db/types"
import { isSameItem, isEmpty } from "./validation";

const COLS_SHOP: (keyof TableRow)[] = ['day', 'time', 'account', 'shop_name'];

export const setRowStyle = (rowData: TableRow, classList: string[]) => {
    if (rowData) {
        switch (rowData.kind) {
            case RowKind.TOP: classList.push('cell_row_top'); break;
            case RowKind.BODY: classList.push('cell_row_body'); break;
            case RowKind.BOTTOM: classList.push('cell_row_bottom'); break;
        }
    }
}

export const setConfgAll = (data: TableData) => {
    const rownum = data.length;
    for (let row = 0; row < rownum; ++row) {
        setConfg(data, row);
    }
}
export const setConfg = (data: TableData, row: number) => {
    const currentRow = data[row];
    if (!currentRow) {
        data[row] = { kind: RowKind.NONE, isSameDay: false, isSameShop: false, isSameTime: false, isSameAccount: false } as TableRow;
        return;
    }
    const prevRow = data[row - 1];
    const nextRow = data[row + 1];
    const isPrevMatch = !!prevRow && COLS_SHOP.every((value) => isSameItem(prevRow, currentRow, value));
    const isNextMatch = !!nextRow && COLS_SHOP.every((value) => isSameItem(nextRow, currentRow, value));

    // Kind判定
    const kind = (!isEmpty(currentRow.day) && !isEmpty(currentRow.shop_name))
        ? (isPrevMatch
            ? (isNextMatch ? RowKind.BODY : RowKind.BOTTOM)
            : (isNextMatch ? RowKind.TOP : RowKind.NONE))
        : RowKind.NONE;
    //
    const isSameDay = !!prevRow && currentRow.day !== null && isSameItem(prevRow, currentRow, 'day');
    const isSameShop = isSameDay && isSameItem(prevRow, currentRow, 'shop_name');
    const isSameTime = isSameShop && isSameItem(prevRow, currentRow, 'time');
    const isSameAccount = isSameTime && isSameItem(prevRow, currentRow, 'account');
    Object.assign(data[row], { kind, isSameDay, isSameShop, isSameTime, isSameAccount });
}
