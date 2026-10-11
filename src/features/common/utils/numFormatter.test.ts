import { describe, it, expect } from "vitest"; // Jestの場合は @jest/globals やインポートなしでそのまま使えます
import { parseNum, getNumFormat } from "./numFormatter";

describe("numFormatter.ts のテスト", () => {
    describe("parseNum", () => {
        it("数値が渡された場合、そのままの数値を返すこと", () => {
            expect(parseNum(42)).toBe(42);
            expect(parseNum(0)).toBe(0);
            expect(parseNum(-3.14)).toBe(-3.14);
        });

        it("数値に変換可能な文字列が渡された場合、数値に変換して返すこと", () => {
            expect(parseNum("123")).toBe(123);
            expect(parseNum("  45.67  ")).toBe(45.67);
            expect(parseNum("-10")).toBe(-10);
        });

        it("空文字や空白のみの文字列が渡された場合、0を返すこと", () => {
            expect(parseNum("")).toBe(0);
            expect(parseNum("   ")).toBe(0);
        });

        it("数値に変換できない文字列が渡された場合、0を返すこと", () => {
            expect(parseNum("abc")).toBe(0);
            expect(parseNum("123abc")).toBe(0);
        });

        it("null、undefined、その他の型（CellValueに含まれる想定）が渡された場合、0を返すこと", () => {
            expect(parseNum(null as any)).toBe(0);
            expect(parseNum(undefined as any)).toBe(0);
            expect(parseNum(true as any)).toBe(0);
        });
    });

    describe("getNumFormat", () => {
        it("正の値が渡された場合、青系の色とnumberタイプを返すこと", () => {
            const result = getNumFormat(10);
            expect(result).toEqual({
                color: "#6495ed",
                type: "number",
            });
        });

        it("負の値が渡された場合、coralカラーとnumberタイプを返すこと", () => {
            const result = getNumFormat(-5);
            expect(result).toEqual({
                color: "coral",
                type: "number",
            });
        });

        it("0が渡された場合、デフォルトの色(#ffff)とnumberタイプを返すこと", () => {
            const result = getNumFormat(0);
            expect(result).toEqual({
                color: "#ffff",
                type: "number",
            });
        });

        it("引数が渡されない、またはnull/undefinedの場合も0として扱われること", () => {
            expect(getNumFormat()).toEqual({ color: "#ffff", type: "number" });
            expect(getNumFormat(null)).toEqual({ color: "#ffff", type: "number" });
            expect(getNumFormat(undefined)).toEqual({ color: "#ffff", type: "number" });
        });

        it("NaNが渡された場合、エラー用の色(#f00)とtextタイプを返すこと", () => {
            const result = getNumFormat(NaN);
            expect(result).toEqual({
                color: "#f00",
                type: "text",
            });
        });
    });
});
