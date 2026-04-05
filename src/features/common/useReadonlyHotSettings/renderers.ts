import { CASH_FIELD_LABELS } from '../../../db/types';
import { myYearMonthRenderer, myDayRenderer, myNumberRenderer } from '../baseRenderers'
import { columnDefs, type ColumnDef, type RendererType } from './constants';

const RENDERER_MAP: { [K in RendererType]?: Handsontable.renderers.Base } = {
    yearMonth: myYearMonthRenderer,
    day: myDayRenderer,
    number: myNumberRenderer,
};

export const colHeaders = columnDefs.map(c => CASH_FIELD_LABELS[c.data])
export const colWidths = columnDefs.map(c => c.width)

export const columns = (columnDefs as readonly ColumnDef[]).map(c => ({
    renderer: RENDERER_MAP[c.renderer as RendererType],
    data: c.data,
}))
