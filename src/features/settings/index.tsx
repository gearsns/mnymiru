import { GeminiError, listAvailableModels, type GeminiModelOption } from "@/lib/gemini";
import { createSignal, For, onMount, Show } from "solid-js";
import styles from "./style.module.css";
import { settingsStore } from "@/store/settingsStore";
import { createSettingsState } from "@/hooks/settingsState";

export const SettingsModal = () => {
    const { settings, updateSettings } = createSettingsState();

    const [apiKey, setApiKey] = createSignal(settings().apiKey);
    const [model, setModel] = createSignal(settings().model);
    const [showKey, setShowKey] = createSignal(false);

    const [models, setModels] = createSignal<GeminiModelOption[]>([]);
    const [modelsLoading, setModelsLoading] = createSignal(false);
    const [modelsError, setModelsError] = createSignal<string | null>(null);
    const [manualEntry, setManualEntry] = createSignal(false);

    const fetchModels = async () => {
        if (!apiKey().trim()) {
            setModelsError("先にAPIキーを入力してください。");
            return;
        }
        setModelsLoading(true);
        setModelsError(null);
        try {
            const list = await listAvailableModels(apiKey());
            setModels(list);
            if (list.length === 0) {
                setModelsError("利用可能なモデルが見つかりませんでした。APIキーの権限を確認してください。");
            } else if (!list.some((m) => m.id === model())) {
                // Keep an existing valid selection; otherwise default to the first option.
                setModel(list[0].id);
            }
        } catch (err) {
            setModelsError(err instanceof GeminiError ? err.message : "モデル一覧の取得に失敗しました。");
        } finally {
            setModelsLoading(false);
        }
    };

    onMount(() => {
        if (settings().apiKey) void fetchModels();
    });

    const handleSave = () => {
        updateSettings({ apiKey: apiKey().trim(), model: model().trim() });
        settingsStore.close();
    };

    return (
        <Show when={settingsStore.isOpen()}>
            <div class={styles.overlay} onClick={settingsStore.close}><div onClick={(e) => e.stopPropagation()}>
                <div class={styles.header}>
                    <span>
                        設定
                    </span>
                    <button class={styles["icon-button"]} onClick={settingsStore.close} aria-label="閉じる">
                        ✕
                    </button>
                </div>

                <div class={styles.body}>
                    <div class={styles.field}>
                        <label for="api-key">Gemini APIキー</label>
                        <input
                            id="api-key"
                            type={showKey() ? "text" : "password"}
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck={false}
                            placeholder="AIza..."
                            value={apiKey()}
                            onInput={(e) => setApiKey(e.currentTarget.value)}
                        />
                        <button
                            type="button"
                            class={styles["text-button"]}
                            style={{ "align-self": "flex-start" }}
                            onClick={() => setShowKey((v) => !v)}
                        >
                            {showKey() ? "キーを隠す" : "キーを表示"}
                        </button>
                        <p class={styles.hint}>
                            Google AI Studio で発行したAPIキーを入力してください。キーは端末内（localStorage）にのみ保存され、
                            レシート画像はこのキーを使って直接 Google の API に送信されます。
                        </p>
                    </div>

                    <div class={styles.field}>
                        <div class={styles["row-header"]}>
                            <label for="model">モデル</label>
                            <button type="button" class={styles["text-button"]} onClick={() => void fetchModels()}>
                                {modelsLoading() ? "取得中…" : "一覧を更新"}
                            </button>
                        </div>

                        <Show
                            when={!manualEntry() && models().length > 0}
                            fallback={
                                <input
                                    id="model"
                                    type="text"
                                    autocomplete="off"
                                    autocapitalize="off"
                                    spellcheck={false}
                                    placeholder="例: gemini-2.5-flash"
                                    value={model()}
                                    onInput={(e) => setModel(e.currentTarget.value)}
                                />
                            }
                        >
                            <select
                                id="model"
                                value={model()}
                                onChange={(e) => setModel(e.currentTarget.value)}
                            >
                                <For each={models()}>
                                    {(m) => (
                                        <option value={m.id}>
                                            {m.displayName === m.id ? m.id : `${m.displayName} (${m.id})`}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </Show>

                        <button
                            type="button"
                            class={styles["text-button"]}
                            style={{ "align-self": "flex-start" }}
                            onClick={() => setManualEntry((v) => !v)}
                        >
                            {manualEntry() ? "一覧から選ぶ" : "モデル名を直接入力する"}
                        </button>

                        <Show when={modelsError()}>
                            <p class="hint error">{modelsError()}</p>
                        </Show>
                        <p class={styles.hint}>
                            「一覧を更新」でAPIキーが使えるモデルをGoogle AI Studioから自動取得します。画像入力に対応しないモデル
                            （埋め込み・音声・画像生成専用モデルなど）は一覧から除外しています。
                        </p>
                    </div>

                    <button class={styles["primary-button"]} onClick={handleSave}>
                        保存する
                    </button>
                </div>
            </div></div>
        </Show>
    );
}
