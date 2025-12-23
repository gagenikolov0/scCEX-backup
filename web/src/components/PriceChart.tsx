import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'
import { API_BASE } from '../config/api'
import type { IChartApi, Time } from 'lightweight-charts'

type Props = {
  symbol: string // e.g. BTCUSDT or BTC_USDT (normalized internally)
  height?: number
  interval?: string // e.g. '1m','5m','1h','1d'
  market?: 'spot' | 'futures'
  orders?: any[]
  positions?: any[]
}

export default function PriceChart({ symbol, height = 420, interval = '1m', market = 'spot', orders = [], positions = [] }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<any>(null)
  const lastBarRef = useRef<any>(null)
  const lineSeriesRef = useRef<any[]>([])
  const [drawMode, setDrawMode] = useState(false)
  const drawStartRef = useRef<{ time: Time; price: number } | null>(null)

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
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#ef4444',
      borderUpColor: '#16a34a',
      borderDownColor: '#ef4444',
      wickUpColor: '#16a34a',
      wickDownColor: '#ef4444',
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

    // drawing: handle click-to-place two points
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
      } else {
        // create a new line series for this trendline
        try {
          const ls = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 2 })
          ls.setData([
            { time: start.time, value: start.price },
            { time: tSec, value: price },
          ])
          lineSeriesRef.current.push(ls)
        } catch { }
        drawStartRef.current = null
        setDrawMode(false)
      }
    }
    chart.subscribeClick(clickHandler)

    return () => {
      ro.disconnect()
      disposed = true
      try { chart.remove() } catch { }
      chartRef.current = null
      seriesRef.current = null
      lastBarRef.current = null
      drawStartRef.current = null
      lineSeriesRef.current = []
    }
  }, [height, drawMode])

  useEffect(() => {
    let cancelled = false
    // Clear previous series immediately to avoid showing old symbol while loading
    try {
      if (seriesRef.current) seriesRef.current.setData([])
      lastBarRef.current = null
    } catch { }
    ; (async () => {
      try {
        // Temporarily use spot klines for futures to avoid upstream 502; WS still uses futures ticks
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

  useEffect(() => {
    // Live updates via WS proxy aggregated into current candle bucket
    let stopped = false
    let ws: WebSocket | null = null
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const sym = market === 'futures' ? normalizeFuturesSymbol(symbol) : symbol
    const bucket = () => intervalToSeconds(interval)

    const tryConnect = (paths: string[]) => {
      if (stopped || paths.length === 0) return
      const path = paths[0]
      try {
        ws = new WebSocket(`${wsBase}${path}`)
        let opened = false
        ws.onopen = () => {
          if (stopped) { try { ws?.close() } catch { }; return }
          opened = true
          try { ws?.send(JSON.stringify({ type: 'sub', symbol: sym })) } catch { }
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string)
            if (!stopped && msg?.type === 'tick' && msg?.symbol === sym && seriesRef.current) {
              const price = Number(msg.price)
              if (!Number.isFinite(price)) return
              const nowSec = Math.floor((msg.t ?? Date.now()) / 1000)
              const bucketSec = bucket()
              const candleTime = Math.floor(nowSec / bucketSec) * bucketSec
              const prev = lastBarRef.current
              if (!prev || prev.time < candleTime) {
                const open = prev?.close ?? price
                const newBar = { time: candleTime, open, high: price, low: price, close: price }
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
            }
          } catch { }
        }
        ws.onclose = () => {
          if (!stopped && !opened) {
            // fallback to next path if never opened
            tryConnect(paths.slice(1))
          } else if (!stopped) {
            setTimeout(() => tryConnect([path]), 1500)
          }
        }
        ws.onerror = () => { /* let onclose handle reconnect/fallback */ }
      } catch {
        if (!stopped) tryConnect(paths.slice(1))
      }
    }

    const paths = market === 'futures' ? ['/ws/futures-ticks'] : ['/ws/spot-ticks']
    tryConnect(paths)

    return () => {
      stopped = true
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'unsub', symbol: sym })) } catch { }
        try { ws.close() } catch { }
      }
    }
  }, [symbol, interval, market])

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

    // Draw Orders
    orders.forEach(o => {
      const price = parseFloat(o.price)
      if (isNaN(price)) return
      const line = seriesRef.current.createPriceLine({
        price,
        color: o.side === 'buy' ? '#16a34a' : '#ef4444',
        lineWidth: 1,
        lineStyle: 2, // Dotted
        axisLabelVisible: true,
        title: `${o.side.toUpperCase()} ${o.amount}`,
      })
      orderLinesRef.current.push(line)
    })

    // Draw Positions
    positions.forEach(p => {
      const price = parseFloat(p.entryPrice)
      if (isNaN(price)) return
      const line = seriesRef.current.createPriceLine({
        price,
        color: p.side === 'long' ? '#3b82f6' : '#a855f7',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: `${p.side.toUpperCase()} POS`,
      })
      positionLinesRef.current.push(line)
    })

  }, [orders, positions, symbol, market])

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" />
      <div className="absolute top-2 right-2 flex gap-2">
        <button
          onClick={() => setDrawMode(!drawMode)}
          className={`px-2 py-1 text-xs rounded ${drawMode ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {drawMode ? 'Cancel' : 'Draw'}
        </button>
      </div>
    </div>
  )
}


