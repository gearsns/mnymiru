import { describe, expect, it } from "vitest";
import { getNextFocus } from "./navigation";
import type { TableRow } from "../../../../db/types";

const headers: (keyof (TableRow))[] = [
    "day", "line_no", "shop_name", "time",
    "item_name", "detail", "expenses", "quantity",
    "incomes", "total", "account", "note"
];
const rawData: unknown[][] = [
    [1, 0, "コンビニ", "12:00", "ランチ", "弁当", 600, 1, 0, -600, "現金", "特記事項なし"],
    [2, 1, "スーパー", "", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    ["", 2, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 3, "スーパー", "18:00", "日用品", "", 300, 1, 0, -300, "カード", ""],
    [2, 4, "", "18:00", "日用品", "洗剤", "", 1, 0, -300, "カード", ""],
    [2, 5, "スーパー", "18:00", "日用品", "洗剤", "", 1, 0, -300, "現金", ""],
    [2, 6, "スーパー", "18:00", "日用品", "洗剤", 300, 1, "", -300, "カード", ""],
    [2, 7, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 10, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 1, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 2, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 3, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 4, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
    [2, 5, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", ""],
];

const testData: TableRow[] = rawData.map(row =>
    Object.fromEntries(row.map((val, i) => [headers[i], val])) as unknown as TableRow
);

describe('Editor logic navigation test', () => {

    it.each([
        [1, "time"],
        [2, "day"],
        [3, "detail"],
        [4, "expenses"],
    ] as const)("next focus : shop_name", (row, expectedCol) => {
        const focusResult = getNextFocus(row, "shop_name", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it.each([
        [2, "day"],
        [3, "detail"],
        [4, "shop_name"],
        [5, "expenses"],
    ] as const)("next focus : item_name", (row, expectedCol) => {
        const focusResult = getNextFocus(row, "item_name", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it.each([
        [2, "day"],
        [3, "detail"],
        [4, "shop_name"],
        [5, "expenses"],
    ] as const)("next focus : time", (row, expectedCol) => {
        const focusResult = getNextFocus(row, "time", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it.each([
        [2, "day"],
        [4, "shop_name"],
        [5, "expenses"],
    ] as const)("next focus : detail", (row, expectedCol) => {
        const focusResult = getNextFocus(row, "detail", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it.each([
        [1, "time"],
        [2, "day"],
        [3, "detail"],
        [4, "shop_name"],
        [5, "expenses"],
    ] as const)("next focus : expenses", (row, expectedCol) => {
        const focusResult = getNextFocus(row - 1, "expenses", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it.each([
        [1, "time"],
        [2, "day"],
        [3, "detail"],
        [4, "shop_name"],
        [6, "incomes"],
    ] as const)("next focus : incomes", (row, expectedCol) => {
        const focusResult = getNextFocus(row - 1, "incomes", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it.each([
        [1, "time"],
        [2, "day"],
        [3, "detail"],
        [4, "shop_name"],
        [6, "incomes"],
    ] as const)("next focus : total", (row, expectedCol) => {
        const focusResult = getNextFocus(row - 1, "total", testData);
        expect(focusResult).toBeInstanceOf(Array);
        if (focusResult) {
            expect(focusResult[0]).toBe(row);
            expect(focusResult[1]).toBe(expectedCol);
        }
    });
    it("next focus none", () => {
        const focusResult = getNextFocus(1, "day", testData);
        expect(focusResult).toBe(undefined);
    });
});