import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'
import { Pencil, PencilOff } from 'lucide-react'
import { Box, Flex, Button, ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core'
import { API_BASE } from '../config/api'
import { usePrice } from '../contexts/PriceContext'
import type { IChartApi, Time } from 'lightweight-charts'

type Props = {
  symbol: string
  height?: number
  interval?: string
  market?: 'spot' | 'futures'
  orders?: any[]
  positions?: any[]
  onClosePosition?: (position: any) => void
  onIntervalChange?: (interval: any) => void
  availableIntervals?: string[]
}

export default function PriceChart(props: Props) {
  const { symbol, height = 420, interval = '1m', market = 'spot', orders = [], positions = [] } = props
  const { colorScheme } = useMantineColorScheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<any>(null)
  const lastBarRef = useRef<any>(null)
  const lineSeriesRef = useRef<any[]>([])
  const [drawMode, setDrawMode] = useState(false)
  const drawStartRef = useRef<{ time: Time; price: number } | null>(null)
  const [closeBtnTop, setCloseBtnTop] = useState<number | null>(null)
  const positionsRef = useRef(positions)
  const previewSeriesRef = useRef<any>(null)

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  function intervalToSeconds(iv: string): number {
    switch (iv) {
      case '1m': return 60
      case '15m': return 900
      case '30m': return 1800
      case '5m': return 300
      case '1h': return 3600
      case '2h': return 7200
      case '4h': return 14400
      case '6h': return 21600
      case '1d': return 86400
      case '2d': return 172800
      case '1w': return 604800
      default: return 60
    }
  }

  function normalizeFuturesSymbol(sym: string): string {
    return sym.includes('_') ? sym : sym.replace(/(USDT|USDC)$/i, '_$1')
  }

  function deUnderscore(sym: string): string {
    return sym.replace('_', '')
  }

  useEffect(() => {
    if (chartRef.current) {
      const styles = getComputedStyle(document.documentElement)
      const textColor = styles.getPropertyValue('--chart-text').trim() || '#808080'
      const lineColor = styles.getPropertyValue('--chart-line').trim() || '#808080'
      chartRef.current.applyOptions({
        layout: { textColor },
        crosshair: {
          vertLine: { color: lineColor },
          horzLine: { color: lineColor },
        }
      })
    }
  }, [colorScheme])

  useEffect(() => {
    if (!containerRef.current) return
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { }
    }
    let disposed = false

    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: 'transparent' }, textColor: '#808080' },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false }
      },
      timeScale: {
        rightOffset: 6,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: { width: 1, color: '#808080', style: 2, labelVisible: true },
        horzLine: { width: 1, color: '#808080', style: 2, labelVisible: true },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#0BBA74',
      downColor: '#ff4761',
      borderUpColor: '#0BBA74',
      borderDownColor: '#ff4761',
      wickUpColor: '#0BBA74',
      wickDownColor: '#ff4761',
      priceLineStyle: 1, // Dashed
      priceLineWidth: 2,
    })

    // Theme symmetry handler
    const updateTheme = () => {
      const styles = getComputedStyle(document.documentElement)
      const textColor = styles.getPropertyValue('--chart-text').trim() || '#808080'
      const lineColor = styles.getPropertyValue('--chart-line').trim() || '#808080'
      chart.applyOptions({
        layout: { textColor },
        crosshair: {
          vertLine: { color: lineColor },
          horzLine: { color: lineColor },
        }
      })
    }
    updateTheme()
    chartRef.current = chart
    seriesRef.current = series
    lineSeriesRef.current = []

    const onResize = () => {
      if (disposed) return
      try {
        chart.applyOptions({ width: containerRef.current?.clientWidth ?? 600 })
      } catch { }
    }
    onResize()
    const ro = new ResizeObserver(onResize)
    ro.observe(containerRef.current)

    // Sync Close Button Position
    const updateCloseBtnPos = () => {
      if (!seriesRef.current || !chartRef.current) return
      const activePos = positionsRef.current.find(p => p.symbol === symbol || p.symbol === deUnderscore(normalizeFuturesSymbol(symbol)))
      if (activePos) {
        const y = seriesRef.current.priceToCoordinate(parseFloat(activePos.entryPrice))
        setCloseBtnTop(y)
      } else {
        setCloseBtnTop(null)
      }
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(updateCloseBtnPos)

    let rafId: number
    const loop = () => {
      updateCloseBtnPos()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      ro.disconnect()
      disposed = true
      cancelAnimationFrame(rafId)
      try { chart.remove() } catch { }
      chartRef.current = null
      seriesRef.current = null
      lastBarRef.current = null
      drawStartRef.current = null
      lineSeriesRef.current = []
    }
  }, [height, symbol, colorScheme])

  // drawing: handle click-to-place two points + preview
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return

    const clickHandler = (param: any) => {
      if (!drawMode || !param?.point || !chartRef.current || !seriesRef.current) return
      const { x, y } = param.point
      const ts = chartRef.current.timeScale().coordinateToTime(x)
      if (ts === null || ts === undefined) return
      const p = typeof seriesRef.current.coordinateToPrice === 'function'
        ? seriesRef.current.coordinateToPrice(y)
        : null
      if (p === null || p === undefined) return
      const tSec = Math.floor(Number(ts)) as unknown as Time
      const price = Number(p)
      if (!Number.isFinite(price)) return
      const start = drawStartRef.current
      if (!start) {
        drawStartRef.current = { time: tSec, price }
        // Create preview series
        if (!previewSeriesRef.current) {
          previewSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: '#0084ffff', // preview color
            lineWidth: 1,
            lineStyle: 1, // Dashed
            lastValueVisible: false,
            priceLineVisible: false,
          })
        }
      } else {
        // create a new line series for this trendline
        try {
          const ls = chartRef.current.addSeries(LineSeries, {
            color: '#0084ffff', // trendline color
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
          })
          ls.setData([
            { time: start.time, value: start.price },
            { time: tSec, value: price },
          ])
          lineSeriesRef.current.push(ls)
        } catch { }

        // Cleanup preview
        if (previewSeriesRef.current) {
          chartRef.current.removeSeries(previewSeriesRef.current)
          previewSeriesRef.current = null
        }
        drawStartRef.current = null
        setDrawMode(false)
      }
    }

    let rafId: number | null = null
    const moveHandler = (param: any) => {
      if (!drawMode || !drawStartRef.current || !previewSeriesRef.current || !param?.point) return
      if (rafId) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        if (!chartRef.current || !seriesRef.current || !previewSeriesRef.current || !drawStartRef.current) return
        const { x, y } = param.point
        const ts = chartRef.current.timeScale().coordinateToTime(x)
        const p = seriesRef.current.coordinateToPrice(y)
        if (ts !== null && ts !== undefined && p !== null && p !== undefined) {
          const tSec = Math.floor(Number(ts)) as unknown as Time
          previewSeriesRef.current.setData([
            { time: drawStartRef.current.time, value: drawStartRef.current.price },
            { time: tSec, value: Number(p) },
          ])
        }
      })
    }

    chartRef.current.subscribeClick(clickHandler)
    chartRef.current.subscribeCrosshairMove(moveHandler)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(clickHandler)
        chartRef.current.unsubscribeCrosshairMove(moveHandler)
        if (previewSeriesRef.current) {
          try { chartRef.current.removeSeries(previewSeriesRef.current) } catch { }
          previewSeriesRef.current = null
        }
      }
    }
  }, [drawMode])

  useEffect(() => {
    let cancelled = false
    // Clear previous series immediately to avoid showing old symbol while loading
    try {
      if (seriesRef.current) seriesRef.current.setData([])
      lastBarRef.current = null
    } catch { }
    ; (async () => {
      try {
        const path = 'spot/klines'
        const sym = market === 'futures' ? deUnderscore(normalizeFuturesSymbol(symbol)) : symbol
        const url = `${API_BASE}/api/markets/${path}?symbol=${sym}&interval=${interval}&limit=2000`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        const candles = Array.isArray(data)
          ? data.map((k: any[]) => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4] }))
          : []
        if (!cancelled && seriesRef.current) {
          seriesRef.current.setData(candles)
          lastBarRef.current = candles[candles.length - 1] ?? null
          if (candles.length > 0 && chartRef.current) {
            chartRef.current.timeScale().fitContent()
          }
        }
      } catch { }
    })()
    return () => { cancelled = true }
  }, [symbol, interval, market])


  const tick = usePrice(market, symbol)
  const bucketSec = intervalToSeconds(interval)

  useEffect(() => {
    if (!tick || !seriesRef.current) return

    const price = tick.price
    const nowSec = Math.floor(tick.t / 1000)
    const candleTime = Math.floor(nowSec / bucketSec) * bucketSec
    const prev = lastBarRef.current

    if (!prev || prev.time < candleTime) {
      const open = (interval === '1m' && tick.open) ? tick.open : (prev?.close ?? price)
      const newBar = { time: candleTime, open, high: Math.max(open, price), low: Math.min(open, price), close: price }
      try { seriesRef.current.update(newBar) } catch { }
      lastBarRef.current = newBar
    } else if (prev.time === candleTime) {
      const updated = {
        time: prev.time,
        open: prev.open,
        high: Math.max(prev.high, price),
        low: Math.min(prev.low, price),
        close: price,
      }
      try { seriesRef.current.update(updated) } catch { }
      lastBarRef.current = updated
    }
  }, [tick, interval, bucketSec])

  // Overlay: Orders & Positions
  const orderLinesRef = useRef<any[]>([])
  const positionLinesRef = useRef<any[]>([])

  useEffect(() => {
    if (!seriesRef.current) return

    // Clean up old lines
    orderLinesRef.current.forEach(l => { try { seriesRef.current.removePriceLine(l) } catch { } })
    positionLinesRef.current.forEach(l => { try { seriesRef.current.removePriceLine(l) } catch { } })
    orderLinesRef.current = []
    positionLinesRef.current = []

    // Draw Limit Orders
    orders.forEach(o => {
      const price = parseFloat(o.price)
      if (isNaN(price)) return
      const line = seriesRef.current.createPriceLine({
        price,
        color: o.side === 'buy' ? 'var(--green)' : 'var(--red)',
        lineWidth: 1,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
        title: `${o.side.toUpperCase()} ${o.quantity || o.amount || ''}`,
      })
      orderLinesRef.current.push(line)
    })

    // Draw Positions
    positions.forEach(p => {
      // Entry Line
      const entryPrice = parseFloat(p.entryPrice)
      if (!isNaN(entryPrice)) {
        const line = seriesRef.current.createPriceLine({
          price: entryPrice,
          color: p.side === 'long' ? '#0BBA74' : '#fe445c',
          lineWidth: 1,
          lineStyle: 2, // Dotted/Dashed
          axisLabelVisible: true,
          title: `${p.side.charAt(0).toUpperCase() + p.side.slice(1)}`,
        })
        positionLinesRef.current.push(line)
      }

      // Liquidation Line
      const liqPrice = parseFloat(p.liquidationPrice)
      if (!isNaN(liqPrice) && liqPrice > 0) {
        const line = seriesRef.current.createPriceLine({
          price: liqPrice,
          color: '#fe445c',
          lineWidth: 1,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: 'Liq. Price',
        })
        positionLinesRef.current.push(line)
      }

      // Take Profit Line
      const tpPrice = parseFloat(p.tpPrice)
      if (!isNaN(tpPrice) && tpPrice > 0) {
        const line = seriesRef.current.createPriceLine({
          price: tpPrice,
          color: '#fe445c', // TP color
          lineWidth: 1,
          lineStyle: 1, // Dashed
          axisLabelVisible: true,
          title: 'TP',
        })
        positionLinesRef.current.push(line)
      }

      // Stop Loss Line
      const slPrice = parseFloat(p.slPrice)
      if (!isNaN(slPrice) && slPrice > 0) {
        const line = seriesRef.current.createPriceLine({
          price: slPrice,
          color: '#fe445c', // SL color
          lineWidth: 1,
          lineStyle: 1, // Dashed
          axisLabelVisible: true,
          title: 'SL',
        })
        positionLinesRef.current.push(line)
      }
    })

  }, [orders, positions, symbol, market])

  const activePosition = positions.find(p => p.symbol === symbol || p.symbol === deUnderscore(normalizeFuturesSymbol(symbol)))

  return (
    <Box style={{ position: 'relative', width: '100%', height: `${height}px`, minHeight: `${height}px` }}>
      <Box
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><line x1="8" y1="0" x2="8" y2="16" stroke="%23808080" stroke-width="1"/><line x1="0" y1="8" x2="16" y2="8" stroke="%23808080" stroke-width="1"/></svg>') 8 8, crosshair`
        }}
      />

      {/* Top Left: Intervals */}
      <Flex
        gap={4}
        p={4}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
          background: 'var(--mantine-color-body)',
          borderRadius: 'var(--mantine-radius-xl)',
          border: '1px solid var(--mantine-color-default-border)',
          boxShadow: 'var(--mantine-shadow-md)',
          pointerEvents: 'auto'
        }}
      >
        {(props.availableIntervals || ['1m', '5m', '15m', '1h', '4h', '1d']).map((iv) => (
          <Button
            key={iv}
            size="compact-xs"
            variant={interval === iv ? 'filled' : 'subtle'}
            color={interval === iv ? 'dark' : 'gray'}
            onClick={() => props.onIntervalChange && props.onIntervalChange(iv)}
            style={{
              fontSize: 'var(--mantine-font-size-xxs)',
              fontWeight: 700,
              borderRadius: 'var(--mantine-radius-xl)',
              minWidth: '32px',
              padding: '0 4px'
            }}
          >
            {iv}
          </Button>
        ))}
      </Flex>

      {/* Left Sidebar: Drawing Tools */}
      <Box
        style={{
          position: 'absolute',
          top: 60,
          left: 8,
          zIndex: 10,
          pointerEvents: 'auto'
        }}
      >
        <Tooltip label={drawMode ? 'Cancel Draw' : 'Draw Trendline'} position="right">
          <ActionIcon
            onClick={() => setDrawMode(!drawMode)}
            size="lg"
            radius="xl"
            variant={drawMode ? 'filled' : 'outline'}
            color={drawMode ? 'blue' : 'gray'}
            style={{
              boxShadow: 'var(--mantine-shadow-md)',
              borderWidth: '2px',
              transform: drawMode ? 'scale(1.1)' : 'none',
              transition: 'transform 0.1s ease'
            }}
          >
            {drawMode ? <PencilOff size={18} /> : <Pencil size={18} />}
          </ActionIcon>
        </Tooltip>
      </Box>


      {activePosition && props.onClosePosition && closeBtnTop !== null && closeBtnTop >= 0 && closeBtnTop <= height && (
        <Flex
          gap={8}
          align="center"
          style={{
            position: 'absolute',
            top: closeBtnTop,
            left: 8,
            zIndex: 10,
            transform: 'translateY(-50%)',
            pointerEvents: 'auto'
          }}
        >
          {/* Unrealized PNL */}
          {tick && (
            <Box
              px={6}
              py={2}
              style={{
                fontSize: 'var(--fz-xxs)',
                fontWeight: 700,
                backgroundColor: (activePosition.side === 'long' ? tick.price >= activePosition.entryPrice : tick.price <= activePosition.entryPrice) ? 'var(--green)' : 'var(--red)',
                color: 'var(--mantine-color-white)',
                borderRadius: 'var(--mantine-radius-xs)'
              }}
            >
              PNL&nbsp;
              {(() => {
                const lastPrice = tick.price
                const entryPrice = parseFloat(activePosition.entryPrice)
                const qty = parseFloat(activePosition.quantity)
                const pnl = activePosition.side === 'long' ? (lastPrice - entryPrice) * qty : (entryPrice - lastPrice) * qty
                return `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`
              })()}
            </Box>
          )}

          {/* Dynamic: Close Position Button (on the entry line) */}
          <Button
            size="compact-xs"
            color="var(--red)"
            variant="filled"
            onClick={() => props.onClosePosition && props.onClosePosition(activePosition)}
            style={{
              fontSize: 'var(--fz-xxs)',
              fontWeight: 700,
              boxShadow: 'var(--mantine-shadow-md)',
              textTransform: 'uppercase'
            }}
          >
            Close
          </Button>
        </Flex>
      )}
    </Box>
  )
}
