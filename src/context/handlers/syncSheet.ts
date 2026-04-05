import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { INSERT_VALUES, UPDATE_INVALID_LINE } from "../../db/queries";
import { historyService } from "../../services/historyService";

type Action = WorkerActions['sync_sheet'];

const toStr = (val: string | number | unknown | null): string => String(val ?? "");
const toNum = (val: string | number | unknown | null): number => Number(val) || 0;

export const handleSyncSheet = async (
    db: Database | null, { year_month, tableData }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    const bind_param: Record<string, number | string | null> = { '@year_month': year_month };
    db.exec("BEGIN TRANSACTION");
    try {
        db.exec(UPDATE_INVALID_LINE, bind_param);
        const stmt_insert = db.prepare(INSERT_VALUES);
        try {
            tableData.forEach((row, line_no) => {
                const day = toNum(row.day);
                const shop = toStr(row.shop_name);
                const time = toStr(row.time);
                const item = toStr(row.item_name);
                const content = toStr(row.detail);
                const expend = toNum(row.expenses);
                const num = toNum(row.quantity);
                const income = toNum(row.incomes);
                const total = toNum(row.total);
                const account = toStr(row.account);
                const note = toStr(row.note);
                const next = (
                                /*   */ 0 === income
                                /**/ && 0 === num
                                /**/ && 0 === expend
                                /**/ && 0 === total
                                /**/ && 0 === day
                                /**/ && 0 === shop.length
                                /**/ && 0 === time.length
                                /**/ && 0 === item.length
                                /**/ && 0 === content.length
                                /**/ && 0 === account.length
                                /**/ && 0 === note.length
                );
                if (next) {
                    return;
                }
                bind_param['@day'] = Math.max(day, 0);
                bind_param['@time'] = time;
                bind_param['@line_no'] = line_no;
                bind_param['@shop_name'] = shop;
                bind_param['@item_name'] = item;
                bind_param['@detail'] = content;
                bind_param['@expenses'] = expend;
                bind_param['@incomes'] = income;
                bind_param['@quantity'] = num;
                bind_param['@total'] = total;
                bind_param['@account'] = account;
                bind_param['@note'] = note;
                stmt_insert.run(bind_param);
            });
        } catch (e) {
            console.log(e);
            throw e;
        } finally {
            stmt_insert.free();
        }
        db.exec("COMMIT");
    } catch (e) {
        db.exec("ROLLBACK");
        throw e;
    }
    const data = db.export();
    await historyService.patchPersistData(data);
    return true;
}