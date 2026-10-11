export interface ClickPoint {
  row: number;
  col: number;
  x: number;
  y: number;
  time: number;
}

/**
 * 直前のクリックと今回のクリックから、ダブルクリックとみなせるかを判定する。
 * pointerdown で preventDefault しているとブラウザは互換用マウスイベント
 * （click/dblclick）の発火を抑制することがあるため、自前でこの判定を行う。
 */
export function isDoubleClick(
  prev: ClickPoint | null,
  next: ClickPoint,
  opts: { maxIntervalMs: number; maxDistancePx: number }
): boolean {
  if (!prev) return false;
  if (prev.row !== next.row || prev.col !== next.col) return false;
  if (next.time - prev.time >= opts.maxIntervalMs) return false;
  if (Math.abs(next.x - prev.x) >= opts.maxDistancePx) return false;
  if (Math.abs(next.y - prev.y) >= opts.maxDistancePx) return false;
  return true;
}
