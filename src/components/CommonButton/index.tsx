import { Button as KobalteButton } from "@kobalte/core/button";
import styles from "./style.module.css";
import { splitProps, type JSX } from "solid-js";

export type CommonButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
};

export function CommonButton(props: CommonButtonProps) {
    // splitProps で Kobalte に渡すプロパティと独自拡張を分離します
    // （今回はラッパーなのでそのまま rest を流してもOKです）
    const [local, rest] = splitProps(props, [
        "class",
        "children",
    ]);

    return (
        <KobalteButton
            class={`${styles.button} ${local.class ?? ""}`}
            {...rest}
        >
            {local.children}
        </KobalteButton>
    );
}
