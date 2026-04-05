import { forwardRef, memo } from 'react';
import { HotTable } from '@myhandsontable/react';
import type Handsontable from 'myhandsontable';

export { HotTable };
interface Props {
  settings: Handsontable.GridSettings;
  isLoading: boolean;
}

// React.memoでラップして不要な再レンダリングを防止
export const HotTableWrapper = memo(
  forwardRef<HotTable, Props>(({ settings, isLoading }, ref) => {
    return (
      <div className={`hot-container ${isLoading ? 'hot-readonly' : ''}`}>
        <HotTable
          ref={ref}
          settings={settings}
          // クラス名などはここでも制御可能
          className="mny_hottable"
        />
      </div>
    );
  })
);

HotTableWrapper.displayName = 'HotTableWrapper';