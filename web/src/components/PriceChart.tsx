import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'
import { Pencil, PencilOff } from 'lucide-react'
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
    if (!containerRef.current) return
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { }
    }
    let disposed = false
    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: 'transparent' }, textColor: '#888' },
      grid: { horzLines: { color: 'rgba(0,0,0,0.1)' }, vertLines: { color: 'rgba(0,0,0,0.1)' } },
      timeScale: { rightOffset: 6, barSpacing: 8, fixLeftEdge: true },
      rightPriceScale: { borderVisible: false },
      crosshair: {
        mode: 0,
        vertLine: { width: 1, color: '#4b5563', style: 2, labelVisible: true },
        horzLine: { width: 1, color: '#4b5563', style: 2, labelVisible: true },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#0aa869',
      downColor: '#fe445c',
      borderUpColor: '#0aa869',
      borderDownColor: '#fe445c',
      wickUpColor: '#0aa869',
      wickDownColor: '#fe445c',
      priceLineStyle: 1, // Dashed
      priceLineWidth: 2,
    })
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
  }, [height, symbol])

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
        const url = `${API_BASE}/api/markets/${path}?symbol=${sym}&interval=${interval}&limit=200`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        const candles = Array.isArray(data)
          ? data.map((k: any[]) => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4] }))
          : []
        if (!cancelled && seriesRef.current) {
          seriesRef.current.setData(candles)
          lastBarRef.current = candles[candles.length - 1] ?? null
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
        color: o.side === 'buy' ? '#16a34a' : '#e03131',
        lineWidth: 1,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
        title: `${o.side.toUpperCase()} ${o.quantity || o.amount || ''}`,
      })
      orderLinesRef.current.push(line)
    })

    // Draw Futures Positions
    positions.forEach(p => {
      // Entry Line
      const entryPrice = parseFloat(p.entryPrice)
      if (!isNaN(entryPrice)) {
        const line = seriesRef.current.createPriceLine({
          price: entryPrice,
          color: p.side === 'long' ? '#0aa769' : '#fe445c',
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
          color: 'var(--liq)',
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
    <div className="relative w-full" style={{ height: `${height}px`, minHeight: `${height}px` }}>
      <div ref={containerRef} className="w-full h-full" style={{ cursor: 'crosshair' }} />

      {/* Top Left: Intervals */}
      <div
        className="absolute z-[10] flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-2xl border border-gray-200"
        style={{
          top: 8,
          left: 8,
          pointerEvents: 'auto'
        }}
      >
        {(props.availableIntervals || ['1m', '5m', '15m', '1h', '4h', '1d']).map((iv) => (
          <button
            key={iv}
            onClick={() => props.onIntervalChange && props.onIntervalChange(iv)}
            className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${interval === iv
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            {iv}
          </button>
        ))}
      </div>

      {/* Left Sidebar: Drawing Tools */}
      <div
        className="absolute z-[10] flex flex-col gap-2"
        style={{
          top: 60,
          left: 8,
          pointerEvents: 'auto'
        }}
      >
        <button
          onClick={() => setDrawMode(!drawMode)}
          className={`p-2 rounded-full transition-all shadow-2xl border-2 flex items-center justify-center ${drawMode
            ? 'bg-blue-600 text-white border-blue-400 scale-110'
            : 'bg-white text-gray-900 border-gray-400 hover:bg-gray-50'
            }`}
          title={drawMode ? 'Cancel Draw' : 'Draw Trendline'}
        >
          {drawMode ? <PencilOff size={18} /> : <Pencil size={18} />}
        </button>
      </div>

      {/* Dynamic: Close Position Button (on the entry line) */}
      {activePosition && props.onClosePosition && closeBtnTop !== null && closeBtnTop >= 0 && closeBtnTop <= height && (
        <div
          className="absolute z-[10] flex items-center gap-2"
          style={{
            top: closeBtnTop,
            left: 8,
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            display: 'flex'
          }}
        >
          {/* Unrealized PNL */}
          {tick && (
            <div
              className="px-2 py-0.5 text-[11px]"
              style={{
                padding: '1px 4px 2px 4px',
                backgroundColor: (activePosition.side === 'long' ? tick.price >= activePosition.entryPrice : tick.price <= activePosition.entryPrice) ? '#0bba74' : '#ff4761',
                color: '#ffffff'
              }}
            >PNL&nbsp;
              {(() => {
                const lastPrice = tick.price
                const entryPrice = parseFloat(activePosition.entryPrice)
                const qty = parseFloat(activePosition.quantity)
                const pnl = activePosition.side === 'long' ? (lastPrice - entryPrice) * qty : (entryPrice - lastPrice) * qty
                return `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`
              })()}
            </div>
          )}

          <button
            onClick={() => props.onClosePosition && props.onClosePosition(activePosition)}
            className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors shadow-2xl border border-red-700 uppercase"
            title="Close Position"
          >
            Close
          </button>
        </div>
      )}
    </div >
  )
}
