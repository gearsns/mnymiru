import { useMemo } from 'react';
import { colHeaders, columns, colWidths } from './renderers';
import { useBaseHotSettings, type HotTable } from '../useBaseHotSettings';

export const useReadonlyHotSettings = (
  hotRef: React.RefObject<HotTable | null>,
  setStatusText: React.Dispatch<React.SetStateAction<string>>
) => {
  const { handleCellDblClick, handleAfterSelectionEnd } = useBaseHotSettings(hotRef, setStatusText);

  return useMemo((): Handsontable.GridSettings => ({
    fragmentSelection: true,
    copyPaste: true,
    readOnly: true,    // ★ここでテーブル全体を読み取り専用にする
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
    minCols: colHeaders.length,
    maxCols: colHeaders.length,
    viewportColumnRenderingOffset: 10,
    viewportRowRenderingOffset: 10,
    minSpareRows: 1,
    afterOnCellMouseDown: handleCellDblClick,
    afterSelectionEnd: handleAfterSelectionEnd,
  }), [handleCellDblClick, handleAfterSelectionEnd]);
};