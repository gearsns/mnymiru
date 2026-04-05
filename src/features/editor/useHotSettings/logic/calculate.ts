import { isEmpty } from "lodash";
import { RowKind, type TableData, type TableRow } from "../../../../db/types";
import { getTimeString } from "./change";
import { isSameItem } from "../../utils";

const toNumber = (val: unknown): number => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const COPY_TARGETS: Partial<Record<keyof TableRow, (keyof TableRow)[]>> = {
    ['shop_name']: ['day', 'account'],
    ['time']: ['day', 'shop_name', 'account'],
    ['detail']: ['day', 'shop_name', 'time', 'account'],
    ['expenses']: ['day', 'shop_name', 'time', 'account'],
    ['incomes']: ['day', 'shop_name', 'time', 'account'],
    ['quantity']: ['day', 'shop_name', 'time', 'account'],
    ['account']: ['day', 'shop_name', 'time'],
}

export type ChangeItem = [number, string | number, unknown, unknown];
/**
 * 変更内容と現在のテーブルデータを受け取り、
 * 自動補完や計算を適用した後の「最終的な変更リスト」を返す
 */
export const calculateTableChanges = (
    initialChanges: ChangeItem[],
    currentData: TableRow[],
    source: string
): ChangeItem[] => {
    const afterData = structuredClone(currentData);
    // 処理スキップ判定
    const isAutoProcessSource = !["UndoRedo.undo", "UndoRedo.redo", "Sort!", "Duplicate!"].includes(source);

    // 最終的な変更を保持するマップ (row-col -> change)
    const finalChangesMap = new Map<string, [number, keyof TableRow, unknown, unknown]>();
    // ヘルパー: changesとafterDataを同時に更新
    const applyChange = <K extends keyof TableRow>(row: number, col: K, newValue: unknown) => {
        if (!afterData[row]) {
            afterData[row] = {};
        }

        const oldValue = afterData[row][col];
        // 無効な型（Object等）を文字列に変換
        const sanitizedValue = (newValue !== null && newValue !== undefined &&
            typeof newValue !== "string" && typeof newValue !== "number")
            ? "" : newValue;

        afterData[row][col] = sanitizedValue as TableRow[K];

        const key = `${row}-${col}`;
        if (finalChangesMap.has(key)) {
            finalChangesMap.get(key)![3] = sanitizedValue;
        } else {
            finalChangesMap.set(key, [row, col, oldValue, sanitizedValue]);
        }
    };
    // ヘルパー: 合計計算
    const updateTotal = (row: number) => {
        const rowData = afterData[row];
        if (!rowData) return;
        let num = toNumber(rowData.quantity);
        if (num === 0) num = 1;
        const income = toNumber(rowData.incomes);
        const expend = toNumber(rowData.expenses);
        const total = (income - expend) * num;
        applyChange(row, 'total', total);
    };
    // 2. メイン処理：初期変更の適用
    let bHasValidInput = false;
    for (const [row, prop, , newValue] of initialChanges) {
        applyChange(row, prop as keyof TableRow, newValue);
        if (!isEmpty(newValue)) bHasValidInput = true;
    }
    // 3. 入力がある場合のみ自動補完・連動処理を実行
    if (bHasValidInput && isAutoProcessSource) {
        // changesのコピーに対してループ（処理中にMapが更新されるため）
        const initialChanges = Array.from(finalChangesMap.values());

        initialChanges.forEach(([row, prop, , newValue]) => {
            const afterRowCur = afterData[row];

            // A. 数値・時間整形 (edit時のみの特殊処理は分離せず、ここで判定)
            if (source === "edit") {
                // 掛け算入力 (100*2)
                if (prop === 'incomes' || prop === 'expenses') {
                    const m = String(newValue).match(/^([0-9]+)(?:\*|x)([0-9]+)$/i);
                    if (m) {
                        applyChange(row, prop, m[1]);
                        applyChange(row, 'quantity', m[2]);
                        newValue = m[1];
                    }
                }
            }

            // 数値化・時間整形
            if (['incomes', 'expenses', 'quantity', 'total'].includes(prop)) {
                if (typeof newValue === "string") {
                    applyChange(row, prop, newValue.replace(/[\\, ]/g, ''));
                }
                if (prop !== 'total') updateTotal(row);
            } else if (prop === 'time') {
                const time = getTimeString(String(newValue));
                if (time) applyChange(row, prop, time);
            }

            // B. 前行からのコピー (row > 0 の場合)
            if (row > 0) {
                const afterRowPre = afterData[row - 1];
                const copyIfEmpty = (col: keyof TableRow) => {
                    if (isEmpty(afterData[row][col]) && !isEmpty(afterRowPre[col])) {
                        applyChange(row, col, afterRowPre[col]);
                        return true;
                    }
                    return isSameItem(afterData[row], afterRowPre, col);
                };

                // カラムごとの連鎖コピー
                const targets = COPY_TARGETS[prop] || [];
                for (const t of targets) {
                    if (!copyIfEmpty(t)) break;
                }
                if (['incomes', 'expenses', 'quantity'].includes(prop)) updateTotal(row);
            }

            // C. レシート構造（TOP行の変更をBODY/BOTTOMに波及）
            if (source === "edit"
                && ['day', 'shop_name', 'time', 'account'].includes(prop)
                && afterRowCur?.kind === RowKind.TOP) {
                for (let i = row + 1; i < afterData.length; i++) {
                    const nextKind = afterData[i]?.kind;
                    if (nextKind === RowKind.BODY || nextKind === RowKind.BOTTOM) {
                        applyChange(i, prop, afterRowCur[prop]);
                    } else {
                        break;
                    }
                }
            }
        });
    }
    // 4. 元の changes 配列を直接書き換えて終了
    return Array.from(finalChangesMap.values());
}

export const calculateShopTotal = (dispRow: number, data: TableData): number => {
    const targetRow = data[dispRow];
    let shopTotal = toNumber(targetRow?.total);
    const kind = targetRow?.kind;
    if (kind === undefined) {
        return shopTotal;
    }
    // 上へ
    if (kind === RowKind.BODY || kind === RowKind.BOTTOM) {
        for (let i = dispRow - 1; i >= 0; --i) {
            const rowData = data[i];
            const kind = rowData?.kind;
            if (kind !== RowKind.TOP && kind !== RowKind.BODY) break;
            shopTotal += toNumber(rowData?.total);
        }
    }
    // 下へ
    if (kind === RowKind.BODY || kind === RowKind.TOP) {
        for (let i = dispRow + 1; i < data.length; ++i) {
            const rowData = data[i];
            const kind = rowData?.kind;
            if (kind !== RowKind.BOTTOM && kind !== RowKind.BODY) break;
            shopTotal += toNumber(rowData?.total);
        }
    }
    return shopTotal;
}

export const calculateSelectionTotal = (selectedRanges: [number, number, number, number][], data: TableData) => {
    let selectionTotal = 0
    const selectedRowIndices = new Set<number>();
    for (const [r1, , r2] of selectedRanges) {
        const start = Math.min(r1, r2);
        const end = Math.max(r1, r2);
        for (let i = start; i <= end; i++) {
            selectedRowIndices.add(i);
        }
    }
    if (selectedRowIndices.size > 1) {
        // 複数選択している時のみ計算
        selectedRowIndices.forEach(idx => {
            selectionTotal += toNumber(data[idx]?.total);
        });
    }
    return selectionTotal;
}