import { describe, expect, it } from "vitest";
import { filterResults, getSortedCounts } from "./autocomplete";
import type { TableData } from "../../../db/types";

describe('autocomplete logic', () => {
  it('出現回数が多い順にソートされること', () => {
    const mockData = [
      { item_name: '食費' },
      { item_name: '通信費' },
      { item_name: '食費' },
    ] as unknown as TableData;
    const result = getSortedCounts(mockData, 'item_name');
    
    expect(result[0]).toEqual(['食費', 2]);
    expect(result[1]).toEqual(['通信費', 1]);
  });

  it('Migemoの正規表現で正しくフィルタリングされ、重複が排除されること', () => {
    const curItems: [string, number][] = [['リンゴ', 5], ['バナナ', 2]];
    const dbItems = [{ value: 'リンゴ' }, { value: 'ミカン' }];
    const regex = /リンゴ|ミカン/i; // Migemoが生成したと想定される正規表現

    const result = filterResults(curItems, dbItems, regex);

    // リンゴが重複せず、かつマッチするものだけが含まれる
    expect(result).toEqual(['リンゴ', 'ミカン']);
    expect(result).not.toContain('バナナ');
  });

  it('最大件数（20件）を超えないこと', () => {
    const curItems: [string, number][] = Array.from({ length: 30 }, (_, i) => [`item${i}`, 1]);
    const regex = /item/i;
    
    const result = filterResults(curItems, [], regex);
    expect(result).toHaveLength(20);
  });
});