import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 各テストの後にDOMをクリーンアップ（メモリリーク防止）
afterEach(() => {
  cleanup();
});

// クラスを直接 export する
export class MockWorker {
  url: string;
  // リスナーを保持する配列
  private listeners: ((e: unknown) => void)[] = [];
  
  // 互換性のための onmessage
  onmessage: ((e: MessageEvent) => void) | null = null;

  constructor(url: string | URL, _options?: WorkerOptions) {
    this.url = url.toString();
  }

  // リスナーを登録できるようにする
  addEventListener = vi.fn((type: string, listener: (e: unknown) => void) => {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  });

  // postMessage が呼ばれたら、登録されたリスナーを非同期で実行する
  postMessage = vi.fn((_data: unknown) => {
    // 実際の Worker の挙動に合わせ、少し遅らせて実行（マクロタスク）
    /*
    setTimeout(() => {
      const event = { data } as MessageEvent;
      // addEventListener で登録されたもの
      this.listeners.forEach(l => l(event));
      // .onmessage で登録されたもの
      this.onmessage?.(event);
    }, 0);
    */
  });
  emitMessage =  vi.fn((data: unknown) => {
      const event = { data } as MessageEvent;
      // addEventListener で登録されたもの
      this.listeners.forEach(l => l(event.data));
      // .onmessage で登録されたもの
      this.onmessage?.(event);
  });

  terminate = vi.fn();
  removeEventListener = vi.fn();
}

// クラスを直接スタブ化するのではなく、vi.fn でラップする
// これにより 'new Worker' したときに Vitest が呼び出しを記録できる
const WorkerMockFn = vi.fn(function(url: string | URL, options?: WorkerOptions){
  return new MockWorker(url, options);
});

vi.stubGlobal('Worker', WorkerMockFn);

vi.mock('../features/editor/utils/migemo', () => ({
  getMigemo: vi.fn().mockResolvedValue({
    query: (text: string) => `mock-${text}`
  }),
}));