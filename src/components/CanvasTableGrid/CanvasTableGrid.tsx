/**
 * 【部品: components / CanvasTableGrid 本体】
 * JSX（DOM の組み立て）だけを持つ。振る舞いは controller/、描画は rendering/ にある。
 */
import type { Component } from "solid-js";
import { createGridController } from "./controller";
import type { CanvasTableGridProps } from "./controller";
import { DropdownList } from "./components/DropdownList";
import { rootStyle, canvasStyle, inputBaseStyle } from "./styles";

export type { CanvasTableGridProps, OnChangeHelpers, CellChange, CellDoubleClickInfo } from "./controller";

export const CanvasTableGrid: Component<CanvasTableGridProps> = (props) => {
    const ctrl = createGridController(props);
    let rootEl: HTMLDivElement | undefined;

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
            <DropdownList ctrl={ctrl} rootEl={() => rootEl} />
        </div>
    );
};

export default CanvasTableGrid;
