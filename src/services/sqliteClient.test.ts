import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { CashTable } from '../db/types';
// crypto.randomUUID の戻り値型に合わせる
type UUID = `${string}-${string}-${string}-${string}-${string}`;
// Workerに送られるデータのインターフェース
interface WorkerRequest {
    type: string;
    payload: { id: UUID;[key: string]: unknown };
}

// テスト用の疑似Workerクラス
export class TestWorker {
    private listeners: ((e: { data: unknown }) => void)[] = [];
    constructor(_url: string | URL, _options?: WorkerOptions) {
    }
    // 外部（テストケース）から postMessage の挙動を上書きするための Mock 関数
    public onPostMessage: Mock<(data: WorkerRequest) => void> = vi.fn();

    addEventListener = vi.fn((_type: string, listener: (e: { data: unknown }) => void) => {
        this.listeners.push(listener);
    });

    postMessage = (data: unknown) => {
        // 投げられたリクエストを記録し、ハンドラを実行
        this.onPostMessage(data as WorkerRequest);
    };

    // Workerからの返信をエミュレート
    emit(data: unknown) {
        this.listeners.forEach(l => l({ data }));
    }

    terminate = vi.fn();
}

const WorkerMockFn = vi.fn(function (url: string | URL, options?: WorkerOptions) {
    return new TestWorker(url, options);
});

describe('sqliteClient', () => {
    beforeEach(async () => {
        // 各テスト前にモジュール状態をリセット
        vi.resetModules();
        vi.clearAllMocks();

        vi.stubGlobal('Worker', WorkerMockFn);
        // crypto.randomUUID をハイフン形式のUUIDでモック化
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn((): UUID => '12345678-1234-1234-1234-1234567890ab')
        });
    });
    it('fetchByKeyword が正しいデータを解決する', async () => {
        const { sqliteClient, getWorker } = await import('./sqliteClient');
        getWorker();
        const MockConstructor = vi.mocked(Worker);
        const workerInstance = MockConstructor.mock.results[0].value as TestWorker;
        // 各テストケースで独自のテストデータを用意
        const testData = [{ id: 100, name: 'Apple' }, { id: 101, name: 'Ame' }];
        workerInstance.onPostMessage.mockImplementation((e) => {
            const data = e as unknown as WorkerRequest;
            if (data.type === 'fetch_by_keyword') {
                workerInstance.emit({
                    id: data.payload.id,
                    result: testData
                });
            }
        });

        const result = await sqliteClient.fetchByKeyword('A');

        expect(result).toEqual(testData);
        expect(workerInstance.onPostMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'fetch_by_keyword' })
        );
    });
    it('Worker側でエラーが発生した際に reject される', async () => {
        const { sqliteClient, getWorker } = await import('./sqliteClient');
        getWorker();
        const MockConstructor = vi.mocked(Worker);
        const workerInstance = MockConstructor.mock.results[0].value as TestWorker;
        const errorMessage = 'SQLite Constraint Error';
        workerInstance.onPostMessage.mockImplementation((e) => {
            const data = e as unknown as WorkerRequest;
            if (data.type === 'save') {
                workerInstance.emit({
                    id: data.payload.id,
                    error: errorMessage
                });
            }
        });
        await expect(sqliteClient.saveDatabase()).rejects.toThrow(errorMessage);
    });
    it('fetchTopItemByColumn が正しいペイロードを送信する', async () => {
        const { sqliteClient, getWorker } = await import('./sqliteClient');
        getWorker();
        const MockConstructor = vi.mocked(Worker);
        const workerInstance = MockConstructor.mock.results[0].value as TestWorker;
        const mockTopItem = { name: 'Food', total: 5000 };
        workerInstance.onPostMessage.mockImplementation((req: WorkerRequest) => {
            // 送信された内容を検証
            expect(req.payload).toMatchObject({
                srcColumnName: 'item_name' as keyof CashTable,
                value: 'Shopping',
                year_month: 202401
            });

            workerInstance.emit({
                id: req.payload.id,
                result: mockTopItem
            });
        });

        const result = await sqliteClient.fetchTopItemByColumn(
            'item_name' as keyof CashTable,
            'account' as keyof CashTable,
            'Shopping',
            202401
        );
        expect(result).toEqual(mockTopItem);
    });
});