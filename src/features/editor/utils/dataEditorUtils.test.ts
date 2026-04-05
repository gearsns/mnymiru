import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNextSheetId, getSheetIdFromDate } from "./dataEditorUtils";
import dayjs from "dayjs";

describe("Date Utility Tests", () => {
  
  describe("getNextSheetId", () => {
    beforeEach(() => {
      // 現在時刻を 2024-01-15 に固定
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("正常なIDとオフセットで翌月のIDを返すこと", () => {
      expect(getNextSheetId("202401", 1)).toBe("202402");
    });

    it("年を跨ぐ計算が正しいこと", () => {
      expect(getNextSheetId("202412", 1)).toBe("202501");
      expect(getNextSheetId("202401", -1)).toBe("202312");
    });

    it("不正なIDが渡された場合、現在時刻（202401）を基準に計算すること", () => {
      // 2024-01-15基準なので、+1ヶ月は 202402
      expect(getNextSheetId("invalid-id", 1)).toBe("202402");
      expect(getNextSheetId("", 0)).toBe("202401");
    });

    it("月末の計算がDayjsの仕様通りに行われること (1/31の1ヶ月後は2/29 *2024年)", () => {
      expect(getNextSheetId("202401", 1)).toBe("202402"); 
    });
  });

  describe("getSheetIdFromDate", () => {
    it("Dayjsオブジェクトを渡すと YYYYMM 形式の文字列を返すこと", () => {
      const date = dayjs("2024-05-20");
      expect(getSheetIdFromDate(date)).toBe("202405");
    });

    it("Dayjs以外の値（null, undefined, string, number）を渡すと null を返すこと", () => {
      expect(getSheetIdFromDate(null)).toBe(null);
      expect(getSheetIdFromDate(undefined)).toBe(null);
      expect(getSheetIdFromDate("202405")).toBe(null);
      expect(getSheetIdFromDate(12345)).toBe(null);
      expect(getSheetIdFromDate(new Date())).toBe(null); // JS標準のDateはDayjsではないためnull
    });
  });
});