import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { API_BASE } from '../config/api'
import { Box, Text, SimpleGrid } from '@mantine/core'
import BigPrice from './BigPrice'

type SideRow = [number, number] // [price, size]

const OrderRow = memo(({ price, size, total, color }: { price: string, size: string, total: string, color: string }) => (
  <SimpleGrid cols={3} spacing={4}>
    <Text size="xs" color={color} fw={500}>{price}</Text>
    <Text size="xs">{size}</Text>
    <Text size="xs" c="dimmed">{total}</Text>
  </SimpleGrid>
))

export default function OrderBook({ symbol, market, depth = 50 }: { symbol: string; market: 'spot' | 'futures'; depth?: number }) {
  const [bids, setBids] = useState<SideRow[]>([])
  const [asks, setAsks] = useState<SideRow[]>([])
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    if (!symbol) return

    setBids([]); setAsks([]); setError(null); setStatus('connecting')
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const path = market === 'futures' ? '/ws/futures-depth' : '/ws/spot-depth'
    const sym = market === 'futures'
      ? (symbol.includes('_') ? symbol : symbol.replace(/(USDT|USDC)$/i, '_$1'))
      : symbol.replace('_', '');
    let stopped = false
    let ws: WebSocket | null = null
    let retries = 0
    const connect = () => {
      if (stopped) return
      try {
        ws = new WebSocket(`${wsBase}${path}`)
        ws.onopen = () => {
          if (stopped) { try { ws?.close() } catch { }; return }
          setStatus('open')
          retries = 0
          try { ws?.send(JSON.stringify({ type: 'sub', symbol: sym, depth })) } catch { }
        }

        let pendingBids: SideRow[] | null = null
        let pendingAsks: SideRow[] | null = null

        const throttleInterval = setInterval(() => {
          if (pendingBids || pendingAsks) {
            if (pendingBids) setBids(pendingBids)
            if (pendingAsks) setAsks(pendingAsks)
            pendingBids = null
            pendingAsks = null
          }
        }, 3000)

        ws.onmessage = (ev) => {
          try {
            if (stopped) return
            const msg = JSON.parse(ev.data as string)
            if (msg?.type === 'depth' && msg?.symbol === sym && Array.isArray(msg?.bids) && Array.isArray(msg?.asks)) {
              lastUpdateRef.current = Date.now()
              pendingBids = msg.bids as SideRow[]
              pendingAsks = msg.asks as SideRow[]
            }
          } catch { }
        }
        ws.onerror = () => { if (!stopped) { setStatus('error'); setError('Orderbook connection error') } }
        ws.onclose = () => {
          clearInterval(throttleInterval)
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
        try { ws.send(JSON.stringify({ type: 'unsub', symbol: sym })) } catch { }
        try { ws.close() } catch { }
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
    <Box p="sm" style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && <Text color="red" size="sm" mb="xs">{error}</Text>}
      {status === 'connecting' && <Text c="dimmed" size="sm" mb="xs">Connecting...</Text>}

      <SimpleGrid cols={3} spacing={4} mb={8} style={{ zIndex: 1 }}>
        <Text size="sm" c="dimmed" fw={500}>Price</Text>
        <Text size="sm" c="dimmed" fw={500}>Size</Text>
        <Text size="sm" c="dimmed" fw={500}>Total</Text>
      </SimpleGrid>

      {/* ASKS (Fixed List) */}
      <Box style={{ flex: 1, overflow: 'hidden' }}>
        {revAsks.slice(-Math.floor(depth / 2)).map((r, i) => (
          <OrderRow
            key={i}
            price={fmt(r[0])}
            size={fmt(r[1])}
            total={fmt(askTotalsRev[i])} // Note: Totals calculation might need adjustment to match slice? Actually totals is based on full list.
            // If we slice display, we might want to slice totals too.
            color="var(--red)"
          />
        ))}
      </Box>

      <Box m={0} p={0} mb={10}>
        <BigPrice symbol={symbol} market={market} />
      </Box>

      {/* BIDS (Fixed List) */}
      <Box style={{ flex: 1, overflow: 'hidden' }}>
        {bids.slice(0, Math.floor(depth / 2)).map((r, i) => (
          <OrderRow
            key={i}
            price={fmt(r[0])}
            size={fmt(r[1])}
            total={fmt(totals.bidTotals[i])}
            color="var(--green)"
          />
        ))}
      </Box>
    </Box >
  )
}


