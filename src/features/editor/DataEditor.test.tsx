import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataEditor } from './DataEditor';
import { useDataEditor } from './useDataEditor';

vi.mock('../common/HotTableWrapper', () => ({
    HotTableWrapper: () => <div data-testid="mock-chart">Chart Mock</div>,
}));
// Hooksをモック化して、コンポーネントの「見た目」と「状態」の繋がりだけをテストする
vi.mock('./useDataEditor');
const mockedUseDataEditor = vi.mocked(useDataEditor);
type UseDataEditorReturn = ReturnType<typeof useDataEditor>;
describe('DataEditor Component', () => {
    it('ローディング中は「今月」ボタンや「DatePicker」が非活性（disabled）になること', () => {
        // isLoading: true の状態をシミュレート
        vi.mocked(mockedUseDataEditor).mockReturnValue({
            state: {
                isLoading: true,
                isFileDirty: false,
                activeSheetId: '202310',
                statusTotalText: '',
                statusShopTotalText: '',
                hotSettings: {}
            },
            handlers: {
                handleSave: vi.fn(),
                loadSheet: vi.fn(),
                handleSort: vi.fn(),
                moveMonth: vi.fn(),
                setCurDate: vi.fn(),
                onSearch: vi.fn(),
                handleDuplicateData: vi.fn(),
                handleSearch: vi.fn(),
            }
        } as UseDataEditorReturn);

        render(<DataEditor />);

        // antdのButtonがdisabledになっているか確認
        const thisMonthButton = screen.getByRole('button', { name: /今 月/ });
        expect(thisMonthButton).toBeDisabled();

        // Spin(ローディング)が表示されているか
        const spin = document.querySelector('.ant-spin-spinning');
        expect(spin).toBeInTheDocument();
    });

    it('ショートカット Ctrl+S で保存ハンドラーが呼ばれること', () => {
        const handleSaveMock = vi.fn();
        vi.mocked(mockedUseDataEditor).mockReturnValue({
            state: {
                isLoading: false,
                isFileDirty: false,
                activeSheetId: '202310',
                statusTotalText: '',
                statusShopTotalText: '',
                hotSettings: {}
            },
            handlers: {
                handleSave: handleSaveMock,
                loadSheet: vi.fn(),
                handleSort: vi.fn(),
                moveMonth: vi.fn(),
                setCurDate: vi.fn(),
                onSearch: vi.fn(),
                handleDuplicateData: vi.fn(),
                handleSearch: vi.fn(),
            }
        } as UseDataEditorReturn);

        render(<DataEditor />);

        // Ctrl+S キーイベントをシミュレート
        fireEvent.keyDown(window, { key: 's', ctrlKey: true });

        expect(handleSaveMock).toHaveBeenCalled();
    });
});