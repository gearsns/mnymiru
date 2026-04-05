import Handsontable from 'myhandsontable'
import { columnDefs, type ColumnDef, type EditorType, type RendererType } from './constants';
import { calculateDayCell, filterResults, getMigemo, getSortedCounts, parseYearMonth, setRowStyle } from './utils';
import { sqliteClient } from '../../services/sqliteClient';
import dayjs from 'dayjs';
import { CASH_FIELD_LABELS, type CashMonth, type TableData, type TableRow, type TopItem } from '../../db/types';
import { myNumberRenderer } from '../common/baseRenderers'

const myDayRenderer: Handsontable.renderers.Base = (
    hotInstance: Handsontable, td: HTMLElement, row: number, column: number, prop: string | number, value: unknown, cellProperties: Handsontable.GridSettings
): HTMLElement => {
    Handsontable.renderers.NumericRenderer(hotInstance, td, row, column, prop, value, cellProperties);
    const settings = hotInstance.getSettings() as Handsontable.GridSettings;
    const { year, month } = parseYearMonth(settings.sheetName);

    const curRow = hotInstance.getSourceDataAtRow(row) as TableRow;
    const nextRow = hotInstance.getSourceDataAtRow(row + 1) as TableRow;

    const { text, classes } = calculateDayCell(
        value,
        year,
        month,
        !!curRow?.isSameDay,
        nextRow?.isSameDay
    );
    if (text !== undefined) {
        td.textContent = text;
    }
    td.className = classes.join(' ');
    return td;
}

const myShopRenderer: Handsontable.renderers.Base = (
    hotInstance: Handsontable, td: HTMLElement, row: number, column: number, prop: string | number, value: unknown, cellProperties: Handsontable.GridSettings
): HTMLElement => {
    Handsontable.renderers.AutocompleteRenderer(hotInstance, td, row, column, prop, value, cellProperties);
    const data = hotInstance.getSourceDataAtRow(row) as TableRow;
    const classList = ['mny_hottable', 'htAutocomplete', 'cell_shop'];
    setRowStyle(data, classList);
    if (data?.isSameShop) {
        classList.push('cell_shop_same');
    }
    td.className = classList.join(' ');
    return td;
}

const myTimeRenderer: Handsontable.renderers.Base = (
    hotInstance: Handsontable, td: HTMLElement, row: number, column: number, prop: string | number, value: unknown, cellProperties: Handsontable.GridSettings
): HTMLElement => {
    Handsontable.renderers.NumericRenderer(hotInstance, td, row, column, prop, value, cellProperties);
    const data = hotInstance.getSourceDataAtRow(row) as TableRow;
    const classList = [];
    classList.push('cell_time');
    setRowStyle(data, classList);
    if (value && data?.isSameTime) {
        classList.push('cell_time_same');
    }
    td.className = classList.join(' ');
    return td;
}

getMigemo();

async function autocompleteSource(this: (Handsontable._editors.Autocomplete), query: string, process: (items: string[]) => void) {
    const d = Number(dayjs().subtract(3, 'year').format('YYYYMM'));
    const colName = this.prop as keyof CashMonth;
    const m = await getMigemo()!;
    let dbItems: TopItem[] = [];
    try {
        dbItems = await sqliteClient.fetchTopItems(colName, d);
    } catch {/**/ }
    const data = this.instance.getSourceData() as TableData;
    const rowregex = new RegExp(m.query(query), 'i');

    const curItems = getSortedCounts(data, colName);
    const finalResult = filterResults(curItems, dbItems, rowregex);
    process(finalResult);
};

const RENDERER_MAP: { [K in RendererType]?: Handsontable.renderers.Base } = {
    day: myDayRenderer,
    shop: myShopRenderer,
    number: myNumberRenderer,
    time: myTimeRenderer,
};

const SOURCE_MAP: { [K in EditorType]?: ((query: string, callback: (items: string[]) => void) => void) } = {
    autocomplete: autocompleteSource
};

export const colHeaders = columnDefs.map(c => CASH_FIELD_LABELS[c.data]);
export const colWidths = columnDefs.map(c => c.width);

export const columns = (columnDefs as readonly ColumnDef[]).map(c => ({
    renderer: RENDERER_MAP[c.renderer as RendererType],
    type: c.type,
    data: c.data,
    source: SOURCE_MAP[c.type as EditorType],
    filter: false,
}));