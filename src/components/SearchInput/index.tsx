import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import styles from './style.module.css';
interface JoinSearchProps {
    placeholder?: string;
    onSearch?: (value: string) => void;
}

export const SearchInput: Component<JoinSearchProps> = (props) => {
    const [value, setValue] = createSignal("");

    const handleSearch = () => {
        props.onSearch?.(value());
    };

    return (
        <div class={styles.root}>
            <div class={styles.main}>
                {/* 入力コンテナ（入力欄とクリアボタンをまとめる親） */}
                <div class={styles.content}>
                    <input
                        type="text"
                        placeholder={props.placeholder || "キーワードを入力..."}
                        value={value()}
                        onInput={(e) => setValue(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />

                    {/* クリアボタン（入力がある時だけ表示） */}
                    <Show when={value().length > 0}>
                        <button
                            type="button"
                            onClick={() => setValue("")}
                            title="クリア"
                        >
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </Show>
                </div>

                {/* 検索ボタン */}
                <button
                    type="button"
                    class={styles.search}
                    onClick={handleSearch}
                >
                    Search
                </button>
            </div>
        </div>
    );
};
