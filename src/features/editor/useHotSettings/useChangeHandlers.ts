import { useCallback, useRef } from 'react';
import { useDataStore } from '../../../store/useDataStore';
import type { HotTable } from '@myhandsontable/react';
import { type TableData, type TableRow } from '../../../db/types';
import { calculateTableChanges, getNextFocus, updateRelatedConfig, updateRelatedData } from './logic';

export const useChangeHandlers = (
    requestSyncSheet: () => void,
    hotRef: React.RefObject<HotTable | null>
) => {
    const lastKeyCombo = useRef<{ key: string | null }>({
        key: null
    });
    const handleBeforeKeyDown = useCallback((event: Event) => {
        const keyEvent = event as KeyboardEvent;
        lastKeyCombo.current.key = keyEvent.key === 'Enter' ? 'Enter' : null;
    }, []);
    const handleAfterChange = useCallback((changes: [number, string | number, unknown, unknown][], source: string) => {
        if (!changes || changes.length === 0) return;
        // 1. 基本状態の更新
        useDataStore.getState().setIsDirty(true);
        requestSyncSheet();

        const hot = hotRef?.current?.hotInstance;
        if (!hot || hot.isDestroyed) return;

        const currentData = hot.getSourceData() as TableData;
        let nextRow = -1;
        let nextColName: (keyof TableRow) | null = null;
        if (source === "edit") {
            const [row, colProp] = changes[0];
            const col = colProp as keyof TableRow;
            const focusResult = getNextFocus(row, col, currentData);
            if (focusResult) {
                [nextRow, nextColName] = focusResult;
            }
            // 内訳をもとに過去のデータを参照して項目、口座を非同期で自動に設定
            updateRelatedData(hot, row, col);
        }
        // 3. 行設定の更新 (前後1行を含む)
        updateRelatedConfig(changes, currentData);
        if (nextRow >= 0 && nextColName && lastKeyCombo.current.key === 'Enter') {
            const nextColIndex = hot.propToCol(nextColName);
            setTimeout(() => {
                hot.selectCell(nextRow, nextColIndex);
            }, 0);
        }
        // 最後に一括反映
        hot.render();
    }, [hotRef, requestSyncSheet]);

    const handleBeforeChange = useCallback((changes: [number, string | number, unknown, unknown][], source: string) => {
        if (source === "RelatedData!" || !changes) return;
        const hot = hotRef?.current?.hotInstance
        if (!hot) return false;
        // 1. 変更がない場合は早期リターン
        if (changes.every(([, , v1, v2]) => v1 === v2)) return false;

        const data = hot.getSourceData() as TableData;

        const finalChanges = calculateTableChanges(changes, data, source);

        changes.length = 0;
        changes.push(...finalChanges);
    }, [hotRef]);
    return { handleBeforeKeyDown, handleAfterChange, handleBeforeChange };
};