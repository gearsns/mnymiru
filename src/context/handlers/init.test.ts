import { describe, it, expect, vi, beforeEach } from 'vitest';
import initSqlJs from "sql.js";
import { historyService } from "../../services/historyService";
import { fetchOne } from "./utils";
import { handleInit } from './init';

// モジュール全体のモック化
vi.mock("sql.js");
vi.mock("../../services/historyService");
vi.mock("./utils");

// 定数のモック（文字列として扱う）
vi.mock("../../db/schema", () => ({ INITIAL_SCHEMA: 'SCHEMA_SQL' }));
vi.mock("../../db/meta", () => ({
    SELECT_DB_VERSION: 'SELECT_VERSION_SQL',
    EXISTS_CASH_TALBE: 'EXISTS_CASH_SQL',
    UPDATE_DB_VERSION: 'UPDATE_VERSION_SQL'
}));
vi.mock("../../db/migration", () => ({ MIGRATION: 'MIGRATION_SQL' }));

describe('handleInit', () => {
    // Database型の部分的なモックを作成
    const mockDb = {
        exec: vi.fn(),
    } as unknown as initSqlJs.Database;

    // 各モック関数に型を付与
    const mockedInitSqlJs = vi.mocked(initSqlJs);
    const mockedHistoryService = vi.mocked(historyService);
    const mockedFetchOne = vi.mocked(fetchOne);

    const dbConstructorSpy = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // initSqlJs が Database クラスを持つオブジェクトを返すよう設定
        const MockDatabase = function (this: initSqlJs.Database, data?: Uint8Array) {
            dbConstructorSpy(data); // 渡された引数を記録
            return mockDb; // インスタンスとして mockDb を返す
        };
        mockedInitSqlJs.mockResolvedValue({
            Database: MockDatabase as unknown
        } as unknown as initSqlJs.SqlJsStatic);

        // デフォルトのDBバージョン（マイグレーション不要な状態）を返す
        mockedFetchOne.mockReturnValue({ value: '2' });
    });

    it('isSessionがtrueの場合、前回のセッションデータからDBを復元する', async () => {
        const ctx: { db: initSqlJs.Database | null } = { db: null };
        const dummyData = new Uint8Array([0, 1, 2]);

        mockedHistoryService.getLastSession.mockResolvedValue({
            data: dummyData,
            id: "1",
            isDirty: false,
            timestamp: 0
        });

        const payload = { handle: undefined, dir: undefined, isSession: true };
        await handleInit(ctx, payload);

        expect(mockedHistoryService.getLastSession).toHaveBeenCalled();
        // SQL.Database が渡された Uint8Array で初期化されたか
        expect(dbConstructorSpy).toHaveBeenCalledWith(expect.any(Uint8Array));
        expect(ctx.db).toBe(mockDb);
    });

    it('handleがある場合、ファイルからデータを読み込み履歴を保存する', async () => {
        const ctx: { db: initSqlJs.Database | null } = { db: null };

        // FileとArrayBufferのモック
        const mockArrayBuffer = new ArrayBuffer(8);
        const mockFile = {
            arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
        } as unknown as File;

        const mockHandle = {
            name: 'database.sqlite',
            getFile: vi.fn().mockResolvedValue(mockFile)
        } as unknown as FileSystemFileHandle;

        const payload = { handle: mockHandle, dir: undefined, isSession: false };
        await handleInit(ctx, payload);

        expect(mockHandle.getFile).toHaveBeenCalled();
        expect(mockedHistoryService.initPersistData).toHaveBeenCalledWith({
            data: expect.any(Uint8Array),
            handle: mockHandle,
            dir: undefined
        });
        expect(mockedHistoryService.addHistory).toHaveBeenCalledWith(
            'database.sqlite',
            mockHandle,
            undefined
        );
    });

    it('DBバージョンが古い、かつキャッシュテーブルがある場合にマイグレーションを実行する', async () => {
        const ctx: { db: initSqlJs.Database | null } = { db: null };

        // 1回目はバージョン取得、2回目はテーブル存在確認
        mockedFetchOne
            .mockReturnValueOnce({ value: '1' }) // 古いバージョン
            .mockReturnValueOnce({ cnt: 1 });    // テーブルあり

        const payload = { handle: undefined, dir: undefined, isSession: false };
        await handleInit(ctx, payload);

        // 1. SCHEMA, 2. MIGRATION, 3. UPDATE_VERSION の順で呼ばれるはず
        expect(mockDb.exec).toHaveBeenCalledWith('SCHEMA_SQL');
        expect(mockDb.exec).toHaveBeenCalledWith('MIGRATION_SQL');
        expect(mockDb.exec).toHaveBeenCalledWith('UPDATE_VERSION_SQL');
    });

    it('DBバージョンが古くても、キャッシュテーブルがなければマイグレーションをスキップする', async () => {
        const ctx: { db: initSqlJs.Database | null } = { db: null };

        mockedFetchOne
            .mockReturnValueOnce({ value: '1' })
            .mockReturnValueOnce({ cnt: 0 }); // テーブルなし

        const payload = { handle: undefined, dir: undefined, isSession: false };
        await handleInit(ctx, payload);

        expect(mockDb.exec).toHaveBeenCalledWith('SCHEMA_SQL');
        expect(mockDb.exec).not.toHaveBeenCalledWith('MIGRATION_SQL');
        expect(mockDb.exec).toHaveBeenCalledWith('UPDATE_VERSION_SQL');
    });
});