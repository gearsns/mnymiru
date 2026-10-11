import { describe, expect, it } from "vitest";
import { isDoubleClick } from "./doubleClick";

const opts = { maxIntervalMs: 400, maxDistancePx: 4 };

describe("isDoubleClick", () => {
  it("直前のクリックが無ければ false", () => {
    expect(isDoubleClick(null, { row: 0, col: 0, x: 0, y: 0, time: 100 }, opts)).toBe(false);
  });

  it("同じセル・近い位置・短い間隔なら true", () => {
    const prev = { row: 1, col: 1, x: 10, y: 10, time: 1000 };
    const next = { row: 1, col: 1, x: 12, y: 11, time: 1200 };
    expect(isDoubleClick(prev, next, opts)).toBe(true);
  });

  it("違うセルなら false", () => {
    const prev = { row: 1, col: 1, x: 10, y: 10, time: 1000 };
    const next = { row: 1, col: 2, x: 10, y: 10, time: 1100 };
    expect(isDoubleClick(prev, next, opts)).toBe(false);
  });

  it("間隔が長すぎれば false", () => {
    const prev = { row: 1, col: 1, x: 10, y: 10, time: 1000 };
    const next = { row: 1, col: 1, x: 10, y: 10, time: 1000 + opts.maxIntervalMs };
    expect(isDoubleClick(prev, next, opts)).toBe(false);
  });

  it("位置が離れすぎていれば false", () => {
    const prev = { row: 1, col: 1, x: 10, y: 10, time: 1000 };
    const next = { row: 1, col: 1, x: 10 + opts.maxDistancePx, y: 10, time: 1100 };
    expect(isDoubleClick(prev, next, opts)).toBe(false);
  });
});
