import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { SELECT_ALL } from "../../db/queries";
import { CASH_FIELD_LABELS, type CashTable } from "../../db/types";
import { fetchAll } from "./utils";

type Action = WorkerActions['export'];

const escapeForCSV = (val: unknown): string => {
    const s = String(val ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type CsvRow = CashTable & { date: number, year: number; month: number };
const csvColumns: (keyof CsvRow)[] = [
    'year',
    'month',
    'date',
    'shop_name',
    'time',
    'item_name',
    'detail',
    'incomes',
    'quantity',
    'expenses',
    'total',
    'account',
    'note',
];

export const handleExport = async (
    db: Database | null,
    { handle, type }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    const writable = await handle.createWritable();
    try {
        await writable.truncate(0);
        if (type === 'db') {
            const exportedData = db.export();
            const dataToSave = new Uint8Array(exportedData);
            await writable.write(dataToSave);
        } else {
            const headerLine = csvColumns.map(col => escapeForCSV(CASH_FIELD_LABELS[col])).join(",") + "\n";
            await writable.write(headerLine);
            const rows = fetchAll(db, SELECT_ALL, {}) as unknown as CashTable[];
            const BATCH_SIZE = 1000; // 1000行ごとにまとめる
            let buffer: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i] as CsvRow;
                row.year = Math.trunc(row.year_month / 100); 
                row.month = row.year_month % 100;
                row.date = row.day;
                const dataLine = csvColumns
                    .map(col => escapeForCSV(row[col]))
                    .join(",");
                buffer.push(dataLine);
                if (buffer.length >= BATCH_SIZE) {
                    await writable.write(buffer.join("\n") + "\n");
                    buffer = []; // バッファを空にする
                }
            }
            // 残ったバッファを書き出し
            if (buffer.length > 0) {
                await writable.write(buffer.join("\n") + "\n");
            }
        }
    } finally {
        await writable.close();
    }
    return true;
}