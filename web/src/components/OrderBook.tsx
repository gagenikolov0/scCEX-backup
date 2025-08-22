import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE } from '../config/api'

type SideRow = [number, number] // [price, size]

export default function OrderBook({ symbol, market, depth = 50 }: { symbol: string; market: 'spot'|'futures'; depth?: number }) {
  const [bids, setBids] = useState<SideRow[]>([])
  const [asks, setAsks] = useState<SideRow[]>([])
  const [status, setStatus] = useState<'connecting'|'open'|'closed'|'error'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    setBids([]); setAsks([]); setError(null); setStatus('connecting')
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const path = market === 'futures' ? '/ws/futures-depth' : '/ws/spot-depth'
    const sym = market === 'futures' && !symbol.includes('_') ? symbol.replace(/(USDT|USDC)$/,'_$1') : symbol
    let stopped = false
    let ws: WebSocket | null = null
    let retries = 0
    const connect = () => {
      if (stopped) return
      try {
        ws = new WebSocket(`${wsBase}${path}`)
        ws.onopen = () => {
          setStatus('open')
          retries = 0
          try { ws?.send(JSON.stringify({ type: 'sub', symbol: sym, depth })) } catch {}
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string)
            if (msg?.type === 'depth' && msg?.symbol && Array.isArray(msg?.bids) && Array.isArray(msg?.asks)) {
              lastUpdateRef.current = Date.now()
              setBids(msg.bids as SideRow[])
              setAsks(msg.asks as SideRow[])
            }
          } catch {}
        }
        ws.onerror = () => { if (!stopped) { setStatus('error'); setError('Orderbook connection error') } }
        ws.onclose = () => {
          if (stopped) return
          setStatus('closed')
          setTimeout(connect, Math.min(1500 * Math.max(1, ++retries), 8000))
        }
      } catch (e: any) {
        setStatus('error')
        setError(e?.message ?? 'Orderbook init error')
        setTimeout(connect, Math.min(1500 * Math.max(1, ++retries), 8000))
      }
    }
    connect()
    return () => {
      stopped = true
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'unsub', symbol: sym })) } catch {}
        try { ws.close() } catch {}
      }
    }
  }, [symbol, market, depth])

  const totals = useMemo(() => {
    const bidTotals: number[] = []
    const askTotals: number[] = []
    let t = 0
    for (const [, s] of bids) { t += s; bidTotals.push(t) }
    t = 0
    for (const [, s] of asks) { t += s; askTotals.push(t) }
    return { bidTotals, askTotals }
  }, [bids, asks])

  const fmt = (n: number | undefined) => (Number.isFinite(n as number) ? (n as number).toString() : '-')

  const revAsks = useMemo(() => asks.slice().reverse(), [asks])
  const askTotalsRev = useMemo(() => totals.askTotals.slice().reverse(), [totals])

  return (
    <div className="p-3 text-sm">
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="grid grid-cols-3 gap-y-1 mb-2 sticky top-0 bg-transparent">
        <div className="text-neutral-500">Price</div>
        <div className="text-neutral-500">Size</div>
        <div className="text-neutral-500">Total</div>
      </div>
      <div className="grid grid-cols-3 gap-y-1">
        {revAsks.map((r, i) => (
          <div key={`a-${i}`} className="contents">
            <div className="text-red-600">{fmt(r[0])}</div>
            <div>{fmt(r[1])}</div>
            <div>{fmt(askTotalsRev[i])}</div>
          </div>
        ))}
        {bids.map((r, i) => (
          <div key={`b-${i}`} className="contents">
            <div className="text-green-600">{fmt(r[0])}</div>
            <div>{fmt(r[1])}</div>
            <div>{fmt(totals.bidTotals[i])}</div>
          </div>
        ))}
      </div>
      {status !== 'open' && bids.length === 0 && asks.length === 0 && (
        <div className="text-xs text-neutral-500 mt-2">{status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Reconnecting…' : 'Waiting for data…'}</div>
      )}
    </div>
  )
}


