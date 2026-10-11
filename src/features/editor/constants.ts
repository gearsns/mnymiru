import type { CashMonth } from "../../db/types"

export const INPUTSHEET_INIT_ROWS = 2000;
export type RendererType = "day" | "shop" | "time" | "number";
export type EditorType = "autocomplete";
export type ColumnDef = {
    data: keyof CashMonth
    width: number
    renderer?: RendererType
    type?: EditorType
};

export const columnDefs = [
    { data: 'day', width: 50, renderer: "day" },
    { data: 'shop_name', width: 150, renderer: "shop", type: "autocomplete" },
    { data: 'time', width: 60, renderer: "time" },
    { data: 'item_name', width: 100, type: "autocomplete" },
    { data: 'detail', width: 250, type: "autocomplete" },
    { data: 'expenses', width: 70, renderer: "number" },
    { data: 'quantity', width: 50, renderer: "number" },
    { data: 'incomes', width: 70, renderer: "number" },
    { data: 'total', width: 70, renderer: "number" },
    { data: 'account', width: 150, type: "autocomplete" },
    { data: 'note', width: 200, type: "autocomplete" },
] as const satisfies readonly ColumnDef[];

export const ColumnIndexToName = Object.fromEntries(
    columnDefs.map((c, i) => [i, c.data])
) as Record<number, keyof CashMonth>;

export const ColumnNameToIndex = Object.fromEntries(
    columnDefs.map((c, i) => [c.data, i])
) as Record<keyof CashMonth, number>;

export const ItemIndex = Object.fromEntries(
    columnDefs.map((c, i) => [c.data, i])
) as Record<keyof CashMonth, number>;
