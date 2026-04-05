import { describe, expect, it, vi } from "vitest";
import { sqliteClient } from "../../services/sqliteClient";
import { renderHook, waitFor } from "@testing-library/react";
import { useDataChart } from "./useDataChart";
import { act } from "react";
import type { TopMonth } from "../../db/types";

// APIのモック
vi.mock("../../services/sqliteClient", () => ({
    sqliteClient: {
        fetchMonthTotal: vi.fn(),
        fetchAccount: vi.fn(),
    }
}));

describe("useDataChart Hook", () => {
    it("初期化時にデータを取得し、chartDataを更新すること", async () => {
        const mockData = [{ year_month: 202401, item_name: "test", total: 1000 }] as TopMonth[];
        vi.mocked(sqliteClient.fetchMonthTotal).mockResolvedValue(mockData);

        const { result } = renderHook(() => useDataChart());

        await waitFor(() => {
            expect(sqliteClient.fetchMonthTotal).toHaveBeenCalled();
            // transformChartData後の期待値をチェック
            expect(result.current.chartData.values.length).toBeGreaterThan(0);
        });
    });

    it("handleRefreshAll を呼ぶとアカウントリストが更新されること", async () => {
        vi.mocked(sqliteClient.fetchAccount).mockResolvedValue(["楽天カード", "現金"]);
        
        const { result } = renderHook(() => useDataChart());

        await act(async () => {
            await result.current.handleRefreshAll();
        });

        expect(result.current.accountNames).toContainEqual({ value: "楽天カード", label: "楽天カード" });
        expect(result.current.currentAccount).toBe(""); // リセット確認
    });
});