import type { CashTable } from "../../../db/types"

export type RendererType = "yearMonth" | "day" | "number";
export type ColumnDef = {
    data: keyof CashTable
    width: number
    renderer?: RendererType
};

export const columnDefs = [
    { data: "year_month", width: 90, renderer: "yearMonth" },
    { data: "day", width: 50, renderer: "day" },
    { data: "shop_name", width: 150 },
    { data: "time", width: 60 },
    { data: "item_name", width: 100 },
    { data: "detail", width: 250 },
    { data: "expenses", width: 70, renderer: "number" },
    { data: "quantity", width: 50, renderer: "number" },
    { data: "incomes", width: 70, renderer: "number" },
    { data: "total", width: 70, renderer: "number" },
    { data: "account", width: 150 },
    { data: "note", width: 200 },
] as const satisfies readonly ColumnDef[];
