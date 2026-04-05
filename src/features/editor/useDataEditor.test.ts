import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDataEditor } from './useDataEditor';
import type { HotTable } from 'react-myhandsontable';

describe('useDataEditor', () => {
    it('初期状態では isLoading が false であること', () => {
        const hotRef = { current: null };
        const containerRef = { current: null };

        const { result } = renderHook(() => useDataEditor(hotRef as unknown as React.RefObject<HotTable | null>
            , containerRef as unknown as React.RefObject<HTMLDivElement | null>));

        expect(result.current.state.isLoading).toBe(false);
    });
});