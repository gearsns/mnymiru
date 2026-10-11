import { describe, expect, it } from "vitest";
import { formatTodayDate, formatNowTime, classifyQuickInsertKey } from "./quickDateTime";

describe("formatTodayDate", () => {
  it("YYYY/MM/DD 形式でゼロ埋めする", () => {
    expect(formatTodayDate(new Date(2024, 8, 1))).toBe("2024/09/01"); // 月は0始まり(8=9月)
    expect(formatTodayDate(new Date(2024, 11, 25))).toBe("2024/12/25");
  });
});

describe("formatNowTime", () => {
  it("HH:MM 形式でゼロ埋めする", () => {
    expect(formatNowTime(new Date(2024, 8, 1, 9, 5))).toBe("09:05");
    expect(formatNowTime(new Date(2024, 8, 1, 23, 59))).toBe("23:59");
  });
});

describe("classifyQuickInsertKey", () => {
  it("';' (shiftなし) は date", () => {
    expect(classifyQuickInsertKey(";", false)).toBe("date");
  });
  it("':' は time", () => {
    expect(classifyQuickInsertKey(":", false)).toBe("time");
  });
  it("Shift+';' も time として扱う", () => {
    expect(classifyQuickInsertKey(";", true)).toBe("time");
  });
  it("関係ないキーは null", () => {
    expect(classifyQuickInsertKey("a", false)).toBeNull();
  });
});
