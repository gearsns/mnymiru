import { describe, it, expect } from 'vitest';
import { getLastDayOfMonth, getNextMonth, getWeekdayNames, isEmpty, isValidDay } from '.';

describe('Utility Functions Test', () => {
    describe('isEmpty', () => {
        it('nullまたはundefinedの場合、trueを返すこと', () => {
            expect(isEmpty(null)).toBe(true);
            expect(isEmpty(undefined)).toBe(true);
        });

        it('空文字の場合、trueを返すこと', () => {
            expect(isEmpty('')).toBe(true);
        });

        it('一文字以上の文字列、または数値の場合、falseを返すこと', () => {
            expect(isEmpty('a')).toBe(false);
            expect(isEmpty(' ')).toBe(false); // スペースは空文字ではない
            expect(isEmpty(0)).toBe(false);
            expect(isEmpty(false)).toBe(false);
        });
    });

    describe('getWeekdayNames', () => {
        it('指定した日付の曜日（日本語・英語）が正しく返ってくること', () => {
            // 2024年1月1日は月曜日
            const [jp, en] = getWeekdayNames(2024, 0, 1);
            expect(jp).toBe('月');
            expect(en).toBe('mon');
        });

        it('日曜日の場合、正しく返ってくること', () => {
            // 2024年1月7日は日曜日
            const [jp, en] = getWeekdayNames(2024, 0, 7);
            expect(jp).toBe('日');
            expect(en).toBe('sun');
        });
    });

    describe('isValidDay', () => {
        it('有効な日付（月初・月末）に対してtrueを返すこと', () => {
            expect(isValidDay(2024, 0, 1)).toBe(true);  // 1月1日
            expect(isValidDay(2024, 0, 31)).toBe(true); // 1月31日
        });

        it('存在しない日付（32日など）に対してfalseを返すこと', () => {
            expect(isValidDay(2024, 0, 32)).toBe(false);
            expect(isValidDay(2024, 3, 31)).toBe(false); // 4月31日は存在しない
        });

        it('うるう年の2月29日を正しく判定できること', () => {
            expect(isValidDay(2024, 1, 29)).toBe(true);  // 2024年はうるう年
            expect(isValidDay(2023, 1, 29)).toBe(false); // 2023年は平年
        });

        it('0以下の数値に対してfalseを返すこと', () => {
            expect(isValidDay(2024, 0, 0)).toBe(false);
            expect(isValidDay(2024, 0, -1)).toBe(false);
        });
    });

    describe('getNextMonth', () => {
        it('指定した月数だけ未来の日付が取得できること', () => {
            const baseDate = new Date(2024, 0, 15); // 2024年1月15日
            const nextDate = getNextMonth(2, baseDate); // 2ヶ月後
            expect(nextDate.getFullYear()).toBe(2024);
            expect(nextDate.getMonth()).toBe(2); // 3月 (0始まり)
            expect(nextDate.getDate()).toBe(15);
        });

        it('指定した月数だけ過去の日付が取得できること', () => {
            const baseDate = new Date(2024, 3, 10); // 2024年4月10日
            const prevDate = getNextMonth(-1, baseDate); // 1ヶ月前
            expect(prevDate.getFullYear()).toBe(2024);
            expect(prevDate.getMonth()).toBe(2); // 3月 (0始まり)
            expect(prevDate.getDate()).toBe(10);
        });

        it('引数に日付が渡されない場合、現在基準で計算されること', () => {
            const result = getNextMonth(0);
            expect(result).toBeInstanceOf(Date);
        });
    });

    describe('getLastDayOfMonth', () => {
        it('各月の末日が正しく取得できること', () => {
            expect(getLastDayOfMonth(new Date(2024, 0, 15))).toBe(31); // 1月
            expect(getLastDayOfMonth(new Date(2024, 3, 10))).toBe(30); // 4月
        });

        it('うるう年の2月の末日を正しく取得できること', () => {
            expect(getLastDayOfMonth(new Date(2024, 1, 10))).toBe(29); // 2024年はうるう年
            expect(getLastDayOfMonth(new Date(2023, 1, 10))).toBe(28); // 2023年は平年
        });
    });
});
