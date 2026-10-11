import { createSignal } from "solid-js";

const [isOpen, setIsOpen] = createSignal(false);

export const settingsStore = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(!isOpen()),
};
