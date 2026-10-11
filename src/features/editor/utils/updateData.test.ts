import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateRelatedData } from "./updateData";
import { ItemIndex } from "../constants";
import { sqliteClient } from "@/services/sqliteClient";
import type { CellChange, CellValue, OnChangeHelpers } from "@/components/CanvasTableGrid";

// sqliteClient をモック化
vi.mock("@sqliteClient", () => ({
    sqliteClient: {
        fetchTopItemByColumn: vi.fn(),
    },
}));

describe("updateRelatedData", () => {
    const getCellMock = vi.fn((_row: number, _col: number): CellValue => null);
    const mergeEditsMock = vi.fn((_changes: CellChange[]): void => { });
    const mockGetCell = getCellMock as unknown as (row: number, col: number) => CellValue;
    const mockMergeEdits = mergeEditsMock as unknown as (changes: CellChange[]) => void;

    beforeEach(() => {
        vi.clearAllMocks();
        getCellMock.mockImplementation(() => null);
        mergeEditsMock.mockImplementation(() => { });
    });

    it("expenses, quantity, incomes が変更されたとき、total が正しく計算されること", async () => {
        // 初期セルのモック（expenses: 100, quantity: 2, incomes: 500 を想定）
        getCellMock.mockImplementation((r, c) => {
            if (c === ItemIndex.expenses) return 100;
            if (c === ItemIndex.quantity) return 2;
            if (c === ItemIndex.incomes) return 500;
            return null;
        });

        const helpers: OnChangeHelpers = {
            edits: undefined,
            mergeEdits: mockMergeEdits
        };

        // expenses を 200 に変更する編集
        await updateRelatedData(1, ItemIndex.expenses, 200, helpers, 10, mockGetCell);

        // total = (500 * 2) - (200 * 2) = 1000 - 400 = 600
        expect(mockMergeEdits).toHaveBeenCalledWith([
            //{ row: 1, col: ItemIndex.expenses, value: 200 },
            { row: 1, col: ItemIndex.total, value: 600 }
        ]);
    });

    it("quantity が未設定または0の場合、1として total が計算されること", async () => {
        getCellMock.mockImplementation((r, c) => {
            if (c === ItemIndex.expenses) return 150;
            if (c === ItemIndex.quantity) return 0; // または null
            if (c === ItemIndex.incomes) return 0;
            return null;
        });

        const helpers: OnChangeHelpers = {
            edits: undefined,
            mergeEdits: mockMergeEdits
        };


        await updateRelatedData(1, ItemIndex.quantity, 0, helpers, 10, mockGetCell);

        // total = (0 * 1) - (150 * 1) = -150
        expect(mockMergeEdits).toHaveBeenCalledWith([
            //{ row: 1, col: ItemIndex.quantity, value: 0 },
            { row: 1, col: ItemIndex.total, value: -150 }
        ]);
    });

    it("shop_name が変更され対象行が空白の場合、前の行から day, time, account がコピーされること", async () => {
        // 前の行（row 0）の値
        getCellMock.mockImplementation((r, c) => {
            if (r === 0) {
                if (c === ItemIndex.day) return "2026-10-11";
                if (c === ItemIndex.time) return "12:00";
                if (c === ItemIndex.account) return "Cash";
            }
            return null; // 現在の行（row 1）はすべて空白
        });

        const helpers: OnChangeHelpers = {
            edits: undefined,
            mergeEdits: mockMergeEdits
        };

        await updateRelatedData(1, ItemIndex.shop_name, "スーパーA", helpers, 10, mockGetCell);

        expect(mockMergeEdits).toHaveBeenCalledWith(
            expect.arrayContaining([
                //{ row: 1, col: ItemIndex.shop_name, value: "スーパーA" },
                { row: 1, col: ItemIndex.day, value: "2026-10-11" },
                { row: 1, col: ItemIndex.time, value: "12:00" },
                { row: 1, col: ItemIndex.account, value: "Cash" },
            ])
        );
    });

    it("detail が変更されたとき、SQLite から item_name と account を補完して更新すること", async () => {
        // SQLite のモック返値
        vi.spyOn(sqliteClient, "fetchTopItemByColumn").mockImplementation((async (_table: any, col: any) => {
            if (col === "item_name") return { cnt: 5, value: "食費" };
            if (col === "account") return { cnt: 3, value: "クレジットカード" };
            return null;
        }) as any);

        getCellMock.mockReturnValue(null); // 各種セルは空
        const helpers: OnChangeHelpers = {
            edits: undefined,
            mergeEdits: mockMergeEdits
        };

        await updateRelatedData(2, ItemIndex.detail, "コンビニ弁当", helpers, 10, mockGetCell);

        expect(sqliteClient.fetchTopItemByColumn).toHaveBeenCalledTimes(2);
        expect(mockMergeEdits).toHaveBeenCalledWith(
            expect.arrayContaining([
                //{ row: 2, col: ItemIndex.detail, value: "コンビニ弁当" },
                { row: 2, col: ItemIndex.item_name, value: "食費" },
                { row: 2, col: ItemIndex.account, value: "クレジットカード" },
            ])
        );
    });
});
