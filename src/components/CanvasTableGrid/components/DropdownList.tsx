/**
 * 【部品: components / ドロップダウン候補リスト】
 * セル編集中に出す候補リストの「見た目」。状態は controller/dropdownState.ts、
 * 配置の計算は lib/dropdownPlacement.ts、スタイルは styles.ts にある。
 */
import { createEffect, createMemo, For, Show, type Component } from "solid-js";
import { computeDropdownPlacement } from "../lib/dropdownPlacement";
import type { GridController } from "../controller";
import { dropdownContainerStyle, dropdownItemStyle, dropdownMessageStyle } from "../styles";

export const DropdownList: Component<{
    ctrl: GridController;
    /** ルート要素（配置の基準となるサイズを得るため） */
    rootEl: () => HTMLDivElement | undefined;
}> = (props) => {
    const ctrl = props.ctrl;
    let mouseDriven = false;

    /** ドロップダウンの配置（セルの下 or 上、画面端の補正）を計算する */
    const dropdownPlacement = createMemo(() => {
        const d = ctrl.dropdown();
        if (!d) return null;

        const root = props.rootEl();
        return computeDropdownPlacement(ctrl.cellRect(d.row, d.col), {
            width: root?.clientWidth ?? 0,
            height: root?.clientHeight ?? 0,
        });
    });

    return (
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
    );
};
