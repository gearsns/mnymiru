import { useMemo } from 'react';
import type Handsontable from 'myhandsontable';
import { INPUTSHEET_INIT_ROWS } from '../constants';
import type { HotTable } from 'react-myhandsontable';
import { colHeaders, columns, colWidths } from '../renderers';
import { useChangeHandlers } from './useChangeHandlers';
import { useSelectionHandlers } from './useSelectionHandlers';

export const useHotSettings = (
  activeSheetId: string,
  isLoading: boolean,
  requestSyncSheet: () => void,
  setStatusTotalText: React.Dispatch<React.SetStateAction<string>>,
  setStatusShopTotalText: React.Dispatch<React.SetStateAction<string>>,
  hotRef: React.RefObject<HotTable | null>
) => {
  const { handleBeforeKeyDown, handleBeforeChange, handleAfterChange } = useChangeHandlers(requestSyncSheet, hotRef);
  const { handleAfterSelectionEnd } = useSelectionHandlers(setStatusTotalText, setStatusShopTotalText, hotRef);
  return useMemo((): Handsontable.GridSettings => ({
    fragmentSelection: true, // ここに入れる
    copyPaste: !isLoading, // ロード中はコピーペーストも無効化
    readOnly: isLoading,    // ★ここでテーブル全体を読み取り専用にする
    autoWrapCol: false,
    autoWrapRow: false,
    autoRowSize: true,
    autoColumnSize: false,
    colHeaders: colHeaders,
    columns: columns,
    colWidths: colWidths,
    rowHeaders: true,
    rowHeights: 25,
    renderAllRows: false,
    manualColumnResize: true,
    manualRowResize: true,
    trimWhitespace: false,
    outsideClickDeselects: false,
    minRows: INPUTSHEET_INIT_ROWS,
    minCols: colHeaders.length,
    maxCols: colHeaders.length,
    viewportColumnRenderingOffset: 10,
    viewportRowRenderingOffset: 10,
    minSpareRows: 1,
    sheetName: activeSheetId,
    beforeKeyDown: handleBeforeKeyDown,
    afterChange: handleAfterChange,
    beforeChange: handleBeforeChange,
    afterSelectionEnd: handleAfterSelectionEnd,
  }), [isLoading, handleBeforeKeyDown, handleAfterChange, handleBeforeChange, handleAfterSelectionEnd, activeSheetId]);
};