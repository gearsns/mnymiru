import { onMount, onCleanup } from 'solid-js';

// キー設定の型定義
type ShortcutMap = {
    [key: string]: (e: KeyboardEvent) => void;
};

export const createShortcuts = (map: ShortcutMap) => {
    onMount(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (['control', 'shift', 'alt', 'meta'].includes(key)) return;

            // 押されたキーから判定用の文字列を作成 (例: "ctrl+d")
            const modifiers: string[] = [];
            if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
            if (e.shiftKey) modifiers.push('shift');
            if (e.altKey) modifiers.push('alt');

            const shortcutStr = modifiers.length > 0
                ? `${modifiers.join('+')}+${key}`
                : key;

            const handler = map[shortcutStr];
            if (handler) {
                e.preventDefault();
                handler(e);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        onCleanup(() => {
            window.removeEventListener('keydown', handleKeyDown);
        });
    });
};
