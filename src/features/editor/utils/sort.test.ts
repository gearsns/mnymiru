import { describe, it, expect } from "vitest"; // Jestの場合は @jest/globals や不要
import { ItemIndex } from "../constants";
import type { CellValue } from "@/components/CanvasTableGrid";
import { rowsCompare } from "./sort";

describe("rowsComapare", () => {
    // 仮の ItemIndex 定義（テストが独立して動くよう必要に応じて調整してください）
    // 例: time: 2, shop_name: 1, account: 9 など

    describe("1. day の比較", () => {
        it("day が小さい行が前にくること", () => {
            const a: CellValue[] = [10, "shopA", "10:00", ...Array(10).fill("")];
            const b: CellValue[] = [20, "shopB", "09:00", ...Array(10).fill("")];

            expect(rowsCompare(a, b)).toBeLessThan(0); // a が先
            expect(rowsCompare(b, a)).toBeGreaterThan(0); // b が先
        });

        it("day が同じ場合は次の比較（time）に進むこと", () => {
            const a: CellValue[] = [10, "shopA", "09:00", ...Array(10).fill("")];
            const b: CellValue[] = [10, "shopB", "10:00", ...Array(10).fill("")];

            // day が同じなので time の比較結果（09:00 vs 10:00）になる
            expect(rowsCompare(a, b)).toBeLessThan(0);
        });

        it("day が null/undefined などの場合は Infinity として扱われること", () => {
            const a: CellValue[] = [null, "shopA", "10:00", ...Array(10).fill("")]; // Infinity 扱い
            const b: CellValue[] = [5, "shopB", "10:00", ...Array(10).fill("")];

            expect(rowsCompare(a, b)).toBeGreaterThan(0); // 5 の方が小さいので b が先
        });
    });

    describe("2. 空白（null, \"\"）の優先処理 (compareWithEmptyTop)", () => {
        it("A が空白（null, 空文字）の場合、Aを上にすること (-1)", () => {
            const rowA: CellValue[] = [1, "", "10:00", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "ShopB", "10:00", ...Array(10).fill("")];

            // shop の比較（index: 1）で A が空白のため、Aが上に来る
            rowA[ItemIndex.shop_name] = null;
            expect(rowsCompare(rowA, rowB)).toBeLessThan(0);

            rowA[ItemIndex.shop_name] = null;
            expect(rowsCompare(rowA, rowB)).toBeLessThan(0);

            rowA[ItemIndex.shop_name] = "";
            expect(rowsCompare(rowA, rowB)).toBeLessThan(0);
        });

        it("B が空白の場合、Bを上にするため正の値を返すこと", () => {
            const rowA: CellValue[] = [1, "ShopA", "10:00", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "", "10:00", ...Array(10).fill("")];

            rowB[ItemIndex.shop_name] = null;
            expect(rowsCompare(rowA, rowB)).toBeGreaterThan(0);
        });

        it("両方空白の場合は等しいとみなして次の比較に進むこと", () => {
            const rowA: CellValue[] = [1, "", "10:00", "acc", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "", "10:00", "acc", ...Array(10).fill("")];

            rowA[ItemIndex.shop_name] = null;
            rowB[ItemIndex.shop_name] = "";

            // shop は両方空白なので 0 を返し、次の account 比較へ（今回は同一なので 0）
            expect(rowsCompare(rowA, rowB)).toBe(0);
        });
    });

    describe("3. time, shop, account の優先順位と通常比較", () => {
        it("time が異なる場合は time で比較されること", () => {
            const rowA: CellValue[] = [1, "Shop", "08:00", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "Shop", "12:00", ...Array(10).fill("")];

            rowA[ItemIndex.time] = "08:00";
            rowB[ItemIndex.time] = "12:00";

            expect(rowsCompare(rowA, rowB)).toBeLessThan(0);
        });

        it("time が同じなら shop で比較されること", () => {
            const rowA: CellValue[] = [1, "A_Shop", "10:00", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "B_Shop", "10:00", ...Array(10).fill("")];

            rowA[ItemIndex.time] = "10:00";
            rowB[ItemIndex.time] = "10:00";
            rowA[ItemIndex.shop_name] = "A_Shop";
            rowB[ItemIndex.shop_name] = "B_Shop";

            expect(rowsCompare(rowA, rowB)).toBeLessThan(0);
        });

        it("time と shop が同じなら account で比較されること", () => {
            const rowA: CellValue[] = [1, "Shop", "10:00", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "Shop", "10:00", ...Array(10).fill("")];

            rowA[ItemIndex.time] = "10:00";
            rowB[ItemIndex.time] = "10:00";
            rowA[ItemIndex.shop_name] = "Shop";
            rowB[ItemIndex.shop_name] = "Shop";
            rowA[ItemIndex.account] = "AccountA";
            rowB[ItemIndex.account] = "AccountB";

            expect(rowsCompare(rowA, rowB)).toBeLessThan(0);
        });

        it("すべての比較要素が完全に一致する場合は 0 を返すこと", () => {
            const rowA: CellValue[] = [1, "Shop", "10:00", ...Array(10).fill("")];
            const rowB: CellValue[] = [1, "Shop", "10:00", ...Array(10).fill("")];

            rowA[ItemIndex.time] = "10:00";
            rowB[ItemIndex.time] = "10:00";
            rowA[ItemIndex.shop_name] = "Shop";
            rowB[ItemIndex.shop_name] = "Shop";
            rowA[ItemIndex.account] = "Account";
            rowB[ItemIndex.account] = "Account";

            expect(rowsCompare(rowA, rowB)).toBe(0);
        });
    });
});
