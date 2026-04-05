import type { CashTable, TableData, TopItem, TopMonth } from "../db/types";
import type { WorkerActions } from "../types/typesWorkers";

// ID(string) をキーにして、成功用(resolve)と失敗用(reject)の関数を保持する
const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}>();

interface WorkerResponse {
    id: string;
    type: string;
    result?: unknown;
    status?: string;
    error?: string;
}

let worker: Worker | null = null;
export const getWorker = () => {
  if (!worker) {
    // 呼び出された瞬間に初めて new する
    worker = new Worker(new URL("../context/sqlite.worker.ts", import.meta.url), { type: 'module' });
    worker.addEventListener('message', handleMessage);
  }
  return worker;
};

const withLoading = async <T,>(fn: (id: string) => Promise<T>): Promise<T> => {
    try {
        return await fn(crypto.randomUUID());
    } finally {
        //
    }
};

const handleMessage = (e: MessageEvent<WorkerResponse>) => {
    const { id, result, error } = e.data;
    const request = pendingRequests.get(id);
    if (!request) return;
    if (error) {
        // Workerからエラーが届いたら reject を呼ぶ！
        request.reject(new Error(error));
    } else {
        // 成功なら resolve を呼ぶ
        request.resolve(result);
    }
    pendingRequests.delete(id);
};

// 1. 引数が必要なパターン
function callWorker<K extends keyof WorkerActions>(
    type: K,
    payload: WorkerActions[K]['payload']
): Promise<WorkerActions[K]['response']>;

// 2. 引数が void (不要) なパターン
function callWorker<K extends keyof WorkerActions>(
    type: K
): Promise<WorkerActions[K]['response']>;

// 実装本体
function callWorker<K extends keyof WorkerActions>(
    type: K,
    payload?: unknown
): Promise<WorkerActions[K]['response']> {
    return withLoading((id) => new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
        // payload が void の場合は id だけ送る
        getWorker().postMessage({
            type,
            payload: { ...(payload || {}), id }
        });
    }));
}

export const sqliteClient = {
    // 1. 初期化(ロード)用
    initDatabase: (param?: WorkerActions['init']['payload']) => callWorker('init', { ...param }),
    initDatabaseBySession: (isSession: boolean | undefined) => callWorker('init', { isSession }),

    // 2. 同期
    syncSheet: (year_month: number, tableData: TableData) =>
        callWorker('sync_sheet', { year_month, tableData }),

    // 3. クエリ実行
    fetchTopItemByColumn: (srcColumnName: keyof CashTable, dstColumnName: keyof CashTable, value: string, year_month: number): Promise<TopItem> =>
        callWorker('fetch_top_item_by_column', { srcColumnName, dstColumnName, value, year_month }),

    fetchTopItems: (columnName: keyof CashTable, year_month: number): Promise<TopItem[]> =>
        callWorker('fetch_top_items', { columnName, year_month }),

    fetchByKeyword: (keyword: string): Promise<CashTable[]> =>
        callWorker('fetch_by_keyword', { keyword }),

    fetchYearTop: (year: number, account?: string): Promise<CashTable[]> =>
        callWorker('fetch_year_top', { year, account }),

    fetchMonthTotal: (year: number, account?: string): Promise<TopMonth[]> =>
        callWorker('fetch_month_total', { year, account }),

    fetchAccount: (year: number): Promise<string[]> => callWorker('fetch_account', { year }),

    fetchSheet: (key: string): Promise<TableData> => callWorker('fetch_sheet', { key }),

    saveDatabase: () => callWorker('save'),

    exportFile: (type: 'csv' | 'db', handle: FileSystemFileHandle): Promise<boolean> =>
        callWorker('export', { type, handle }),
};