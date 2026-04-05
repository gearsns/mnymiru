import { expect, test, vi } from 'vitest';
import { TopMenu } from './TopMenu';
import { render } from 'vitest-browser-react';
import { createFileHandlers } from './fileHandlers';

// 1. 依存する外部フック（dexieなど）を最小限にモック
vi.mock('../../lib/dexie', () => ({
    db: {
        history: {
            orderBy: () => ({
                reverse: () => ({
                    toArray: async () => [] // とりあえず履歴空
                })
            })
        }
    }
}));
vi.mock('./fileHandlers', () => ({
    createFileHandlers: vi.fn(),
}));

// 2. createFileHandlers の戻り値をスパイできるようにする
const mockHandlers = {
    handleNew: vi.fn(),
    handleOpen: vi.fn(),
    handleOpenDir: vi.fn(),
    handleRecentOpen: vi.fn(),
    handleSave: vi.fn(),
    handleExportDb: vi.fn(),
    handleExportCsv: vi.fn(),
};

vi.mocked(createFileHandlers).mockReturnValue(mockHandlers);

test('File System Access APIがサポートされている場合、フォルダを開くメニューが表示される', async () => {
    // ブラウザ環境にAPIが存在することを保証（Playwright/Chromiumならデフォルトであるはず）
    expect(window.showDirectoryPicker).toBeDefined();

    const screen = await render(<TopMenu />);

    // ドロワーを開くボタンをクリック
    const menuButton = screen.getByRole('button');
    await menuButton.click();

    // 「フォルダを開く」というテキストが表示されているか
    await screen.getByText('フォルダを開く').click();
    expect(mockHandlers.handleOpenDir).toHaveBeenCalled();
});

test('showDirectoryPicker をモックしてファイル操作をシミュレートする', async () => {
    // 実際のブラウザのダイアログは自動テストでは操作できないため、
    // APIそのものをスパイして「ディレクトリを選択した」という体にする
    const mockHandle = { kind: 'directory', name: 'my-project' };
    const showSpy = vi.spyOn(window, 'showDirectoryPicker').mockResolvedValue(mockHandle as unknown as FileSystemDirectoryHandle);
    const testHandlers = {
        ...mockHandlers, // 他の vi.fn() をコピー
        handleOpenDir: async () => {
            await window.showDirectoryPicker(); // ここでスパイ対象のAPIを叩く
        }
    };
    vi.mocked(createFileHandlers).mockReturnValue(testHandlers);
    const screen = await render(<TopMenu />);

    await screen.getByRole('button').click();
    await new Promise(r => setTimeout(r, 500));
    await (screen.getByText('フォルダを開く')).click();

    // handleOpenDir が呼ばれ、内部で showDirectoryPicker が呼ばれたことを確認
    expect(showSpy).toHaveBeenCalled();

    showSpy.mockRestore();
});