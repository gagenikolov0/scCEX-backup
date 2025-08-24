import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import TransferModal from '../components/TransferModal'
import { API_BASE } from '../config/api'
import { useAuth } from '../auth/AuthContext'
import { useAccount } from '../auth/AccountContext'
import { useMarket } from '../markets/MarketContext'
import { useIntervals } from '../lib/useIntervals'

export default function Spot() {
  const { isAuthed } = useAuth()
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase()
  const [token, setToken] = useState(initialBase)
  const [pairQuery, setPairQuery] = useState('')
  const [qty, setQty] = useState('')
  const [placing, setPlacing] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [stats, setStats] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const { spotTickers: tickers } = useMarket()
  const { positions, orders, spotAvailable, refreshOrders } = useAccount()

  useEffect(() => setToken(initialBase), [initialBase])

  const tokenOptions = useMemo(() => {
    const list = tickers.filter(t => t.symbol.endsWith(quote)).map(t => t.symbol.replace(quote, ''))
    return Array.from(new Set(list))
  }, [tickers, quote])

  const filteredOptions = useMemo(() => {
    const q = pairQuery.trim().toLowerCase()
    return (q ? tokenOptions.filter(t => t.toLowerCase().includes(q)) : tokenOptions).slice(0, 500)
  }, [tokenOptions, pairQuery])

  const { availableIntervals, interval, setInterval } = useIntervals({
    symbol: `${token}${quote}`,
    market: 'spot'
  })

  const available = (spotAvailable as any)?.[quote] ?? '0'
  const baseAvail = positions.find((r: any) => (r?.asset || '').toUpperCase() === token.toUpperCase())?.available ?? '0'

  // WebSocket for 24h stats
  useEffect(() => {
    setStats(null)
    setLoadingStats(true)
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const sym = `${token}${quote}`
    let stopped = false
    let ws: WebSocket | null = null
    
    try {
      ws = new WebSocket(`${wsBase}/ws/spot-24h`)
      ws.onopen = () => {
        if (stopped) { try { ws?.close() } catch {} ; return }
        try { ws?.send(JSON.stringify({ type: 'sub', symbol: sym })) } catch {}
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (!stopped && msg?.type === 'stats' && msg?.symbol === sym) {
            setStats(msg.data)
            setLoadingStats(false)
          }
        } catch {}
      }
      ws.onclose = () => { if (!stopped) setLoadingStats(false) }
      ws.onerror = () => { if (!stopped) setLoadingStats(false) }
    } catch {
      setLoadingStats(false)
    }
    
    return () => {
      stopped = true
      if (ws?.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'unsub', symbol: sym })) } catch {}
        try { ws.close() } catch {}
      }
    }
  }, [token, quote])

  const placeOrder = async (side: 'buy'|'sell') => {
    if (!qty || Number(qty) <= 0) return
    const tokenStr = localStorage.getItem('accessToken')
    if (!tokenStr) return
    
    setPlacing(side)
    try {
      const res = await fetch(`${API_BASE}/api/spot/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenStr}` },
        credentials: 'include',
        body: JSON.stringify({ symbol: `${token}${quote}`, side, quantity: qty }),
      })
      
      if (res.ok) {
        setQty('')
        refreshOrders()
      } else {
        const j = await res.json().catch(() => null)
        alert(j?.error || 'Order failed')
      }
    } catch (e) {
      alert('Order failed')
    } finally {
      setPlacing(null)
    }
  }

  const formatDate = (date: string) => date ? new Date(date).toLocaleString() : '-'

  return (
    <div className="grid gap-4">
      {/* Header Controls */}
      <div className="flex items-center gap-3">
        <Menu shadow="md" width={260} position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="outline" size="compact-md" className="h-10">
              <div className="leading-tight text-left">
                <div className="text-sm font-medium">{token}/{quote}</div>
              </div>
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <div className="p-2">
              <TextInput placeholder="Search pair" value={pairQuery} onChange={(e) => setPairQuery(e.currentTarget.value)} size="xs" />
            </div>
            <ScrollArea.Autosize mah={320} mx={0} type="auto">
              {filteredOptions.map((t) => (
                <Menu.Item key={t} onClick={() => setToken(t)}>{t}/{quote}</Menu.Item>
              ))}
            </ScrollArea.Autosize>
          </Menu.Dropdown>
        </Menu>
        
        <Menu shadow="md" width={180} position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="outline" size="compact-md" className="h-10">{interval}</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {availableIntervals.map((iv) => (
              <Menu.Item key={iv} onClick={() => setInterval(iv)}>{iv}</Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        
        <Group gap="md" className="ml-1" wrap="wrap">
          {loadingStats ? <Loader size="xs" /> : (
            <>
              <Text size="sm">Price: {stats?.lastPrice ?? '-'}</Text>
              <Text size="sm" c={(Number(stats?.priceChangePercent) || 0) >= 0 ? 'teal' : 'red'}>
                24h: {stats?.priceChangePercent != null ? `${Number(stats.priceChangePercent).toFixed(2)}%` : '-'}
              </Text>
              <Text size="sm">High: {stats?.highPrice ?? '-'}</Text>
              <Text size="sm">Low: {stats?.lowPrice ?? '-'}</Text>
              <Text size="sm">Vol: {stats?.volume ?? '-'}</Text>
              <Text size="sm">QuoteVol: {stats?.quoteVolume ?? '-'}</Text>
            </>
          )}
        </Group>
      </div>

      {/* Main Trading Interface */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-2">
              <PriceChart key={`${token}${quote}-${interval}-spot`} symbol={`${token}${quote}`} interval={interval} />
            </div>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Order Book</div>
            <div className="p-0 h-[360px] overflow-y-auto text-sm">
              <OrderBook symbol={`${token}${quote}`} market="spot" depth={50} />
            </div>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, lg: 2 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Trade</div>
            <div className="p-4 grid gap-3">
              <div className="text-xs text-neutral-500">Available: {available} {quote} • {baseAvail} {token}</div>
              <TextInput id="qty" label="Quantity" placeholder="0.00" value={qty} onChange={(e) => setQty(e.currentTarget.value)} disabled={!isAuthed} />
              <div className="flex gap-2">
                <Button className="flex-1" variant="light" color="teal" loading={placing === 'buy'} disabled={!isAuthed} onClick={() => placeOrder('buy')}>Buy</Button>
                <Button className="flex-1" color="red" loading={placing === 'sell'} disabled={!isAuthed} onClick={() => placeOrder('sell')}>Sell</Button>
              </div>
              <Button variant="default" onClick={() => setTransferOpen(true)} disabled={!isAuthed}>Transfer</Button>
              {!isAuthed && <div className="text-xs text-neutral-500">Login to trade and see your balances.</div>}
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Order History */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Order History</div>
            <div className="p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-neutral-500">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Symbol</th>
                    <th className="py-2 pr-3">Side</th>
                    <th className="py-2 pr-3">Size</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="py-2 pr-3">{o.symbol}</td>
                      <td className={`py-2 pr-3 ${o.side === 'buy' ? 'text-green-600' : 'text-red-600'}`}>{o.side}</td>
                      <td className="py-2 pr-3">{o.quantity}</td>
                      <td className="py-2 pr-3">{o.price}</td>
                      <td className="py-2 pr-3">{o.status}</td>
                      <td className="py-2 pr-3">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr className="border-t">
                      <td className="py-2 pr-3" colSpan={6}>No orders</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Positions */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Positions</div>
            <div className="p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-neutral-500">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Asset</th>
                    <th className="py-2 pr-3">Available</th>
                    <th className="py-2 pr-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p: any) => (
                    <tr key={p.asset} className="border-t">
                      <td className="py-2 pr-3">{p.asset}</td>
                      <td className="py-2 pr-3">{p.available}</td>
                      <td className="py-2 pr-3">{formatDate(p.updatedAt)}</td>
                    </tr>
                  ))}
                  {positions.length === 0 && (
                    <tr className="border-t">
                      <td className="py-2 pr-3" colSpan={3}>No positions</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      <TransferModal opened={transferOpen} onClose={() => setTransferOpen(false)} currentSide="spot" asset={quote as 'USDT'|'USDC'} onTransferred={undefined} />
    </div>
  )
}


