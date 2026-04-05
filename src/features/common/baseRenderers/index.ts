import Handsontable from 'myhandsontable'
import { getDayDisplayInfo, splitYearMonth } from './dayFormatter';
import { calculateNumberStyle } from './myNumberLogic';

export const myYearMonthRenderer: Handsontable.renderers.Base = function (
    this: Handsontable.renderers.Base,
    hotInstance: Handsontable, td: HTMLElement, row: number, column: number, prop: string | number, value: unknown, cellProperties: Handsontable.GridSettings
): HTMLElement {
    Handsontable.renderers.NumericRenderer(hotInstance, td, row, column, prop, value, cellProperties);
    if (value === null || value === undefined || value === '') {
        return td;
    }
    const [year, month] = splitYearMonth(Math.trunc(Number(value)));
    td.textContent = `${year}年${month + 1}月`
    return td;
}

export const myDayRenderer: Handsontable.renderers.Base = function (
    this: Handsontable.renderers.Base,
    hotInstance: Handsontable, td: HTMLElement, row: number, column: number, prop: string | number, value: unknown, cellProperties: Handsontable.GridSettings
): HTMLElement {
    Handsontable.renderers.NumericRenderer(hotInstance, td, row, column, prop, value, cellProperties);
    if (value === null || value === undefined || value === '' || Number(value) <= 0) {
        return td;
    }
    const yearMonth = hotInstance.getDataAtRowProp(row, 'year_month') as number | null;
    const info = getDayDisplayInfo(value, yearMonth);
    if (info) {
        td.textContent = info.text;
        td.className = info.className;
    }
    return td;
}

export const myNumberRenderer: Handsontable.renderers.Base = function (
    this: Handsontable.renderers.Base,
    hotInstance: Handsontable, td: HTMLElement, row: number, column: number, prop: string | number, value: unknown, cellProperties: Handsontable.GridSettings
): HTMLElement {
    Handsontable.renderers.NumericRenderer(hotInstance, td, row, column, prop, value, cellProperties);
    const [className, displayValue] = calculateNumberStyle(value, prop);
    if (className !== undefined) {
        td.className = className;
    }
    if (displayValue !== undefined) {
        td.textContent = displayValue;
    }
    return td;
}
