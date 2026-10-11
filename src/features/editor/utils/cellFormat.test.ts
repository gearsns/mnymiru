import { describe, it, expect, vi } from 'vitest';
import { getCellFormat } from './cellFormat'; // パスは適宜調整してください
import { ItemIndex } from '../constants';
import { getNumFormat as getNumFormatOrg } from "@/features/common/utils/numFormatter";

// 外部依存関数のモック
vi.mock('@/utils', () => ({
    getLastDayOfMonth: vi.fn(() => 31), // テスト用に31日を返す固定
}));

vi.mock('@/components/CanvasTableGrid', () => ({
    formatDate: vi.fn((_dateStr, format) => `formatted-${format}`),
}));

vi.mock('@/features/common/utils/numFormatter', () => ({
    getNumFormat: vi.fn((val) => ({ type: 'number', value: val })),
}));

describe('getCellFormat', () => {
    const baseDate = new Date(2026, 9, 1); // 2026年10月1日 (木)

    it('値が空の場合は type: "text" を返すこと', () => {
        const result = getCellFormat(1, ItemIndex.day, '', () => '', baseDate);
        expect(result).toEqual({ type: "text" });
    });

    describe('col === ItemIndex.day (日付列)', () => {
        it('月の最終日を超える値の場合は赤字のテキスト設定を返すこと', () => {
            const result = getCellFormat(1, ItemIndex.day, '32', () => '', baseDate);
            expect(result).toEqual({
                color: "#ff0000",
                type: "text",
            });
        });

        it('正常な日付で前行と日付けが異なる場合は通常の日付設定を返すこと', () => {
            const getCellMock = vi.fn().mockReturnValue('10'); // 前行は10日
            const result = getCellFormat(1, ItemIndex.day, '15', getCellMock, baseDate); // 当行は15日

            expect(result).toMatchObject({
                type: "date",
                align: "right",
            });
            // フォーマッタの動作確認
            if (result && typeof result.formatter === 'function') {
                expect(result.formatter(15)).toBe('formatted-D(ddd)');
            }
        });

        it('前行と同じ日付の場合はボーダーとカラー（透過）が調整されること', () => {
            const getCellMock = vi.fn().mockReturnValue('15'); // 前行も15日
            const result = getCellFormat(1, ItemIndex.day, '15', getCellMock, baseDate);

            expect(result).toMatchObject({
                type: "date",
                align: "right",
                border: { top: false },
            });
            // 透過カラーが付与されているか（カラーの末尾に '44' が追加される仕様）
            expect(result?.color?.endsWith('44')).toBe(true);
        });
    });

    describe('col === ItemIndex.shop_name / time (店舗名・時間列)', () => {
        it('日、店舗名、時間、アカウントのすべてが前行と同じ場合は、省略表示用のスタイルを返すこと', () => {
            const getCellMock = vi.fn((row, col) => {
                if (col === ItemIndex.day) return row === 0 ? '10' : '10';
                if (col === ItemIndex.shop_name) return 'スーパーA';
                if (col === ItemIndex.time) return '12:00';
                if (col === ItemIndex.account) return '現金';
                return '';
            });

            const result = getCellFormat(1, ItemIndex.shop_name, 'スーパーA', getCellMock, baseDate);

            expect(result).toEqual({
                type: "text",
                color: "#aaa",
                border: { top: false },
            });
        });

        it('条件が一致しない場合はデフォルトの undefined または text になること', () => {
            const getCellMock = vi.fn((row, col) => {
                if (col === ItemIndex.day) return '10';
                if (col === ItemIndex.shop_name) return row === 1 ? 'スーパーB' : 'スーパーA'; // 不一致
                return '';
            });

            const result = getCellFormat(1, ItemIndex.shop_name, 'スーパーA', getCellMock, baseDate);
            // 何も該当しない場合は関数の後半やデフォルトに進み、最終的に { type: "text" } などになる
            expect(result).toEqual({ type: "text" });
        });
    });

    describe('数値系列のフォーマット (expenses, incomes など)', () => {
        it('expenses の場合はマイナスに反転した値で numFormatter が呼ばれること', () => {
            getCellFormat(1, ItemIndex.expenses, '1000', () => '', baseDate);
            expect(getNumFormatOrg).toHaveBeenCalledWith(-1000);
        });

        it('incomes の場合はそのままの値で numFormatter が呼ばれること', () => {
            getCellFormat(1, ItemIndex.incomes, '5000', () => '', baseDate);
            expect(getNumFormatOrg).toHaveBeenCalledWith(5000);
        });
    });
});
