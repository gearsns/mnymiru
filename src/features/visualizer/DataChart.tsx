import { ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Layout, Select } from "antd";
import { Bar, BarChart, Label, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { INPUT_DATA } from "./constants";
import { useDataChart } from "./useDataChart";

const { Header, Content, Footer } = Layout

export const DataChart = () => {
  const {
    selectedYear, setSelectedYear,
    currentAccount, setCurrentAccount,
    accountNames,
    chartSize,
    chartData,
    barProps,
    refContent,
    stats,
    handleRefreshAll,
    toggleBarVisibility,
    setHover
  } = useDataChart();

  return (
    <Layout className="tab_pane_layout">
      <Header className="header">
        <Button onClick={handleRefreshAll} icon={<ReloadOutlined />}>更新</Button>
        <DatePicker
          picker="year"
          value={selectedYear}
          onChange={(date) => date && setSelectedYear(date)}
          allowClear={false}
        />
        <Select
          defaultValue={""}
          value={currentAccount}
          onChange={setCurrentAccount}
          options={accountNames}
          className="select_box"
        />
      </Header>
      <Content ref={refContent} className="tab_pane_content_chart">
        <BarChart
          layout="vertical"
          width={chartSize.width}
          height={chartSize.height}
          data={chartData.values}
          margin={{ top: 30, right: 30, left: 20, bottom: 30 }}
        >
          <XAxis type="number" domain={INPUT_DATA.xLimit} tickFormatter={(val) => val.toLocaleString()}>
            <Label
              value={INPUT_DATA.oxLabel}
              position="insideBottomRight"
              dy={20}
              dx={10}
            />
          </XAxis>
          <YAxis dataKey={INPUT_DATA.dataKey} type="category" domain={INPUT_DATA.yLimit} tickCount={1} interval={0} >
            <Label value={INPUT_DATA.oyLabel} position="insideTopLeft" dy={-10} dx={20} />
          </YAxis>
          <Tooltip formatter={(value, name) => {
            if (typeof value === 'number') {
              return [value.toLocaleString(), name] as const;
            }
            return [value, name] as const;
          }} />
          <ReferenceLine
            x={stats.monthAverage}
            label={{ value: `平均:${stats.monthAverage.toLocaleString()}`, position: "top" }}
            stroke="red"
            strokeDasharray="4 4"
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="top"
            onClick={(e) => toggleBarVisibility(e.dataKey as string)}
            onMouseOver={(e) => setHover(e.dataKey as string)}
            onMouseOut={() => setHover(null)}
            wrapperStyle={{
              paddingLeft: 30,
            }}
          />
          {chartData.labels.map((label, index) => (
            <Bar
              key={index}
              dataKey={label.key}
              fill={label.color}
              stackId={INPUT_DATA.dataKey}
              hide={barProps[label.key] === true}
              fillOpacity={Number(
                barProps.hover === label.key || !barProps.hover ? 1 : 0.6
              )}
            />
          ))}
        </BarChart>
      </Content>
      <Footer className="footer">
        合計：{stats.monthTotal.toLocaleString()}
      </Footer>
    </Layout>
  );
};