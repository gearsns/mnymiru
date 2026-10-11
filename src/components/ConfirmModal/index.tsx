import { createSignal, type JSX } from "solid-js";
import * as Dialog from "@kobalte/core/dialog";
import styles from './style.module.css'

export interface ConfirmOptions {
    title: string;
    content: string | JSX.Element;
    okText?: string;
    cancelText?: string;
    onOk?: () => void | Promise<void>;
    onCancel?: () => void;
}

// グローバルな状態
const [isOpen, setIsOpen] = createSignal(false);
const [options, setOptions] = createSignal<ConfirmOptions>({
    title: "",
    content: "",
});

export const Modal = {
    confirm(opts: ConfirmOptions) {
        setOptions({
            okText: opts.okText ?? "はい",
            cancelText: opts.cancelText ?? "いいえ",
            ...opts,
        });
        setIsOpen(true);
        console.log("OK1")
    },
    close() {
        setIsOpen(false);
    },
};

export function ConfirmModalProvider() {
    const handleOk = async () => {
        try {
            await options().onOk?.();
        } finally {
            Modal.close();
        }
    };

    const handleCancel = () => {
        options().onCancel?.();
        Modal.close();
    };

    return (
        <Dialog.Root open={isOpen()} onOpenChange={setIsOpen}>
            <Dialog.Portal>
                <Dialog.Overlay class={styles["dialog-overlay"]} />
                <div class={styles["dialog-positioner"]}>
                    <Dialog.Content class={styles["dialog-content"]}>
                        <Dialog.Title class={styles["dialog-title"]}>
                            {options().title}
                        </Dialog.Title>
                        <Dialog.Description class={styles["dialog-description"]}>
                            {options().content}
                        </Dialog.Description>

                        <div class={styles["dialog-buttons"]}>
                            <button
                                type="button"
                                class={styles["btn btn-secondary"]}
                                onClick={handleCancel}
                            >
                                {options().cancelText}
                            </button>
                            <button
                                type="button"
                                class={styles["btn btn-danger"]}
                                onClick={handleOk}
                            >
                                {options().okText}
                            </button>
                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
