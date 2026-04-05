import { ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Layout, Select } from "antd"
import { Content, Footer, Header } from "antd/es/layout/layout"
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useCallback, useRef, useState } from "react";
import { sqliteClient } from "../../services/sqliteClient";
import { HotTable, HotTableWrapper } from "../common/HotTableWrapper";
import { useHandsontableResize } from "../common/useHandsontableResize";
import { useReadonlyHotSettings } from "../common/useReadonlyHotSettings";

export const DataReport = () => {
  const hotRef = useRef<HotTable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs());
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [accountNames, setAccountNames] = useState([{ value: "", label: "全て" }]);
  const [statusText, setStatusText] = useState("");

  const hotSettings = useReadonlyHotSettings(hotRef, setStatusText);
  // リサイズ監視
  useHandsontableResize(hotRef, containerRef);

  const search = useCallback(async (year: number, account: string) => {
    const data = await sqliteClient.fetchYearTop(year, account === "" ? undefined : account);
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    hot.loadData(data);
    hot.selectCell(0, 0);
    hot.scrollViewportTo(0, 0);
  }, []);

  const handleYearChange = (date: dayjs.Dayjs | string | null, _dateString: string | null) => {
    if (dayjs.isDayjs(date)) {
      setSelectedYear(date);
      search(date.year(), currentAccount);
    }
  };
  const handleAccountChange = (value: string) => {
    setCurrentAccount(value);
    search(selectedYear.year(), value);
  };
  const handleUpdate = async () => {
    try {
      const year = selectedYear.year();
      const accounts = await sqliteClient.fetchAccount(year);
      setAccountNames([{ value: "", label: "全て" }, ...accounts.map(item => { return { value: item, label: item }; })]);
      setCurrentAccount("");
      await search(year, "");
    } catch (e) {
      console.error("Failed to update chart", e);
    }
  };
  return <Layout className="tab_pane_layout">
    <Header className="header">
      <Button onClick={handleUpdate} icon={<ReloadOutlined />}>更新</Button>
      <DatePicker
        picker="year"
        value={selectedYear}
        onChange={handleYearChange}
        allowClear={false}
      />
      <Select
        defaultValue={""}
        value={currentAccount}
        onChange={handleAccountChange}
        options={accountNames}
        className="select_box"
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
}