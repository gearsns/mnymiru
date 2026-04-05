import { describe, it, expect } from 'vitest';
import { transformChartData } from './transformChartData';
import { COLORS } from '../constants';
import type { TopMonth } from '../../../db/types';

describe('transformChartData', () => {
  // 1. 12ヶ月分の配列が生成されているか
  it('12ヶ月分の空のデータ構造を初期化すること', () => {
    const { values } = transformChartData([]);
    expect(values).toHaveLength(12);
    expect(values[0]).toEqual({ month: 1 });
    expect(values[11]).toEqual({ month: 12 });
  });

  // 2. 基本的なデータ変換と金額の反転
  it('データを正しく変換し、金額の符号を反転させること', () => {
    const mockData = [
      { year_month: 202401, item_name: '食費', total: -5000 },
      { year_month: 202402, item_name: '光熱費', total: -12000 }
    ];

    const { values, labels } = transformChartData(mockData);

    // valuesの検証 (1月はindex 0)
    expect(values[0]['食費']).toBe(5000);  // -(-5000)
    expect(values[1]['光熱費']).toBe(12000);

    // labelsの検証
    expect(labels).toContainEqual({ key: '食費', color: COLORS[0] });
    expect(labels).toContainEqual({ key: '光熱費', color: COLORS[1] });
  });

  // 3. 名前が未指定（null/undefined）の場合の処理
  it('item_nameが欠落している場合、[未指定]として処理すること', () => {
    const mockData = [
      { year_month: 202403, item_name: null as unknown, total: -100 }
    ] as TopMonth[];

    const { values, labels } = transformChartData(mockData);

    expect(values[2]['[未指定]']).toBe(100);
    expect(labels[0].key).toBe('[未指定]');
  });

  // 4. カラーの配列を超えた場合のループ処理
  it('アイテム数がCOLORSの数を超えた場合、色をループさせること', () => {
    // COLORSの長さ+1個のユニークなアイテムを作成
    const mockData = Array.from({ length: COLORS.length + 1 }, (_, i) => ({
      year_month: 202401,
      item_name: `Item ${i}`,
      total: -100
    }));

    const { labels } = transformChartData(mockData);

    // 最後の要素の色が COLORS[0] と一致するか確認
    expect(labels[COLORS.length].color).toBe(COLORS[0]);
  });
});