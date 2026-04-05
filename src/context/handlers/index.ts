import type { Database } from 'sql.js'
import type { WorkerMessage } from '../../types/typesWorkers'

import { handleExport } from './export'
import { handleInit } from './init'
import { handleFetchAccount } from './fetchAccount'
import { handleFetchByKeyword } from './fetchByKeyword'
import { handleFetchSheet } from './fetchSheet'
import { handleFetchMonthTotal } from './fetchMonthTotal'
import { handleFetchTopItemByColumn } from './fetchTopItemByColumn'
import { handleFetchTopItems } from './fetchTopItems'
import { handleFetchYearTop } from './fetchYearTop'
import { handleSave } from './save'
import { handleSyncSheet } from './syncSheet'

const ctx = {
    db: null as Database | null
};

// ラップ用のヘルパー関数
// 「(db, payload) => Promise」という型の関数を受け取って、
// 「(payload) => Promise」という型（ctx.dbを注入済み）に変えて返す
const withDb = <T>(fn: (db: Database | null, payload: T) => Promise<unknown>) => {
    return (payload: T) => fn(ctx.db, payload);
};

// handlers の各関数の型を抽出するユーティリティ（例）
export type HandlerFunc = (payload: unknown) => Promise<unknown>;

// 1. マップの型を定義（WorkerMessage['type'] をキーにする）
export const handlerMap: {
    [K in WorkerMessage['type']]: (payload: Extract<WorkerMessage, { type: K }>['payload']) => Promise<unknown>
} = {
    init: (payload) => handleInit(ctx, payload),
    fetch_sheet: withDb(handleFetchSheet),
    fetch_top_item_by_column: withDb(handleFetchTopItemByColumn),
    fetch_top_items: withDb(handleFetchTopItems),
    fetch_by_keyword: withDb(handleFetchByKeyword),
    fetch_year_top: withDb(handleFetchYearTop),
    fetch_month_total: withDb(handleFetchMonthTotal),
    fetch_account: withDb(handleFetchAccount),
    sync_sheet: withDb(handleSyncSheet),
    save: () => handleSave(ctx.db),
    export: withDb(handleExport),
};