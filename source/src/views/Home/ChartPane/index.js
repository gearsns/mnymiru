import React, { useRef, useEffect, useLayoutEffect, forwardRef, useState } from "react"
import { Select, Button, Layout } from 'antd'
import { useStoreContext } from '../../../store'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Label } from "recharts";
import { ReloadOutlined } from '@ant-design/icons'

const { Header, Content, Footer } = Layout

const inputData = {
  dataKey: "month",
  oyLabel: "月",
  oxLabel: "金額",
  xLimit: [0, 'dataMax'],
  yLimit: [1, 12],
}
const colors = [
  '#47395c', '#5c619f', '#5f8bce', '#8bafdf', '#f1b847', '#a5565c',
  '#736389', '#8c8ed0', '#92bbff', '#bde1ff', '#bb880f', '#732a33',
  '#a291b9', '#bdbeff', '#c6edff', '#f1ffff', '#865c00', '#43000c',
]

const ChartPaneContent = forwardRef(function ChartPaneContent(props, ref) {
  const [accountNames, setAccountNames] = useState([{ value: "", label: "全て" }])
  const [chartSize, setChartSize] = useState({ width: 1000, height: 800 })
  const [chartData, setChartData] = useState({
    values: [
      { month: 1 }, { month: 2 }, { month: 3 }, { month: 4 }, { month: 5 }, { month: 6 }
      , { month: 7 }, { month: 8 }, { month: 9 }, { month: 10 }, { month: 11 }, { month: 12 }
    ], labels: []
  })
  const store = useStoreContext()
  const refContent = useRef()
  const [barProps, setBarProps] = useState(
    chartData.labels.reduce(
      (a, { key }) => {
        a[key] = false
        return a
      },
      { hover: null }
    )
  )

  const handleLegendMouseEnter = e => {
    if (!barProps[e.dataKey]) {
      setBarProps({ ...barProps, hover: e.dataKey })
    }
  }

  const handleLegendMouseLeave = _ => {
    setBarProps({ ...barProps, hover: null })
  }

  const selectBar = e => {
    setBarProps({
      ...barProps,
      [e.dataKey]: !barProps[e.dataKey],
      hover: null
    })
  }

  const handleResize = _ => {
    if (refContent && refContent.current) {
      const tabpane = refContent.current.closest(".dock-pane-cache")
      if (tabpane) {
        const rect = tabpane.getBoundingClientRect()
        const height = rect.height - 80
        refContent.current.style.height = `${height}px`

        if (height > 410) {
          setChartSize({ width: height * 2.5, height: height - 10 })
        } else {
          setChartSize({ width: 400 * 2.5, height: 400 })
        }
      }
    }
  }

  useLayoutEffect(_ => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return _ => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  let resizeObserver = null

  useEffect(_ => {
    if (ResizeObserver) {
      resizeObserver = new ResizeObserver(_ => {
        handleResize()
      })
    }
    if (resizeObserver) {
      const tabpane = refContent.current.closest(".dock-pane-cache")
      tabpane && resizeObserver.observe(tabpane)
    }
    return _ => resizeObserver?.disconnect()
  }, [])

  const updateChart = accountName => {
    const db = store.database
    if (!db) {
      return
    }
    const data = db.monthTotalList(store.yearmonth.year, accountName)
    const values = [
      { month: 1 }, { month: 2 }, { month: 3 }, { month: 4 }, { month: 5 }, { month: 6 }
      , { month: 7 }, { month: 8 }, { month: 9 }, { month: 10 }, { month: 11 }, { month: 12 }
    ]
    const item_keys = {}
    for (const item of data) {
      const month = Math.trunc(item[0]) % 100
      values[month - 1][item[1]] = -item[2]
      item_keys[item[1]] = true
    }
    let index = 0
    const labels = []
    for (const key of Object.keys(item_keys)) {
      labels.push({
        key: key,
        color: colors[index]
      })
      index++
      if (index >= colors.length) {
        index = 0
      }
    }
    setChartData({ values: values, labels: labels })
  }
  const handleUpdateChart = _ => {
    const db = store.database
    if (!db) {
      return
    }
    const accounts = db.accountList(store.yearmonth.year)
    const items = [{ value: "", label: "全て" }]
    for (const item of accounts) {
      items.push({ value: item, label: item })
    }
    setAccountNames(items)
    updateChart()
  }
  const tickFormatter = value => {
    return value.toLocaleString()
  }
  const formatter = (value, name, props) => value.toLocaleString()
  const handleChange = value => {
    updateChart(value)
  }
  //
  return (
    <div ref={ref}>
      <Layout className="tab_pane_layout">
        <Header className="header">
          <Button onClick={handleUpdateChart}><ReloadOutlined /> 更新</Button>
          <Select
            defaultValue={""}
            onChange={handleChange}
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
            <XAxis type="number" domain={inputData.xLimit} tickFormatter={tickFormatter}>
              <Label
                value={inputData.oxLabel}
                position="insideBottomRight"
                dy={20}
                dx={10}
              />
            </XAxis>
            <YAxis dataKey={inputData.dataKey} type="category" domain={inputData.yLimit} tickCount={1}>
              <Label value={inputData.oyLabel} position="insideTopLeft" dy={-10} dx={20} />
            </YAxis>
            <Tooltip formatter={formatter} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="top"
              onClick={selectBar}
              onMouseOver={handleLegendMouseEnter}
              onMouseOut={handleLegendMouseLeave}
              wrapperStyle={{
                paddingLeft: 30,
              }}
            />
            {chartData.labels.map((label, index) => (
              <Bar
                key={index}
                dataKey={label.key}
                fill={label.color}
                stackId={inputData.dataKey}
                hide={barProps[label.key] === true}
                fillOpacity={Number(
                  barProps.hover === label.key || !barProps.hover ? 1 : 0.6
                )}
              />
            ))}
          </BarChart>
        </Content>
        <Footer className="footer" />
      </Layout>
    </div>
  )
})

export { ChartPaneContent }