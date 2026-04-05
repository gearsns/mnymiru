import { readFileSync } from "fs";
import { createRequire } from "module";
import initSqlJs, { type Database } from "sql.js";
import { INITIAL_SCHEMA } from "../db/schema";
import type { CashTable } from "../db/types";
import { INSERT_VALUES } from "../db/queries";

let SQL: initSqlJs.SqlJsStatic | null = null;
async function getSqlInstance() {
    if (!SQL) {
        const require = createRequire(import.meta.url);
        const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
        const wasmBinary = readFileSync(wasmPath);
        SQL = await initSqlJs({
            wasmBinary: new Uint8Array(wasmBinary).buffer
        })
    }
    return SQL;
}

export async function getSqlDatabase(create_schema = true) {
    const SQL = await getSqlInstance();
    const db = new SQL.Database();
    if (create_schema) {
        db.run(INITIAL_SCHEMA);
    }
    return db;
}

const headers: (keyof (CashTable & { "is_deleted": number }))[] = [
    "year_month", "day", "line_no", "shop_name", "time",
    "item_name", "detail", "expenses", "quantity",
    "incomes", "total", "account", "note", "is_deleted"
];
// 2. データは値だけを並べる（これが一番楽！）
const orgRawData: unknown[][] = [
    [202401, 1, 0, "コンビニ", "12:00", "ランチ", "弁当", 600, 1, 0, -600, "現金", "特記事項なし", 0],
    [202401, 2, 1, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 2, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 3, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 4, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 5, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "現金", "", 0],
    [202401, 2, 6, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 7, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 10, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
    [202402, 2, 1, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
    [202402, 2, 2, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
    [202402, 2, 3, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
    [202402, 2, 4, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
    [202402, 2, 5, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
];

// 3. 変換（Object.fromEntries を使用）
//const testData: CashTable[] = rawData.map(row =>
//    Object.fromEntries(row.map((val, i) => [headers[i], val])) as unknown as CashTable
//);
export function createTestData(rawData: unknown[][] = orgRawData): CashTable[] {
    return rawData.map(row =>
        Object.fromEntries(row.map((val, i) => [headers[i], val])) as unknown as CashTable
    );;
}

export function insertData(db: Database, tableData: CashTable[]) {
    db.exec("BEGIN TRANSACTION");
    const bind_param: Record<string, number | string | null> = {};
    const stmt_insert = db.prepare(INSERT_VALUES);
    for (const row of tableData) {
        bind_param['@year_month'] = row.year_month;
        bind_param['@day'] = row.day;
        bind_param['@time'] = row.time;
        bind_param['@line_no'] = row.line_no;
        bind_param['@shop_name'] = row.shop_name;
        bind_param['@item_name'] = row.item_name;
        bind_param['@detail'] = row.detail;
        bind_param['@expenses'] = row.expenses;
        bind_param['@incomes'] = row.incomes;
        bind_param['@quantity'] = row.quantity;
        bind_param['@total'] = row.total;
        bind_param['@account'] = row.account;
        bind_param['@note'] = row.note;
        stmt_insert.run(bind_param);
    }
    db.exec("COMMIT");
}