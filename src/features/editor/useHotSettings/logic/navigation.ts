import type { TableData, TableRow } from "../../../../db/types";
import { isEmpty } from "../../utils";

// カラムごとの移動先候補を定義（メンテナンス性が向上します）
const NAVIGATION_TARGETS: Partial<Record<keyof TableRow, { isNextRow?: boolean, colmuns: (keyof TableRow)[] }>> = {
    ['shop_name']: { colmuns: ['day', 'time', 'detail', 'expenses'] },
    ['item_name']: { colmuns: ['day', 'shop_name', 'detail', 'expenses'] },
    ['time']: { colmuns: ['day', 'shop_name', 'detail', 'expenses'] },
    ['detail']: { colmuns: ['day', 'shop_name', 'expenses'] },
    ['expenses']: { isNextRow: true, colmuns: ['detail', 'day', 'shop_name', 'time', 'expenses'] },
    ['incomes']: { isNextRow: true, colmuns: ['detail', 'day', 'shop_name', 'time', 'incomes'] },
    ['total']: { isNextRow: true, colmuns: ['detail', 'day', 'shop_name', 'time', 'incomes'] },
};

export const getNextFocus = (
    currentRow: number,
    currentCol: keyof TableRow,
    data: TableData
): [number, keyof TableRow] | undefined => {
    const targets = NAVIGATION_TARGETS[currentCol];
    if (!targets) return;

    const rowOffset = targets.isNextRow ? 1 : 0;
    for (const targetCol of targets.colmuns) {
        const targetRow = currentRow + rowOffset;
        if (targetRow >= 0 && targetRow < data.length) {
            if (isEmpty(data[targetRow][targetCol])) {
                return [targetRow, targetCol];
            }
        }
    }
};