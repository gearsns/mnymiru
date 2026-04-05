import { describe, expect, it } from "vitest";
import { getDayDisplayInfo } from "./dayFormatter";

describe('getDayDisplayInfo', () => {
    it('正常な日付で表示情報（テキストとクラス名）を返すこと', () => {
        const result = getDayDisplayInfo(1, 202404); // 2024年4月1日(月)
        expect(result).toEqual({
            text: '1 (月)',
            className: 'cell_mon' // getWeekdayNamesの戻り値に依存
        });
    });

    it('空文字やnullの場合はnullを返すこと', () => {
        expect(getDayDisplayInfo('', 202404)).toBeNull();
        expect(getDayDisplayInfo(null, 202404)).toBeNull();
    });

    it('0以下の数値の場合はnullを返すこと', () => {
        expect(getDayDisplayInfo(0, 202404)).toBeNull();
        expect(getDayDisplayInfo(-1, 202404)).toBeNull();
    });

    it('year_monthが取得できない場合はnullを返すこと', () => {
        expect(getDayDisplayInfo(1, null)).toBeNull();
    });

    it('存在しない日付（例: 2月30日）の場合はnullを返すこと', () => {
        expect(getDayDisplayInfo(30, 202402)).toBeNull();
    });
});