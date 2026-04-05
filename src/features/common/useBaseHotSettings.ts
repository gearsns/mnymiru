import type Handsontable from 'myhandsontable';
import { useCallback, useMemo } from 'react';
import type { HotTable } from '@myhandsontable/react';
import { useDataStore } from '../../store/useDataStore';
import type { CashMonth } from '../../db/types';

export { type Handsontable }
export type { HotTable }

export const useBaseHotSettings = (
  hotRef: React.RefObject<HotTable | null>,
  setStatusText: React.Dispatch<React.SetStateAction<string>>
) => {
  const setNavigationTarget = useDataStore(state => state.setNavigationTarget);
  const handleCellDblClick = useCallback((event: MouseEvent, coords: Handsontable.wot.CellCoords, _TD: Element) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || coords.row < 0) return; // ヘッダー等のクリックを除外
    if (event.button === 0 && event.detail === 2) {
      const rowData = hot.getSourceDataAtRow(coords.row) as { year_month: number, line_no: number };
      if (rowData) {
        const key = hot.colToProp(coords.col) as keyof CashMonth;
        setNavigationTarget({
          sheetId: String(rowData.year_month),
          row: rowData.line_no,
          col: key
        });
      }
    }
  }, [hotRef, setNavigationTarget]);

  const handleAfterSelectionEnd = useCallback((row: number, column: number, _row2: number, _column2: number, _selectionLayerLevel: number) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || row < 0) return;
    const el = hot.getCell(row, column);
    if (el) {
      setStatusText(el.textContent || "");
    }
  }, [hotRef, setStatusText]);

  return useMemo(() => ({
    handleCellDblClick,
    handleAfterSelectionEnd,
  }), [handleCellDblClick, handleAfterSelectionEnd]);
};