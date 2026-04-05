import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto'; // IndexedDBをモック化
import { db } from '../lib/dexie';
import { historyService } from './historyService';

describe('historyService', () => {
    beforeEach(async () => {
        // 各テスト前にDBをクリア
        await db.history.clear();
        await db.lastSession.clear();
    });

    describe('addHistory', () => {
        it('同じ名前の履歴がある場合、古い方を削除して新しい情報を保存する', async () => {
            const name = 'test-file.txt';
            const mockHandle = {} as FileSystemFileHandle;

            await historyService.addHistory(name, mockHandle);
            const firstTimestamp = (await db.history.where('name').equals(name).first())?.lastOpened;

            // 少し待機してタイムスタンプを変える
            await new Promise(res => setTimeout(res, 10));

            await historyService.addHistory(name, mockHandle);
            const secondHistory = await db.history.where('name').equals(name).toArray();

            expect(secondHistory).toHaveLength(1);
            expect(secondHistory[0].lastOpened).toBeGreaterThan(firstTimestamp!);
        });

        it('10件を超える場合、最も古い履歴を削除する', async () => {
            const mockHandle = {} as FileSystemFileHandle;

            // 10件追加
            for (let i = 1; i <= 10; i++) {
                await historyService.addHistory(`file-${i}`, mockHandle);
                await new Promise(res => setTimeout(res, 2)); // 順序を確実にするため
            }

            // 11件目を追加
            await historyService.addHistory('file-11', mockHandle);

            const count = await db.history.count();
            const oldest = await db.history.orderBy('lastOpened').first();

            expect(count).toBe(10);
            expect(oldest?.name).not.toBe('file-1'); // 最初の1件目が消えているはず
            expect(oldest?.name).toBe('file-2');
        });
    });

    describe('Session Management', () => {
        it('initPersistData で新しいセッションが作成され isDirty が true になる', async () => {
            const data = new Uint8Array([1, 2, 3]);
            await historyService.initPersistData({ data });

            const session = await historyService.getLastSession();
            expect(session?.id).toBe('current');
            expect(session?.isDirty).toBe(true);
            expect([...session!.data]).toEqual([...data]);
        });

        it('patchPersistData でデータが更新され isDirty が維持される', async () => {
            await historyService.initPersistData();
            const newData = new Uint8Array([9, 9, 9]);

            await historyService.patchPersistData(newData);

            const session = await historyService.getLastSession();
            expect([...session!.data]).toEqual([...newData]);
            expect(session?.isDirty).toBe(true);
        });

        it('savedPersistData で isDirty が false になる', async () => {
            await historyService.initPersistData();
            await historyService.savedPersistData();

            const session = await historyService.getLastSession();
            expect(session?.isDirty).toBe(false);
        });
    });
});