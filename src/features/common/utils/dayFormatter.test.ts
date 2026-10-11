import { describe, it, expect, vi } from "vitest";
import { getDayFormat, getYearMonthFormat } from "./dayFormatter";

// formatDateのモック化（必要に応じて調整してください）
vi.mock("@/components/CanvasTableGrid", () => ({
    formatDate: (dateStr: string, format: string) => {
        // 簡単なモックの挙動（実際のフォーマッターに合わせて変更してください）
        if (format === "D(ddd)") {
            return `${dateStr.split("/")[2]}(曜日)`;
        }
        if (format === "YYYY年M月") {
            const parts = dateStr.split("/");
            return `${parts[0]}年${Number(parts[1])}月`;
        }
        return dateStr;
    },
}));

describe("dayFormatter", () => {
    describe("getDayFormat", () => {
        it("val が指定されていない場合は空文字を返すフォーマッターを返すこと", () => {
            const result = getDayFormat("202604");
            expect(result.color).toBeUndefined();
            expect(result.formatter(10)).toBe("");
        });

        it("有効な年月と日が渡された場合、適切なフォーマッターと色（日曜日の場合は coral）を返すこと", () => {
            // 2026年4月5日は日曜日
            const result = getDayFormat("202604", 5);
            expect(result.color).toBe("coral");
            expect(result.formatter(5)).toBe("5(曜日)");
        });

        it("有効な年月と日が渡された場合、適切なフォーマッターと色（土曜日の場合は #6495ed）を返すこと", () => {
            // 2026年4月4日は土曜日
            const result = getDayFormat("202604", 4);
            expect(result.color).toBe("#6495ed");
            expect(result.formatter(4)).toBe("4(曜日)");
        });

        it("平日の場合は color が undefined になること", () => {
            // 2026年4月6日は月曜日
            const result = getDayFormat("202604", 6);
            expect(result.color).toBeUndefined();
            expect(result.formatter(6)).toBe("6(曜日)");
        });

        it("year_month の形式が不正な場合は日付が生成されず空文字を返すこと", () => {
            const result = getDayFormat("invalid", 10);
            expect(result.color).toBeUndefined();
            expect(result.formatter(10)).toBe("");
        });
    });

    describe("getYearMonthFormat", () => {
        it("有効な年月文字列をフォーマットできること", () => {
            const formatObj = getYearMonthFormat("202604");
            const formatted = formatObj.formatter("202604");
            expect(formatted).toBe("2026年4月");
        });

        it("不正な文字列の場合は空文字を返すこと", () => {
            const formatObj = getYearMonthFormat("2026");
            const formatted = formatObj.formatter("2026");
            expect(formatted).toBe("");
        });
    });
});
