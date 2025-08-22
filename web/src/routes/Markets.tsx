import { useEffect, useMemo, useState } from 'react'
import { Card, TextInput, Anchor } from '@mantine/core'
import { Link } from 'react-router-dom'
import { API_BASE } from '../config/api'


type Ticker = { symbol: string; price: string }

function splitSymbol(sym: string): { base: string; quote: string } {
  if (sym.endsWith('USDT')) return { base: sym.slice(0, -4), quote: 'USDT' }
  if (sym.endsWith('USDC')) return { base: sym.slice(0, -4), quote: 'USDC' }
  return { base: sym, quote: '' }
}

export default function Markets() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [futures, setFutures] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  // (dots/price-direction indicators removed to simplify UI)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        const res = await fetch(`${API_BASE}/api/markets/spot/tickers`)
        if (!res.ok) throw new Error('Failed to load markets')
        const data = (await res.json()) as Ticker[]
        if (!cancelled) setTickers(Array.isArray(data) ? data : [])
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to load markets')
      }
    })()
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/futures/tickers`)
        if (!res.ok) return
        const j = await res.json()
        const arr = Array.isArray(j?.data) ? j.data : []
        if (!cancelled) setFutures(arr)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    // Live updates via WS tickers (handle React StrictMode double-mount)
    let stopped = false
    let ws: WebSocket | null = null
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const connect = () => {
      if (stopped) return
      try {
        ws = new WebSocket(`${wsBase}/ws/tickers`)
        ws.onopen = () => { console.debug('[markets] ws open', ws?.readyState) }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string)
            if (msg?.type === 'tickers' && Array.isArray(msg.data)) {
              setTickers(msg.data)
            }
          } catch {}
        }
        ws.onclose = (e) => {
          if (!stopped) {
            console.warn('[markets] ws close', e.code, e.reason)
            setTimeout(connect, 1500)
          }
        }
        ws.onerror = (e) => {
          if (!stopped) console.error('[markets] ws error', e)
        }
      } catch (e) { console.error('[markets] ws init error', e) }
    }
    connect()
    return () => {
      stopped = true
      // Avoid force-closing CONNECTING sockets during StrictMode teardown
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.close() } catch {}
      }
    }
  }, [])

  useEffect(() => {
    // Futures WS updates
    let stopped = false
    let ws: WebSocket | null = null
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const connect = () => {
      if (stopped) return
      try {
        ws = new WebSocket(`${wsBase}/ws/futures-tickers`)
        ws.onopen = () => { console.debug('[markets] futures ws open', ws?.readyState) }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string)
            if (msg?.type === 'futures-tickers' && msg?.data) {
              const arr = Array.isArray(msg.data?.data) ? msg.data.data : []
              setFutures(arr)
            }
          } catch {}
        }
        ws.onclose = () => { if (!stopped) setTimeout(connect, 1500) }
        ws.onerror = (e) => { if (!stopped) console.error('[markets] futures ws error', e) }
      } catch {}
    }
    connect()
    return () => {
      stopped = true
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.close() } catch {}
      }
    }
  }, [])

  const filterFn = (t: Ticker) => {
    if (!q) return true
    const s = t.symbol.toLowerCase()
    const qq = q.toLowerCase()
    return s.includes(qq)
  }

  const spotUSDT = useMemo(() => tickers.filter(t => t.symbol.endsWith('USDT')).filter(filterFn), [tickers, q])
  const spotUSDC = useMemo(() => tickers.filter(t => t.symbol.endsWith('USDC')).filter(filterFn), [tickers, q])

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <TextInput placeholder="Search (e.g. BTC, SOL)" value={q} onChange={e => setQ(e.currentTarget.value)} className="max-w-xs" />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Spot · USDT</div>
          <div className="divide-y max-h-[420px] overflow-auto">
            {spotUSDT.map(t => {
              const { base, quote } = splitSymbol(t.symbol)
              return (
                <Anchor key={`spot-usdt-${t.symbol}`} component={Link} to={`/spot?base=${base}&quote=${quote}`} underline="never" c="inherit" className="flex justify-between items-center px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <div className="text-sm font-medium">{base}/{quote}</div>
                  <div className="text-sm tabular-nums">{t.price}</div>
                </Anchor>
              )
            })}
          </div>
        </Card>

        <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Spot · USDC</div>
          <div className="divide-y max-h-[420px] overflow-auto">
            {spotUSDC.map(t => {
              const { base, quote } = splitSymbol(t.symbol)
              return (
                <Anchor key={`spot-usdc-${t.symbol}`} component={Link} to={`/spot?base=${base}&quote=${quote}`} underline="never" c="inherit" className="flex justify-between items-center px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <div className="text-sm font-medium">{base}/{quote}</div>
                  <div className="text-sm tabular-nums">{t.price}</div>
                </Anchor>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Futures · USDT Perpetuals</div>
          <div className="divide-y max-h-[420px] overflow-auto">
            {futures.filter(f => typeof f.symbol === 'string' && f.symbol.endsWith('_USDT')).map(f => (
              <Anchor component={Link} underline="never" c="inherit" key={`fut-usdt-${f.symbol}`} to={`/futures?base=${f.symbol.replace('_USDT','')}&quote=USDT`} className="flex justify-between items-center px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <div className="text-sm font-medium">{f.symbol.replace('_','/')} Perp</div>
                <div className="text-sm tabular-nums">{f.lastPrice ?? ''}</div>
              </Anchor>
            ))}
          </div>
        </Card>
        <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Futures · USDC Perpetuals</div>
          <div className="divide-y max-h-[420px] overflow-auto">
            {futures.filter(f => typeof f.symbol === 'string' && f.symbol.endsWith('_USDC')).map(f => (
              <Anchor component={Link} underline="never" c="inherit" key={`fut-usdc-${f.symbol}`} to={`/futures?base=${f.symbol.replace('_USDC','')}&quote=USDC`} className="flex justify-between items-center px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <div className="text-sm font-medium">{f.symbol.replace('_','/')} Perp</div>
                <div className="text-sm tabular-nums">{f.lastPrice ?? ''}</div>
              </Anchor>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}


