export interface CashTable {
    year_month: number;
    day: number;
    line_no: number;
    shop_name: string;
    time: string;
    item_name: string;
    detail: string;
    expenses: number;
    quantity: number;
    incomes: number;
    total: number;
    account: string;
    note: string;
}
export type CashMonth = Partial<Omit<CashTable, 'year_month'>>;

export interface TopItem {
    value: string;
    cnt: number;
}

export interface TopMonth {
    year_month: number;
    item_name: string;
    total: number;
}

export const RowKind = {
  NONE: 0,
  TOP: 1,
  BODY: 2,
  BOTTOM: 3,
} as const;

export type RowKindType = typeof RowKind[keyof typeof RowKind];
export interface TableRow extends Partial<CashMonth> {
    kind?: RowKindType;
    isSameDay?: boolean,
    isSameShop?: boolean,
    isSameTime?: boolean,
    isSameAccount?: boolean
}

export type TableData = TableRow[];

type VirtualFields = "year" | "month" | "date";

export const CASH_FIELD_LABELS: Record<keyof CashTable | VirtualFields, string> = {
    year_month: "年月",
    day: "日付",
    line_no: "行番号",
    shop_name: "店名",
    time: "時間",
    item_name: "項目",
    detail: "内訳",
    expenses: "支出",
    quantity: "数量",
    incomes: "収入",
    total: "小計",
    account: "現金/口座",
    note: "備考",
    // --- CSV用 ---
    year: "日付(年)",
    month: "日付(月)",
    date: "日付(日)" ,
};