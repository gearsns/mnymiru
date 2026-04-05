import type { WorkerMessage, WorkerResponse } from '../types/typesWorkers';
import { handlerMap, type HandlerFunc } from './handlers';

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, payload } = e.data;
    const id = payload?.id; // Reactから送られてきたID
    try {
        const handler = handlerMap[type] as HandlerFunc;
        if (!handler) {
            throw new Error(`Unknown message type: ${type}`);
        }
        const result = await handler(payload);
        self.postMessage({ type, id, result } as WorkerResponse);
    } catch (error) {
        // エラーが起きた場合もIDを返さないと、React側のawaitが永遠に終わらない
        self.postMessage({
            id,
            type,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};