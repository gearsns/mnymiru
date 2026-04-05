import type { HotTable } from '@myhandsontable/react';
import { useEffect } from 'react';

export const useHandsontableResize = (
    hotRef: React.RefObject<HotTable | null>,
    containerRef: React.RefObject<HTMLDivElement | null>
) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const hotInstance = hotRef.current?.hotInstance;
            if (!hotInstance || !entries[0]) return;

            const { width, height } = entries[0].contentRect;

            // 直接APIを叩いて再レンダリングを回避する戦略をカプセル化
            hotInstance.updateSettings({
                width: Math.floor(width),
                height: Math.floor(height),
            }, false);
        });

        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, [containerRef, hotRef]);
};