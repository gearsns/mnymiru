import Dexie, { type Table } from 'dexie';

export interface FileHistory {
  id?: number;
  name: string;
  handle: FileSystemFileHandle; // FileSystem APIのハンドル（再起動後も権限があればアクセス可）
  dir?: FileSystemDirectoryHandle;
  lastOpened: number;
}

export interface LastSession {
  id: string; // "current" 固定
  data: Uint8Array; // sql.jsのバイナリ
  handle?: FileSystemFileHandle;
  dir?: FileSystemDirectoryHandle;
  isDirty: boolean;
  timestamp: number;
}

class AppDatabase extends Dexie {
  history!: Table<FileHistory>;
  lastSession!: Table<LastSession>;

  constructor() {
    super('MnyMiruDB');
    this.version(1).stores({
      history: '++id, name, lastOpened', // 履歴用
      lastSession: 'id' // リカバリ用
    });
  }
}

export const db = new AppDatabase();