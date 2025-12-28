import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE } from '../config/api'
import { Box, Text, SimpleGrid } from '@mantine/core'
import BigPrice from './BigPrice'

type SideRow = [number, number] // [price, size]

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
    const sym = market === 'futures' && !symbol.includes('_') ? symbol.replace(/(USDT|USDC)$/, '_$1') : symbol
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
        ws.onmessage = (ev) => {
          try {
            if (stopped) return
            const msg = JSON.parse(ev.data as string)
            if (msg?.type === 'depth' && msg?.symbol === sym && Array.isArray(msg?.bids) && Array.isArray(msg?.asks)) {
              lastUpdateRef.current = Date.now()
              setBids(msg.bids as SideRow[])
              setAsks(msg.asks as SideRow[])
            }
          } catch { }
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
    <Box p="sm" style={{ overflowX: 'hidden' }}>
      {error && <Text color="red" size="sm" mb="xs">{error}</Text>}
      {status === 'connecting' && <Text c="dimmed" size="sm" mb="xs">Connecting...</Text>}

      <SimpleGrid cols={3} spacing={4} mb={8} style={{ position: 'sticky', top: 0, backgroundColor: 'transparent', zIndex: 1 }}>
        <Text size="xs" c="dimmed" fw={500}>Price</Text>
        <Text size="xs" c="dimmed" fw={500}>Size</Text>
        <Text size="xs" c="dimmed" fw={500}>Total</Text>
      </SimpleGrid>

      <SimpleGrid cols={3} spacing={4}>
        {revAsks.map((r, i) => (
          <Box key={`a-${i}`} style={{ display: 'contents' }}>
            <Text size="xs" color="var(--red)" fw={500}>{fmt(r[0])}</Text>
            <Text size="xs">{fmt(r[1])}</Text>
            <Text size="xs" c="dimmed">{fmt(askTotalsRev[i])}</Text>
          </Box>
        ))}
      </SimpleGrid>

      <Box py={3} my={4} style={{ borderTop: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)', textAlign: 'center' }}>
        <BigPrice symbol={symbol} market={market} />
      </Box>

      <SimpleGrid cols={3} spacing={4}>
        {bids.map((r, i) => (
          <Box key={`b-${i}`} style={{ display: 'contents' }}>
            <Text size="xs" color="var(--green)" fw={500}>{fmt(r[0])}</Text>
            <Text size="xs">{fmt(r[1])}</Text>
            <Text size="xs" c="dimmed">{fmt(totals.bidTotals[i])}</Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box >
  )
}


