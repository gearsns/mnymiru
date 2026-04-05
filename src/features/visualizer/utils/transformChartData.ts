import type { TopMonth } from "../../../db/types";
import { COLORS, type ChartValue } from "../constants";

export const transformChartData = (data: TopMonth[]) => {
  const values: ChartValue[]  = Array.from({ length: 12 }, (_, i) => ({ month: i + 1 }));
  const itemKeys = new Set<string>();

  data.forEach((item) => {
	const month = Math.trunc(item.year_month) % 100;
	const name = item.item_name || "[未指定]";
	const amount = -item.total;
	values[month - 1][name] = amount;
	itemKeys.add(name);
  });

  const labels = Array.from(itemKeys).map((key, index) => ({
	key,
	color: COLORS[index % COLORS.length],
  }));

  return { values, labels };
};