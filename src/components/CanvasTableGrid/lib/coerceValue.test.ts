import { describe, expect, it } from "vitest";
import { coerceValue } from "./coerceValue";

describe("coerceValue", () => {
  it("number書式ならカンマを除去して数値化する", () => {
    expect(coerceValue("1,234", { type: "number" })).toBe(1234);
  });

  it("number書式で数値変換できない場合は文字列のまま", () => {
    expect(coerceValue("abc", { type: "number" })).toBe("abc");
  });

  it("書式なしでも数値らしい文字列は数値にする", () => {
    expect(coerceValue("42")).toBe(42);
    expect(coerceValue("3.14")).toBe(3.14);
  });

  it("書式なしで数値に見えない文字列はそのまま", () => {
    expect(coerceValue("こんにちは")).toBe("こんにちは");
  });

  it("text書式なら数値らしい文字列でも文字列のまま扱う", () => {
    expect(coerceValue("42", { type: "text" })).toBe("42");
  });

  it("空文字は空文字のまま（数値化しない）", () => {
    expect(coerceValue("", undefined)).toBe("");
  });
});
