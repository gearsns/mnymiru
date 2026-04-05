import { useRef } from 'react';
import { Input, Button, DatePicker, Space, Spin, Layout } from 'antd';
import dayjs from 'dayjs';
import { LeftOutlined, RightOutlined, SaveOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useShortcuts } from './useShortcuts';
import { useDataEditor } from './useDataEditor';
import { HotTable, HotTableWrapper } from '../common/HotTableWrapper';

const { Search } = Input
const { Content, Footer, Header } = Layout;

export const DataEditor = () => {
  const hotRef = useRef<HotTable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, handlers } = useDataEditor(hotRef, containerRef);

  // ショートカットキーの設定
  useShortcuts({
    'ctrl+s': handlers.handleSave,
    'ctrl+d': handlers.handleDuplicateData,
    'f3': (e) => {
      handlers.handleSearch(e.shiftKey ? 'prev' : 'next');
    },
  });

  return (
    <Layout className="tab_pane_layout">
      <Header className="header">
        <Button onClick={handlers.handleSave} disabled={!state.isFileDirty} icon={<SaveOutlined />}>保存</Button>
        <Button onClick={handlers.handleSort} icon={<SortAscendingOutlined />}>並べ替え</Button>
        <Space.Compact>
          <Button
            onClick={() => handlers.moveMonth(-1)}
            disabled={state.isLoading}
            icon={<LeftOutlined />}
          ></Button>
          <Button
            onClick={() => handlers.loadSheet(dayjs().format("YYYYMM"))}
            disabled={state.isLoading}
          >
            今月
          </Button>
          <DatePicker
            picker="month"
            format="YYYY/MM"
            value={dayjs(state.activeSheetId, "YYYYMM").isValid() ? dayjs(state.activeSheetId, "YYYYMM") : null}
            onChange={handlers.setCurDate}
            cellRender={(current: string | number | dayjs.Dayjs) => {
              return (
                <div className="ant-picker-cell-inner">
                  {(current as dayjs.Dayjs).month() + 1}月
                </div>
              )
            }
            }
            disabled={state.isLoading}
            readOnly={state.isLoading}
          />
          <Button
            onClick={() => handlers.moveMonth(1)}
            disabled={state.isLoading}
            icon={<RightOutlined />}
          ></Button>
        </Space.Compact>
        <Search
          className="search_box"
          placeholder="input search text"
          allowClear
          onSearch={handlers.onSearch}
          enterButton="Search"
        />
      </Header>
      <Content ref={containerRef} className="tab_pane_content">
        <Spin spinning={state.isLoading} className="full-height-spin">
          <HotTableWrapper
            ref={hotRef}
            settings={state.hotSettings}
            isLoading={false}
          />
        </Spin>
      </Content>
      <Footer className="footer">
        <span className="select_total">{state.statusTotalText}</span>
        <span className="shop_total">{state.statusShopTotalText}</span>
      </Footer>
    </Layout>
  );
};