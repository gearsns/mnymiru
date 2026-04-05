import { describe, expect, it } from "vitest";
import { calculateStats } from "./calculate";
import type { ChartLabel } from "../constants";

describe("calculateStats", () => {
    const mockLabels = [{ key: "food", label: "食費" }, { key: "rent", label: "家賃" }] as unknown as ChartLabel[];
    const mockValues = [
        { month: 1, food: 100, rent: 500 },
        { month: 2, food: 200, rent: 500 },
    ];

    it("全ての項目が表示されている時、正しく合計と平均を出すこと", () => {
        const barProps = { hover: null, food: false, rent: false };
        const result = calculateStats(mockValues, mockLabels, barProps);

        expect(result.monthTotal).toBe(1300); // (100+500) + (200+500)
        expect(result.monthAverage).toBe(650); // 1300 / 2ヶ月
    });

    it("特定のラベルが非表示の時、計算から除外されること", () => {
        const barProps = { hover: null, food: true, rent: false }; // foodを除外
        const result = calculateStats(mockValues, mockLabels, barProps);

        expect(result.monthTotal).toBe(1000); // 500 + 500
        expect(result.monthAverage).toBe(500);
    });

    it("データが空の時、平均が0になること", () => {
        const result = calculateStats([], mockLabels, { hover: null });
        expect(result.monthTotal).toBe(0);
        expect(result.monthAverage).toBe(0);
    });
});