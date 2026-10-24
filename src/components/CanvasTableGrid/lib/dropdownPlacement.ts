import type { Rect } from "./geometry";

export const DROPDOWN_MAX_HEIGHT = 220;
export const DROPDOWN_MIN_WIDTH = 160;
export const DROPDOWN_EDGE_MARGIN = 4;

export interface DropdownPlacement {
  /** セルの上に開くか（下に収まらず、上のほうが広いとき true） */
  openUp: boolean;
  left: number;
  /** 下に開くときの top */
  top: number;
  /** 上に開くときの bottom（実際の高さに依存しないよう bottom 基準にする） */
  bottom: number;
  minWidth: number;
  maxHeight: number;
}

/**
 * ドロップダウンの配置（セルの下 or 上、画面端の補正）を計算する。
 * cell は canvas（ルート要素）ローカル座標でのセル矩形。
 */
export function computeDropdownPlacement(cell: Rect, root: { width: number; height: number }): DropdownPlacement {
  const spaceBelow = root.height - (cell.y + cell.h) - DROPDOWN_EDGE_MARGIN;
  const spaceAbove = cell.y - DROPDOWN_EDGE_MARGIN;

  // 下に収まらず、上のほうが広ければ上に開く
  const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
  const available = openUp ? spaceAbove : spaceBelow;

  const minWidth = Math.max(cell.w, DROPDOWN_MIN_WIDTH);
  // 右端からはみ出す場合は左にずらす（左端は 0 で止める）
  const left = Math.max(0, Math.min(cell.x, root.width - minWidth - DROPDOWN_EDGE_MARGIN));

  return {
    openUp,
    left,
    top: cell.y + cell.h,
    bottom: root.height - cell.y,
    minWidth,
    maxHeight: Math.max(60, Math.min(DROPDOWN_MAX_HEIGHT, available)),
  };
}
