import dayjs from "dayjs";
import { sqliteClient } from "../../../../services/sqliteClient";
import { isEmpty, setConfg } from "../../utils";
import type { TableRow } from "../../../../db/types";

// 内訳をもとに過去のデータを参照して項目、口座を自動で設定
export const updateRelatedData = async (hot: Handsontable, row: number, col: keyof TableRow) => {
    const curRow = hot.getSourceDataAtRow(row) as TableRow;
    if (col !== 'detail' || isEmpty(curRow) || (!isEmpty(curRow.item_name) && !isEmpty(curRow.account))) {
        return;
    }
    const detailValue = curRow.detail || "";
    const threeYearsAgo = Number(dayjs().subtract(3, 'year').format('YYYYMM'));
    const changes: [number, keyof TableRow, string | number][] = [];
    const [itemRes, accountRes] = await Promise.all([
        isEmpty(curRow.item_name)
            ? sqliteClient.fetchTopItemByColumn("detail", "item_name", detailValue, threeYearsAgo)
            : Promise.resolve(null),
        isEmpty(curRow.account)
            ? sqliteClient.fetchTopItemByColumn("detail", "account", detailValue, threeYearsAgo)
            : Promise.resolve(null)
    ]);
    if (itemRes && itemRes.cnt > 0) {
        changes.push([row, 'item_name', itemRes.value]);
    }
    if (accountRes && accountRes.cnt > 0) {
        changes.push([row, 'account', accountRes.value]);
    }
    if (changes.length > 0) {
        hot.setDataAtRowProp(changes, "RelatedData!");
    }
}

// 行設定の更新 (前後1行を含む)
export const updateRelatedConfig = (changes: [number, string | number, unknown, unknown][], currentData: TableRow[], processRow = setConfg) => {
    const rows = new Set<number>();
    changes.forEach(([row]) => {
        rows.add(row);
        rows.add(row - 1);
        rows.add(row + 1);
    });
    [...rows].sort().forEach((row) => {
        if (row >= 0 && row < currentData.length) {
            processRow(currentData, row);
        }
    })
}

export const getTimeString = (value: string): string | undefined => {
    // 1. 基本的なバリデーション（空文字や不正な文字を弾く）
    if (!value || !/^\d+:?\d*$/.test(value)) return undefined;

    const [h, m] = value.includes(':')
        ? value.split(':')  // コロンで分割（"9:5" -> ["9", "5"]）
        : value.length <= 2 // 数値のみの場合: 後ろから2桁を分、それ以外を時とする
            ? [value, '0']
            : [value.slice(0, -2), value.slice(-2)];

    // 2. 時・分それぞれを2桁にパディング（分が空なら "00"）
    const formattedH = h.padStart(2, '0');
    const formattedM = (m || '0').padStart(2, '0');

    return `${formattedH}:${formattedM}`;
};
