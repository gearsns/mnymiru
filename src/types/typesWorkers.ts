import type { CashTable, TableData, TopItem, TopMonth } from "../db/types";

export interface WorkerActions {
    init: {
        payload: {
            handle?: FileSystemFileHandle,
            dir?: FileSystemDirectoryHandle,
            isSession?: boolean | undefined
        };
        response: boolean;
    };
    fetch_sheet: {
        payload: { key: string };
        response: TableData;
    };
    fetch_top_item_by_column: {
        payload: {
            srcColumnName: keyof CashTable, dstColumnName: keyof CashTable,
            value: string, year_month: number
        };
        response: TopItem;
    };
    fetch_top_items: {
        payload: { columnName: keyof CashTable, year_month: number };
        response: TopItem[];
    };
    fetch_by_keyword: {
        payload: { keyword: string };
        response: CashTable[];
    };
    fetch_year_top: {
        payload: { year: number, account?: string };
        response: CashTable[];
    };
    fetch_month_total: {
        payload: { year: number, account?: string };
        response: TopMonth[];
    };
    fetch_account: {
        payload: { year: number };
        response: string[];
    };
    sync_sheet: {
        payload: { year_month: number, tableData: TableData };
        response: boolean;
    };
    save: {
        payload: undefined;
        response: boolean;
    };
    export: {
        payload: { type: 'csv' | 'db', handle: FileSystemFileHandle };
        response: boolean;
    };
}

// --- 自動生成される型 ---

// WorkerMessage は { type: 'init', payload: ... } | { type: 'fetch_sheet', ... } になる
export type WorkerMessage = {
    [K in keyof WorkerActions]: WorkerActions[K]['payload'] extends void
    ? { type: K; payload: { id: string } } // 引数なしの場合
    : { type: K; payload: WorkerActions[K]['payload'] & { id: string } }; // 引数ありの場合
}[keyof WorkerActions];

// WorkerResponse は { type: 'init', id: string, result: ... } | ... になる
export type WorkerResponse = {
    [K in keyof WorkerActions]: { type: K; id: string; result: WorkerActions[K]['response'] }
}[keyof WorkerActions];
