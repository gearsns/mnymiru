import { Input, Layout } from "antd";
import { Content, Footer, Header } from "antd/es/layout/layout";
import { useRef, useState } from "react";
import { sqliteClient } from "../../services/sqliteClient";
import { HotTable, HotTableWrapper } from "../common/HotTableWrapper";
import { useHandsontableResize } from "../common/useHandsontableResize";
import { useReadonlyHotSettings } from "../common/useReadonlyHotSettings";

const { Search } = Input

export const SearchFilter = () => {
  const hotRef = useRef<HotTable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [statusText, setStatusText] = useState("");

  const hotSettings = useReadonlyHotSettings(hotRef, setStatusText);
  // リサイズ監視
  useHandsontableResize(hotRef, containerRef);

  const handleSearch = async (value: string) => {
    const data = await sqliteClient.fetchByKeyword(value);
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    hot.loadData(data);
    hot.selectCell(0, 0);
    hot.scrollViewportTo(0, 0);
    hot.render();
  }
  return (
    <Layout className="tab_pane_layout">
      <Header className="header">
        <Search
          className="search_box"
          placeholder="input search text"
          allowClear
          onSearch={handleSearch}
          enterButton="Search"
        />
      </Header>
      <Content ref={containerRef} className="tab_pane_content readonly_table">
        <HotTableWrapper
          ref={hotRef}
          settings={hotSettings}
          isLoading={false}
        />
      </Content>
      <Footer className="footer">
        <span>{statusText}</span>
      </Footer>
    </Layout>
  );
};