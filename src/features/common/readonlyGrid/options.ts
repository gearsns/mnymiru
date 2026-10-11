import { CASH_FIELD_LABELS } from "@/db/types";
import { columnDefs } from "./constants";

const colHeaders = columnDefs.map(c => CASH_FIELD_LABELS[c.data]);
const colWidths = columnDefs.map(c => c.width);

export const getOptions = () => ({
    rows: 100,
    cols: colHeaders.length,
    columnHeaderLabel: colHeaders,
    colWidths
});
