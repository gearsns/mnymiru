import { describe, it, expect } from "vitest"; // Jestの場合は @jest/globals などに適宜変更してください
import { searchValue } from "./search";
import type { CellValue } from "@/components/CanvasTableGrid";

describe("searchValue", () => {
    // テスト用のサンプルデータ (3行×3列)
    const testData: CellValue[][] = [
        ["apple", "banana", "cherry"],
        ["date", "apple", "fig"],
        ["grape", "honeydew", "apple"]
    ];

    it("指定位置の次から検索を開始し、見つかればその位置を返すこと", () => {
        // (0, 0) の "apple" の次から探すと、(1, 1) の "apple" がヒットするはず
        const result = searchValue("apple", { row: 0, col: 0 }, testData);
        expect(result).toEqual({ row: 1, col: 1 });
    });

    it("末尾まで見つからない場合、先頭に戻ってラップアラウンド検索すること", () => {
        // (2, 2) の "apple" から探すと、末尾に達するので先頭に戻り、(0, 0) の "apple" がヒットするはず
        const result = searchValue("apple", { row: 2, col: 2 }, testData);
        expect(result).toEqual({ row: 0, col: 0 });
    });

    it("完全に一致するものがない場合は undefined を返すこと", () => {
        const result = searchValue("orange", { row: 0, col: 0 }, testData);
        expect(result).toBeUndefined();
    });

    it("検索ワードが空文字の場合は undefined を返すこと", () => {
        const result = searchValue("", { row: 0, col: 0 }, testData);
        expect(result).toBeUndefined();
    });

    it("部分一致（include）で正しくヒットすること", () => {
        // "erry" は "cherry" (0, 2) に含まれている
        const result = searchValue("erry", { row: 0, col: 0 }, testData);
        expect(result).toEqual({ row: 0, col: 2 });
    });

    it("行の長さが異なる（ジャグド配列な）データでも正しく動作すること", () => {
        const raggedData: CellValue[][] = [
            ["a"],
            ["b", "c"],
            ["d", "e", "f"]
        ];
        // (1, 1) "c" の次から探すと、次は (2, 0) "d" にラップする
        const result = searchValue("d", { row: 1, col: 1 }, raggedData);
        expect(result).toEqual({ row: 2, col: 0 });
    });
});
