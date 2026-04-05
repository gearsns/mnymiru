import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { getWorker } from './services/sqliteClient';
import type { MockWorker } from './test/setup';
import type { WorkerMessage } from './types/typesWorkers';
import App from './App';

global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

vi.mock('./features/searcher/SearchFilter', () => ({
    SearchFilter: () => <div data-testid="mock-chart">Chart Mock</div>,
}));
vi.mock('./features/reporter/DataReport', () => ({
    DataReport: () => <div data-testid="mock-chart">Chart Mock</div>,
}));
vi.mock('./features/visualizer/DataChart', () => ({
    DataChart: () => <div data-testid="mock-chart">Chart Mock</div>,
}));
vi.mock('./features/editor/DataEditor', () => ({
    DataEditor: () => <div data-testid="mock-chart">Chart Mock</div>,
}));

describe('App Component', () => {
    test('タイトルが表示されていること', async () => {
        const MockWorker = vi.mocked(Worker);
        getWorker();
        await waitFor(() => {
            if (!MockWorker.mock?.instances) throw new Error('まだ App がハンドラを登録してない');
        });
        const workerInstance = MockWorker.mock.instances[0] as unknown as MockWorker;
        if (workerInstance) {
            const mockedPostMessage = vi.mocked(workerInstance.postMessage);
            mockedPostMessage.mockImplementation((e) => {
                const data = e as unknown as WorkerMessage;
                if (data.type === "init") {
                    workerInstance.emitMessage({ data: { id: data.payload.id, type: data.type, result: true } } as MessageEvent);
                } else if (data.type === "fetch_month_total") {
                    workerInstance.emitMessage({ data: { id: data.payload.id, type: data.type, result: [] } } as MessageEvent);
                }
            });
        }
        const { container } = render(<App />);
        expect(container.firstChild).toBeNull();
        const title = await screen.findByText(/MnyMiru/i);
        //screen.debug();
        expect(title).toBeInTheDocument();
    });
});
