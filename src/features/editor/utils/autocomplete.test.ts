import { describe, it, expect, vi } from "vitest";
import { isAutocompleteIndex, getSortedCounts, filterResults } from "./autocomplete";
import type { DropdownOption, CellValue } from "@/components/CanvasTableGrid";

// columnDefs のモック化（パスや定義は実際のプロジェクト環境に合わせて調整してください）
vi.mock("../constants", () => ({
    columnDefs: [
        { type: "text" },
        { type: "autocomplete" },
        { otherProperty: true }, // type が存在しないケース
    ],
}));

// utils のモック化（isEmpty の挙動を定義）
vi.mock("@/utils", () => ({
    isEmpty: (val: unknown) => val === "" || val === null || val === undefined,
}));

describe("autocomplete.ts のテスト", () => {
    describe("isAutocompleteIndex", () => {
        it("指定された列の type が 'autocomplete' の場合に true を返すこと[cite: 1]", () => {
            expect(isAutocompleteIndex(1)).toBe(true);
        });

        it("指定された列の type が異なる、または存在しない場合に false を返すこと[cite: 1]", () => {
            expect(isAutocompleteIndex(0)).toBe(false);
            expect(isAutocompleteIndex(2)).toBe(false);
        });

        it("定義されていないインデックスを指定した場合に false を返すこと[cite: 1]", () => {
            expect(isAutocompleteIndex(99)).toBe(false);
        });
    });

    describe("getSortedCounts", () => {
        it("データの出現回数を集計し、降順かつ同数の場合は辞書順でソートすること[cite: 1]", () => {
            const data: CellValue[][] = [
                ["", "apple"],
                ["", "banana"],
                ["", "apple"],
                ["", "cherry"],
                ["", "banana"],
                ["", "apple"],
            ];
            // col 1 を対象とする ("apple": 3回, "banana": 2回, "cherry": 1回)
            const result = getSortedCounts(data, 1);

            expect(result).toEqual([
                { value: "apple", label: "apple" },
                { value: "banana", label: "banana" },
                { value: "cherry", label: "cherry" },
            ]);
        });

        it("出現回数が同じ場合、辞書順（昇順）でソートされること[cite: 1]", () => {
            const data: CellValue[][] = [
                ["", "banana"],
                ["", "apple"],
                ["", "banana"],
                ["", "apple"],
            ];
            // "apple": 2回, "banana": 2回 -> 辞書順で "apple" が先になるべき
            const result = getSortedCounts(data, 1);

            expect(result).toEqual([
                { value: "apple", label: "apple" },
                { value: "banana", label: "banana" },
            ]);
        });

        it("空の値や空白文字が除外されること[cite: 1]", () => {
            const data: CellValue[][] = [
                ["", ""],
                ["", "apple"],
                ["", null as any],
            ];
            const result = getSortedCounts(data, 1);

            expect(result).toEqual([{ value: "apple", label: "apple" }]);
        });
    });

    describe("filterResults", () => {
        const curItems: DropdownOption[] = [
            { value: "apple", label: "apple" },
            { value: "apricot", label: "apricot" },
        ];
        const dbItems: DropdownOption[] = [
            { value: "banana", label: "banana" },
            { value: "application", label: "application" },
        ];

        it("正規表現にマッチするアイテムを curItems と dbItems から抽出すること[cite: 1]", () => {
            const regex = /^app/;
            const result = filterResults(curItems, dbItems, regex);

            expect(result).toEqual([
                { value: "apple", label: "apple" },
                { value: "application", label: "application" },
            ]);
        });

        it("limit の数まで結果を制限すること[cite: 1]", () => {
            const regex = /.*/;
            const result = filterResults(curItems, dbItems, regex, 2);

            expect(result).toHaveLength(2);
            expect(result).toEqual([
                { value: "apple", label: "apple" },
                { value: "apricot", label: "apricot" },
            ]);
        });
    });
});
