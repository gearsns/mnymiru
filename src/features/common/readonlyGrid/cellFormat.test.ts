import { describe, it, expect, vi } from "vitest";
import { getCellFormat } from "./cellFomat";
import { ItemIndex } from "./constants";
import { getNumFormat } from "../utils/numFormatter";
import { getDayFormat, getYearMonthFormat } from "../utils/dayFormatter";
import type { CellFormatContext } from "@/components/CanvasTableGrid";

// 依存モジュールのモック
vi.mock("../utils/numFormatter", () => ({
    getNumFormat: vi.fn((val) => ({ type: "num", value: val })),
}));

vi.mock("../utils/dayFormatter", () => ({
    getYearMonthFormat: vi.fn((val) => ({ type: "year_month", value: val })),
    getDayFormat: vi.fn((ym, day) => ({ type: "day", ym, day })),
}));

describe("getCellFormat", () => {
    const mockGetCell = vi.fn();

    const createCtx = (
        value: string,
        getCell = mockGetCell,
        baseFormat: any = {}
    ): CellFormatContext => ({
        value,
        getCell,
        baseFormat,
    });
    it("year_month カラムの場合、getYearMonthFormat が呼ばれること", () => {
        const ctx = createCtx("2026-10");
        const result = getCellFormat(0, ItemIndex.year_month, ctx);

        expect(getYearMonthFormat).toHaveBeenCalledWith("2026-10");
        expect(result).toEqual({ type: "year_month", value: "2026-10" });
    });

    it("day カラムの場合、年月のセル値と一緒に getDayFormat が呼ばれること", () => {
        const getCell = vi.fn().mockReturnValue("2026-10");
        const ctx = createCtx("11", getCell);

        const result = getCellFormat(5, ItemIndex.day, ctx);

        expect(getCell).toHaveBeenCalledWith(5, ItemIndex.year_month);
        expect(getDayFormat).toHaveBeenCalledWith("2026-10", "11");
        expect(result).toEqual({ type: "day", ym: "2026-10", day: "11" });
    });

    it("expenses カラムの場合、負の値に変換されて getNumFormat が呼ばれること", () => {
        const ctx = createCtx("1500");
        const result = getCellFormat(0, ItemIndex.expenses, ctx);

        expect(getNumFormat).toHaveBeenCalledWith(-1500);
        expect(result).toEqual({ type: "num", value: -1500 });
    });

    it.each([
        ["quantity カラム", ItemIndex.quantity],
        ["incomes カラム", ItemIndex.incomes],
        ["total カラム", ItemIndex.total],
    ])("%s の場合、そのままの値で getNumFormat が呼ばれること", (_, colIndex) => {
        const ctx = createCtx("3000");
        const result = getCellFormat(0, colIndex, ctx);

        expect(getNumFormat).toHaveBeenCalledWith(3000);
        expect(result).toEqual({ type: "num", value: 3000 });
    });

    it("対象外のカラムの場合、undefined が返ること", () => {
        const ctx = createCtx("some_value");
        const result = getCellFormat(0, 999 as typeof ItemIndex[keyof typeof ItemIndex], ctx);

        expect(result).toBeUndefined();
    });
});
