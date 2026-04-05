import { useCallback } from 'react';
import type { HotTable } from '@myhandsontable/react';
import { MyColumnIndexToName } from '../constants';
import { type TableData } from '../../../db/types';
import { calculateSelectionTotal, calculateShopTotal } from './logic';

export const useSelectionHandlers = (
    setStatusTotalText: React.Dispatch<React.SetStateAction<string>>,
    setStatusShopTotalText: React.Dispatch<React.SetStateAction<string>>,
    hotRef: React.RefObject<HotTable | null>
) => {
    const handleAfterSelectionEnd = useCallback((row: number, column: number, row2: number, column2: number, _selectionLayerLevel: number) => {
        const hot = hotRef?.current?.hotInstance;
        if (!hot) return;
        const selected = hot.getSelected() || [];
        const isSingleCell = row === row2 && column === column2 && selected.length <= 1;
        const data = hot.getSourceData() as TableData;
        let dispRow = row;
        // 行の特定（日付がない場合は一行上を参照）
        if (!data[dispRow]?.day && dispRow > 0) {
            --dispRow;
        }
        const targetRow = data[dispRow];
        if (!targetRow?.day) {
            // ターゲット行が無効な場合
            setStatusTotalText(isSingleCell ? String(data[row]?.[MyColumnIndexToName[column]] || "") : "");
            setStatusShopTotalText("");
            return;
        }
        // --- 店舗合計の計算 ---
        const shopTotal = calculateShopTotal(dispRow, data);
        // --- 選択範囲の合計計算 ---
        const selectionTotal = calculateSelectionTotal(selected, data);
        // --- ステータスバーへの反映 ---
        if (!isSingleCell && selectionTotal !== 0 && selectionTotal !== shopTotal) {
            setStatusTotalText(`選択範囲の合計：${selectionTotal.toLocaleString()}`);
        } else {
            setStatusTotalText(String(data[row]?.[MyColumnIndexToName[column]] ?? ""));
        }
        setStatusShopTotalText(`${targetRow.shop_name || ""}：${shopTotal.toLocaleString()}`);
    }, [hotRef, setStatusTotalText, setStatusShopTotalText]);
    return { handleAfterSelectionEnd };
};