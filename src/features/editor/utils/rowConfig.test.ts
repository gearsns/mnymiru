import { describe, it, expect } from 'vitest';
import { RowKind, type TableData, type TableRow } from "../../../db/types";
import { setConfg, setConfgAll, setRowStyle } from './rowConfig';

describe('Table logic tests', () => {

    describe('setRowStyle', () => {
        it('RowKindに応じて正しいクラス名が追加されること', () => {
            const cases = [
                { kind: RowKind.TOP, expected: 'cell_row_top' },
                { kind: RowKind.BODY, expected: 'cell_row_body' },
                { kind: RowKind.BOTTOM, expected: 'cell_row_bottom' },
            ];

            cases.forEach(({ kind, expected }) => {
                const classList: string[] = [];
                const rowData = { kind } as TableRow;
                setRowStyle(rowData, classList);
                expect(classList).toContain(expected);
            });
        });

        it('rowDataがnullの場合は何もしないこと', () => {
            const classList: string[] = [];
            setRowStyle(null as unknown as TableRow, classList);
            expect(classList.length).toBe(0);
        });
    });

    describe('setConfg (単一行の判定ロジック)', () => {
        // 共通のベースデータ
        const createRow = (day: string, shop: string): TableRow => ({
            day, shop_name: shop, time: '10:00', account: 'A',
            kind: RowKind.NONE, isSameDay: false, isSameShop: false, isSameTime: false, isSameAccount: false
        } as unknown as TableRow);

        it('単独の行（前後なし）は RowKind.NONE になること', () => {
            const data: TableData = [createRow('2024-04-01', 'Shop A')];
            setConfg(data, 0);
            expect(data[0].kind).toBe(RowKind.NONE);
        });

        it('3行連続して同じショップの場合、TOP -> BODY -> BOTTOM と判定されること', () => {
            const row = createRow('2024-04-01', 'Shop A');
            const data: TableData = [{ ...row }, { ...row }, { ...row }];

            setConfg(data, 0); // 1行目: 次が一致するので TOP
            setConfg(data, 1); // 2行目: 前後が一致するので BODY
            setConfg(data, 2); // 3行目: 前が一致するので BOTTOM

            expect(data[0].kind).toBe(RowKind.TOP);
            expect(data[1].kind).toBe(RowKind.BODY);
            expect(data[2].kind).toBe(RowKind.BOTTOM);
        });

        it('dayやshop_nameが空の場合は、一致していても RowKind.NONE になること', () => {
            const row = createRow('', ''); // 空データ
            const data: TableData = [{ ...row }, { ...row }];

            setConfg(data, 0);
            expect(data[0].kind).toBe(RowKind.NONE);
        });

        it('isSameXXX フラグが連鎖的に判定されること', () => {
            const data: TableData = [
                { day: '01', shop_name: 'S1', time: '10', account: 'A1' } as unknown as TableRow,
                { day: '01', shop_name: 'S1', time: '11', account: 'A1' } as unknown as TableRow, // timeが違う
            ];

            setConfg(data, 1);

            expect(data[1].isSameDay).toBe(true);
            expect(data[1].isSameShop).toBe(true);
            expect(data[1].isSameTime).toBe(false); // ここで切れる
            expect(data[1].isSameAccount).toBe(false); // timeがfalseなのでaccountもfalse
        });
    });

    describe('setConfgAll', () => {
        it('全行に対して一括で計算が適用されること', () => {
            const row = { day: '01', shop_name: 'S1', time: '10', account: 'A' } as unknown as TableRow;
            const data: TableData = [{ ...row }, { ...row }];

            setConfgAll(data);

            expect(data[0].kind).toBe(RowKind.TOP);
            expect(data[1].kind).toBe(RowKind.BOTTOM);
        });
    });
});