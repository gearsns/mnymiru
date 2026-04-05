import type { CashTable } from "../../../db/types";
import { isEmpty } from "../../../utils";

export const calculateNumberStyle = (
    value: unknown,
    prop: string | number
): [string | undefined, string | undefined] => {
    let num: number | undefined;

    // 数値変換ロジック
    if (typeof value === 'string' && /^\s*[-0-9]+\s*$/.test(value)) {
        num = parseFloat(value);
    } else if (typeof value === 'number') {
        num = value;
    }

    if (num !== undefined) {
        const isExpenses = (prop as keyof CashTable) === "expenses";
        const className = (isExpenses === (num >= 0))
            ? 'cell_negative_num'
            : 'cell_positive_num';
        return [
            className,
            num === 0 ? "" : num.toLocaleString()
        ];
    }

    // エラー判定（isEmptyは既存のものを利用想定）
    if (!isEmpty(value)) {
        return ['cell_num_error', undefined];
    }

    return [undefined, undefined];
};
