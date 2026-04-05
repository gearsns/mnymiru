import { db, type LastSession } from '../lib/dexie';

export const historyService = {
  async addHistory(name: string, handle: FileSystemFileHandle, dir?: FileSystemDirectoryHandle) {
    await db.transaction('rw', db.history, async () => {
      // 同じ名前の既存履歴を削除
      await db.history.where('name').equals(name).delete();
      // 追加
      await db.history.add({ name, handle, dir, lastOpened: Date.now() });
      // 10件を超えた分を削除
      const count = await db.history.count();
      if (count > 10) {
        const oldest = await db.history.orderBy('lastOpened').first();
        if (oldest?.id) await db.history.delete(oldest.id);
      }
    });
  },

  async initPersistData(param?: { data?: Uint8Array, handle?: FileSystemFileHandle, dir?: FileSystemDirectoryHandle }) {
    await db.lastSession.put({
      id: 'current',
      handle: param?.handle,
      dir: param?.dir,
      data: param?.data || new Uint8Array(),
      isDirty: true,
      timestamp: Date.now()
    });
  },

  async patchPersistData(data: Uint8Array) {
    try {
      await db.lastSession.update('current', {
        data,
        isDirty: true,
        timestamp: Date.now()
      } as Partial<LastSession>);
    } catch { /* empty */ }
  },

  async savedPersistData(param?: { handle?: FileSystemFileHandle, dir?: FileSystemDirectoryHandle }) {
    try {
      await db.lastSession.update('current', {
        handle: param?.handle,
        dir: param?.dir,
        isDirty: false,
        timestamp: Date.now()
      } as Partial<LastSession>);
    } catch { /* empty */ }
  },

  async getLastSession() {
    return await db.lastSession.get('current');
  },
};