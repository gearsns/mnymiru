import './App.css'
import { TopMenu } from './features/menu'
import { ConfirmModalProvider } from '@/components/ConfirmModal'
import { MessageProvider } from '@/components/Message'
import { getWorker } from './services/sqliteClient'
import { Image } from "@kobalte/core/image";
import { Link } from "@kobalte/core/link";
import { DockviewSolid, themeLight, type DockviewReadyEvent, type IDockviewPanelProps, type PanelParameters } from '@arminmajerie/dockview-solid'
import '@arminmajerie/dockview-solid/styles/dockview.css';
import { Editor } from './features/editor'
import { Searcher } from './features/searcher'
import { Reporter } from './features/reporter'
import { Visualizer } from './features/visualizer'
import { getMigemo } from './services/migemo'
import { createFileAction } from './hooks/fileAction'
import { createEffect, onMount, Show } from 'solid-js'
import { dataStore, setIsLoading } from './store/dataStore'
import { SettingsModal } from './features/settings'
import { Receipt } from './features/receipt'

type CustomPanelParams = PanelParameters & {
    kind?: 'editor' | 'searcher' | 'reporter' | 'visualizer' | 'receipt';
    [key: string]: any;
};

function PanelContent(props: IDockviewPanelProps<CustomPanelParams>) {
    const kind = props.params?.kind;

    switch (kind) {
        case 'editor':
            return <Editor />;
        case 'searcher':
            return <Searcher />;
        case 'reporter':
            return <Reporter />;
        case 'visualizer':
            return <Visualizer />;
        case 'receipt':
            return <Receipt />;
        default:
            return <div />;
    }
}

function App() {
    const { openSession } = createFileAction();

    onMount(() => {

    });

    createEffect(() => {
        if (dataStore.fileName) {
            document.title = `${dataStore.fileName} - MnyMiru`;
        } else {
            document.title = `MnyMiru`;
        }
    });

    const handleReady = (event: DockviewReadyEvent) => {
        const api = event.api;
        if (!api) return;
        api.closeAllGroups();
        // 1. まず上側に「インプットシート」を追加
        const editorPanel = api.addPanel({
            id: 'editor',
            component: 'panelContent',
            title: '入力',
            params: { kind: 'editor' },
        });

        // 2. 下側に「検索シート」を追加 (inputPanelの下に配置)
        const searcherPanel = api.addPanel({
            id: 'searcher',
            component: 'panelContent',
            title: '検索',
            params: { kind: 'searcher' },
            position: {
                referencePanel: editorPanel,
                direction: 'below', // 下側に分割
            },
        });

        // 3. 検索シートと同じタブエリア（あるいはタブの隣）に「グラフシート」を追加したい場合
        // 下側のエリアにタブとして追加したいときは以下のようにします
        const visualizerPanel = api.addPanel({
            id: 'visualizer',
            component: 'panelContent',
            title: 'グラフ',
            params: { kind: 'visualizer' },
            position: {
                referencePanel: searcherPanel,
                direction: 'within', // 同じグループにタブとして追加
            },
        });
        const panelContent = api.addPanel({
            id: 'reporter',
            component: 'panelContent',
            title: '上位支出',
            params: { kind: 'reporter' },
            position: {
                referencePanel: visualizerPanel,
                direction: 'within', // 同じグループにタブとして追加
            },
        });
        api.addPanel({
            id: 'receipt',
            component: 'panelContent',
            title: 'レシート',
            params: { kind: 'receipt' },
            position: {
                referencePanel: panelContent,
                direction: 'within', // 同じグループにタブとして追加
            },
        });
        searcherPanel.api.setActive();
        editorPanel.api.setActive();
        setIsLoading(true);
        const start = async () => {
            getWorker();
            getMigemo();
            try {
                await openSession();
            } catch {

            } finally {
                setIsLoading(false);
            }
        }
        start();
    };

    return (
        <>
            <ConfirmModalProvider />
            <MessageProvider />
            <SettingsModal />
            <Show when={dataStore.isLoading}>
                <div class="loading">
                    <div></div>
                </div>
            </Show>
            <header class="header">
                <TopMenu /><Image class="menu">
                    <Image.Img src="./image/app.svg" />
                </Image>{import.meta.env.PACKAGE_DISPLAY_NAME} {import.meta.env.PACKAGE_VERSION}
                <Link class="link" href="https://github.com/gearsns/mnymiru" target="_blank">
                    <Image>
                        <Image.Img class="github" src="./image/github.svg" />
                    </Image>
                </Link>
            </header>
            <main class="main">
                <DockviewSolid
                    theme={themeLight}
                    components={{ panelContent: PanelContent }}
                    onReady={handleReady}
                />
            </main>
        </>
    );
}

export default App;
