import { describe, expect, it } from "vitest";
import { calculateNumberStyle } from "./myNumberLogic";

describe('calculateNumberStyle', () => {
    it('正の数がexpensesの場合、ネガティブなクラスが適用されること', () => {
        const [className, displayValue] = calculateNumberStyle(1000, 'expenses');
        expect(className).toBe('cell_negative_num');
        expect(displayValue).toBe('1,000');
    });

    it('負の数がexpensesの場合、ポジティブなクラスが適用されること', () => {
        const [className, displayValue] = calculateNumberStyle(-500, 'expenses');
        expect(className).toBe('cell_positive_num');
        expect(displayValue).toBe('-500');
    });

    it('0の場合は空文字を返すこと', () => {
        const [_className, displayValue] = calculateNumberStyle(0, 'income');
        expect(displayValue).toBe('');
    });

    it('不正な文字列の場合はエラー用クラスを返すこと', () => {
        const [className, _displayValue] = calculateNumberStyle('abc', 'expenses');
        expect(className).toBe('cell_num_error');
    });

    it('空の値（null/undefined）の場合はnullを返し、何もしないことを示すこと', () => {
        const [className, displayValue] = calculateNumberStyle(null, 'expenses');
        expect(className).toBeUndefined();
        expect(displayValue).toBeUndefined();
    });
});