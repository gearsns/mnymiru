import { createEffect, createMemo, For, Show, type Component } from "solid-js";
import { createGridController } from "./gridController";
import type { CanvasTableGridProps } from "./gridController";
import {
    rootStyle,
    canvasStyle,
    inputBaseStyle,
    dropdownContainerStyle,
    dropdownMessageStyle,
    dropdownItemStyle,
} from "./styles";

export type { CanvasTableGridProps, OnChangeHelpers, CellChange, CellDoubleClickInfo } from "./gridController";

export const CanvasTableGrid: Component<CanvasTableGridProps> = (props) => {
    const ctrl = createGridController(props);
    let mouseDriven = false;
    let rootEl: HTMLDivElement | undefined;

    const DROPDOWN_MAX_HEIGHT = 220;
    const DROPDOWN_MIN_WIDTH = 160;
    const EDGE_MARGIN = 4;

    /** ドロップダウンの配置（セルの下 or 上、画面端の補正）を計算する */
    const dropdownPlacement = createMemo(() => {
        const d = ctrl.dropdown();
        if (!d) return null;

        const r = ctrl.cellRect(d.row, d.col);
        const rootH = rootEl?.clientHeight ?? 0;
        const rootW = rootEl?.clientWidth ?? 0;

        const spaceBelow = rootH - (r.y + r.h) - EDGE_MARGIN;
        const spaceAbove = r.y - EDGE_MARGIN;

        // 下に収まらず、上のほうが広ければ上に開く
        const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
        const available = openUp ? spaceAbove : spaceBelow;

        const minWidth = Math.max(r.w, DROPDOWN_MIN_WIDTH);
        // 右端からはみ出す場合は左にずらす（左端は 0 で止める）
        const left = Math.max(0, Math.min(r.x, rootW - minWidth - EDGE_MARGIN));

        return {
            openUp,
            left,
            top: r.y + r.h,
            bottom: rootH - r.y, // 上に開くときは bottom 基準にして、実際の高さに依存しないようにする
            minWidth,
            maxHeight: Math.max(60, Math.min(DROPDOWN_MAX_HEIGHT, available)),
        };
    });

    return (
        <div
            ref={(el) => {
                rootEl = el;
                ctrl.setRootEl(el);
            }}
            style={rootStyle(ctrl.theme, props.style)}
        >
            <canvas ref={(el) => ctrl.setCanvasEl(el)} style={canvasStyle} />
            <input
                ref={(el) => ctrl.setInputEl(el)}
                style={inputBaseStyle(ctrl.theme)}
                autocomplete="off"
                spellcheck={false}
                onInput={ctrl.handleInput}
                onCompositionStart={ctrl.handleCompositionStart}
                onCompositionEnd={ctrl.handleCompositionEnd}
                onKeyDown={ctrl.handleKeyDown}
                onCopy={ctrl.handleCopy}
                onCut={ctrl.handleCut}
                onPaste={ctrl.handlePaste}
                onBlur={ctrl.handleBlur}
            />
            <Show when={ctrl.dropdown()}>
                <div
                    style={{
                        ...dropdownContainerStyle(ctrl.theme),
                        left: `${dropdownPlacement()!.left}px`,
                        ...(dropdownPlacement()!.openUp
                            ? { bottom: `${dropdownPlacement()!.bottom}px` }
                            : { top: `${dropdownPlacement()!.top}px` }),
                        "min-width": `${dropdownPlacement()!.minWidth}px`,
                        "max-height": `${dropdownPlacement()!.maxHeight}px`,
                    }}
                >
                    <Show when={ctrl.dropdown()!.loading}>
                        <div style={dropdownMessageStyle}>読み込み中…</div>
                    </Show>
                    <Show when={!ctrl.dropdown()!.loading}>
                        <For each={ctrl.filteredOptions()} fallback={<div style={dropdownMessageStyle}>該当なし</div>}>
                            {(opt, i) => {
                                let itemEl!: HTMLDivElement;

                                // ハイライトされた項目が変更されたときに、自動でスクロール位置を追従させる
                                createEffect(() => {
                                    if (ctrl.highlightedIndex() === i()) {
                                        if (mouseDriven) {
                                            mouseDriven = false;
                                            return;
                                        }
                                        itemEl.scrollIntoView({ block: "nearest" });
                                    }
                                });

                                return (
                                    <div
                                        ref={itemEl}
                                        onMouseMove={() => {
                                            if (ctrl.highlightedIndex() !== i()) {
                                                mouseDriven = true;
                                                ctrl.setHighlightedIndex(i());
                                            }
                                        }}
                                        // mousedown で preventDefault することで input からフォーカスが
                                        // 外れるのを防ぎ、blur による commitEdit より先に選択処理を行う
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            ctrl.selectDropdownOption(opt, 0, 0);
                                        }}
                                        style={dropdownItemStyle(ctrl.theme, i() === ctrl.highlightedIndex())}
                                    >
                                        {opt.label ?? (opt.value == null ? "" : String(opt.value))}
                                    </div>
                                );
                            }}
                        </For>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default CanvasTableGrid;
