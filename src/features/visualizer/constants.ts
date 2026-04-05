export interface ChartLabel {
  key: string;
  color: string;
}

export interface ChartValue {
  month: number;
  [key: string]: number | boolean;
}

export interface BarPropsState {
  hover: string | null;
  [key: string]: boolean | string | null;
}

export const INPUT_DATA = {
  dataKey: "month",
  oyLabel: "月",
  oxLabel: "金額",
  xLimit: [0, 'dataMax'] as [number, string | number],
  yLimit: [1, 12],
};

export const COLORS = [
  '#47395c', '#5c619f', '#5f8bce', '#8bafdf', '#f1b847', '#a5565c',
  '#736389', '#8c8ed0', '#92bbff', '#bde1ff', '#bb880f', '#732a33',
  '#a291b9', '#bdbeff', '#c6edff', '#f1ffff', '#865c00', '#43000c',
];

export const INITIAL_VALUES = Array.from({ length: 12 }, (_, i) => ({ month: i + 1 }));