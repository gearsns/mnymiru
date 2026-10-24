import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import styles from './style.module.css';

export interface StackedBarSeries {
  key: string;
  color: string;
}

export interface StackedBarChartProps {
  /** X軸ラベル（例: ['1月', ..., '12月']） */
  categories: string[];
  /** 積み上げる項目（積み上げ順 = 配列順、下から上） */
  series: StackedBarSeries[];
  /** categories と同じ長さ。values[i][series.key] が金額 */
  values: Array<Record<string, unknown>>;
  /** ツールチップの単位など */
  formatValue?: (v: number) => string;
}

type Hover = { i: number; key: string; x: number; y: number } | null;

const MARGIN = { top: 8, right: 12, bottom: 26, left: 56 };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0; // 積み上げは正の値のみ
};

function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const n = Math.ceil(max / step);
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

export function StackedBarChart(props: StackedBarChartProps) {
  let plotEl!: HTMLDivElement;
  const [size, setSize] = createSignal({ w: 600, h: 300 });
  const [hidden, setHidden] = createSignal<Set<string>>(new Set());
  const [hover, setHover] = createSignal<Hover>(null);

  const fmt = (v: number) => (props.formatValue ?? ((n: number) => `${n.toLocaleString('ja-JP')}円`))(v);

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(width, 0), h: Math.max(height, 0) });
    });
    ro.observe(plotEl);
    onCleanup(() => ro.disconnect());
  });

  const toggle = (key: string) => {
    setHover(null);
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const visible = createMemo(() => props.series.filter((s) => !hidden().has(s.key)));

  const totals = createMemo(() =>
    props.categories.map((_, i) => visible().reduce((sum, s) => sum + num(props.values[i]?.[s.key]), 0)),
  );

  const ticks = createMemo(() => niceTicks(Math.max(0, ...totals())));
  const yMax = () => ticks()[ticks().length - 1];

  const innerW = () => Math.max(size().w - MARGIN.left - MARGIN.right, 0);
  const innerH = () => Math.max(size().h - MARGIN.top - MARGIN.bottom, 0);
  const yPos = (v: number) => MARGIN.top + innerH() - (v / yMax()) * innerH();

  const bars = createMemo(() => {
    const band = innerW() / Math.max(props.categories.length, 1);
    const barW = band * 0.72;
    return props.categories.flatMap((_, i) => {
      const x = MARGIN.left + band * i + (band - barW) / 2;
      let acc = 0;
      return visible().flatMap((s) => {
        const v = num(props.values[i]?.[s.key]);
        if (v === 0) return [];
        const y0 = yPos(acc);
        acc += v;
        const y1 = yPos(acc);
        return [{ i, key: s.key, color: s.color, value: v, x, w: barW, y: y1, h: y0 - y1 }];
      });
    });
  });

  const onMove = (e: MouseEvent, i: number, key: string) => {
    const r = plotEl.getBoundingClientRect();
    setHover({ i, key, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const hovered = createMemo(() => {
    const h = hover();
    if (!h) return null;
    const s = props.series.find((x) => x.key === h.key);
    if (!s) return null;
    return { ...h, color: s.color, value: num(props.values[h.i]?.[h.key]), total: totals()[h.i] };
  });

  return (
    <div class={styles.root}>
      <div class={styles.legend} role="group" aria-label="項目の表示切替">
        <For each={props.series}>
          {(s) => (
            <button
              type="button"
              class={styles.legendItem}
              classList={{ [styles.off]: hidden().has(s.key) }}
              aria-pressed={!hidden().has(s.key)}
              onClick={() => toggle(s.key)}
            >
              <span class={styles.swatch} style={{ 'background-color': s.color }} />
              <span class={styles.legendText}>{s.key}</span>
            </button>
          )}
        </For>
      </div>

      <div class={styles.plot} ref={plotEl} onMouseLeave={() => setHover(null)}>
        <svg width={size().w} height={size().h} class={styles.svg}>
          {/* 横グリッド + Y軸ラベル */}
          <For each={ticks()}>
            {(t) => (
              <g>
                <line class={styles.grid} x1={MARGIN.left} x2={size().w - MARGIN.right} y1={yPos(t)} y2={yPos(t)} />
                <text class={styles.tick} x={MARGIN.left - 8} y={yPos(t)} text-anchor="end" dominant-baseline="middle">
                  {t.toLocaleString('ja-JP')}
                </text>
              </g>
            )}
          </For>

          {/* 縦グリッド + X軸ラベル */}
          <For each={props.categories}>
            {(c, i) => {
              const band = () => innerW() / Math.max(props.categories.length, 1);
              return (
                <g>
                  <line
                    class={styles.grid}
                    x1={MARGIN.left + band() * (i() + 1)}
                    x2={MARGIN.left + band() * (i() + 1)}
                    y1={MARGIN.top}
                    y2={MARGIN.top + innerH()}
                  />
                  <text
                    class={styles.tick}
                    x={MARGIN.left + band() * (i() + 0.5)}
                    y={MARGIN.top + innerH() + 16}
                    text-anchor="middle"
                  >
                    {c}
                  </text>
                </g>
              );
            }}
          </For>

          {/* 積み上げ棒 */}
          <For each={bars()}>
            {(b) => (
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={b.color}
                opacity={hover() && !(hover()!.i === b.i && hover()!.key === b.key) ? 0.6 : 1}
                onMouseEnter={(e) => onMove(e, b.i, b.key)}
                onMouseMove={(e) => onMove(e, b.i, b.key)}
              />
            )}
          </For>
        </svg>

        <Show when={props.series.length === 0}>
          <div class={styles.empty}>データがありません</div>
        </Show>

        <Show when={hovered()}>
          {(h) => (
            <div
              class={styles.tooltip}
              style={{
                left: `${h().x}px`,
                top: `${h().y}px`,
                transform: `translate(${h().x > size().w / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
              }}
            >
              <div class={styles.tipTitle}>{props.categories[h().i]}</div>
              <div class={styles.tipRow}>
                <span class={styles.swatchSm} style={{ 'background-color': h().color }} />
                <span>{h().key}</span>
                <strong>{fmt(h().value)}</strong>
              </div>
              <div class={styles.tipTotal}>
                <span>合計</span>
                <span>{fmt(h().total)}</span>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
