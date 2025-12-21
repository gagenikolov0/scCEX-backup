import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader, Tabs } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import TransferModal from '../components/TransferModal'
import { API_BASE } from '../config/api'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useMarket } from '../contexts/MarketContext'
import { useIntervals } from '../lib/useIntervals'
import PriceDisplay from '../components/PriceDisplay'

export default function Spot() {
  const { isAuthed } = useAuth()
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase()
  const [token, setToken] = useState(initialBase)
  const [pairQuery, setPairQuery] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [placing, setPlacing] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [stats, setStats] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [history, setHistory] = useState<any[]>([])

  const { spotTickers: tickers } = useMarket()
  const { positions, orders, spotAvailable, refreshOrders, refreshBalances } = useAccount()

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

  useEffect(() => {
    setStats(null)
    setLoadingStats(true)
    const ws = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/ws/spot-24h`)
    const sym = `${token}${quote}`
    let stopped = false

    ws.onopen = () => !stopped && ws.send(JSON.stringify({ type: 'sub', symbol: sym }))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string)
        if (!stopped && msg?.type === 'stats' && msg?.symbol === sym) { setStats(msg.data); setLoadingStats(false) }
      } catch { }
    }
    ws.onclose = () => !stopped && setLoadingStats(false)
    ws.onerror = () => !stopped && setLoadingStats(false)

    return () => { stopped = true; ws.readyState === WebSocket.OPEN && ws.close() }
  }, [token, quote])

  const fetchHistory = async () => {
    if (!isAuthed) return
    try {
      const res = await fetch(`${API_BASE}/api/spot/history`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      })
      if (res.ok) setHistory(await res.json())
    } catch { }
  }

  useEffect(() => {
    fetchHistory()
  }, [isAuthed])

  const placeOrder = async (side: 'buy' | 'sell') => {
    if (!qty || Number(qty) <= 0 || !localStorage.getItem('accessToken')) return
    if (orderType === 'limit' && (!price || Number(price) <= 0)) return
    setPlacing(side)
    try {
      const res = await fetch(`${API_BASE}/api/spot/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        credentials: 'include',
        body: JSON.stringify({
          symbol: `${token}${quote}`,
          side,
          quantity: qty,
          price: orderType === 'limit' ? price : undefined,
          orderType
        }),
      })
      if (res.ok) {
        setQty('')
        setPrice('')
        refreshOrders()
        refreshBalances()
        fetchHistory()
      } else {
        const j = await res.json().catch(() => null)
        alert(j?.error || 'Order failed')
      }
    } catch (e) { alert('Order failed') } finally { setPlacing(null) }
  }

  const cancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/spot/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        credentials: 'include',
      })
      if (res.ok) {
        refreshOrders()
        refreshBalances()
      } else {
        const j = await res.json().catch(() => null)
        alert(j?.error || 'Cancel failed')
      }
    } catch (e) { alert('Cancel failed') }
  }

  const formatDate = (date: string) => date ? new Date(date).toLocaleString() : '-'

  const renderTable = (data: any[], columns: string[], emptyMessage: string, showCancel = false) => (
    <table className="w-full text-sm">
      <thead className="text-neutral-500">
        <tr className="text-left border-b">
          {columns.map(col => <th key={col} className="py-2 pr-3">{col}</th>)}
          {showCancel && <th className="py-2 pr-3">Action</th>}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td className="py-4 text-center text-neutral-400" colSpan={columns.length + (showCancel ? 1 : 0)}>{emptyMessage}</td>
          </tr>
        ) : (
          data.map((item, index) => (
            <tr key={item.id || item._id || index} className="border-b last:border-0 hover:bg-neutral-50/50">
              {columns.map(col => {
                let val: any = '-'
                const c = col.toLowerCase()

                if (c === 'symbol') val = item.symbol
                else if (c === 'side') val = <Text size="xs" color={item.side === 'buy' ? 'teal' : 'red'} fw={600} className="uppercase">{item.side}</Text>
                else if (c === 'size' || c === 'quantity') val = Number(item.quantity || item.quantityBase || 0).toFixed(4)
                else if (c === 'price') val = item.price || item.priceQuote
                else if (c === 'total') val = item.total ? `${Number(item.total).toFixed(2)} ${quote}` : (item.quoteAmount ? `${Number(item.quoteAmount).toFixed(2)} ${quote}` : '-')
                else if (c === 'status') val = item.status
                else if (c === 'time' || c === 'closed at') val = formatDate(item.createdAt || item.closedAt)
                else if (c === 'asset') val = item.asset
                else if (c === 'available') val = item.available
                else if (c === 'reserved') val = item.reserved
                else if (c === 'updated') val = formatDate(item.updatedAt)

                return <td key={col} className="py-2 pr-3">{val}</td>
              })}
              {showCancel && (
                <td className="py-2 pr-3">
                  <Button size="compact-xs" variant="light" color="red" onClick={() => cancelOrder(item.id)}>
                    Cancel
                  </Button>
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders])
  const filledOrders = useMemo(() => orders.filter(o => o.status !== 'pending'), [orders])

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
              <Text size="sm">Price: <PriceDisplay price={stats?.lastPrice} /></Text>
              <Text size="sm" c={(Number(stats?.priceChangePercent) || 0) >= 0 ? 'teal' : 'red'}>
                24h: {stats?.priceChangePercent != null ? `${Number(stats.priceChangePercent).toFixed(2)}%` : '-'}
              </Text>
              <Text size="sm">High: {stats?.highPrice ?? '-'} Low: {stats?.lowPrice ?? '-'} Volume: {stats?.volume ?? '-'}
              </Text>
            </>
          )}
        </Group>
      </div>

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
              <div className="flex gap-1 p-1 bg-neutral-100 rounded">
                <Button
                  size="xs"
                  variant={tradeSide === 'buy' ? 'filled' : 'subtle'}
                  color="teal"
                  onClick={() => setTradeSide('buy')}
                  className="flex-1"
                >
                  Buy
                </Button>
                <Button
                  size="xs"
                  variant={tradeSide === 'sell' ? 'filled' : 'subtle'}
                  color="red"
                  onClick={() => setTradeSide('sell')}
                  className="flex-1"
                >
                  Sell
                </Button>
              </div>

              <div className="text-xs text-neutral-500">
                Available: {tradeSide === 'buy' ? `${available} ${quote}` : `${baseAvail} ${token}`}
              </div>

              <div className="flex gap-1 p-1 bg-neutral-100 rounded">
                <Button
                  size="xs"
                  variant={orderType === 'market' ? 'filled' : 'subtle'}
                  onClick={() => setOrderType('market')}
                  className="flex-1"
                >
                  Market
                </Button>
                <Button
                  size="xs"
                  variant={orderType === 'limit' ? 'filled' : 'subtle'}
                  onClick={() => setOrderType('limit')}
                  className="flex-1"
                >
                  Limit
                </Button>
              </div>

              {orderType === 'limit' && (
                <TextInput
                  id="price"
                  label="Price"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.currentTarget.value)}
                  disabled={!isAuthed}
                />
              )}

              <TextInput id="qty" label="Quantity" placeholder="0.00" value={qty} onChange={(e) => setQty(e.currentTarget.value)} disabled={!isAuthed} />
              <div className="flex gap-2">
                {tradeSide === 'buy' ? (
                  <Button
                    className="flex-1"
                    variant="filled"
                    color="teal"
                    loading={placing === 'buy'}
                    disabled={!isAuthed}
                    onClick={() => placeOrder('buy')}
                  >
                    Buy {token}
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    variant="filled"
                    color="red"
                    loading={placing === 'sell'}
                    disabled={!isAuthed}
                    onClick={() => placeOrder('sell')}
                  >
                    Sell {token}
                  </Button>
                )}
              </div>
              <Button variant="default" onClick={() => setTransferOpen(true)} disabled={!isAuthed}>Transfer</Button>
              {!isAuthed && <div className="text-xs text-neutral-500">Login to trade and see your balances.</div>}
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Tabs for History & Positions */}
      <Grid gutter="md">
        <Grid.Col span={12}>
          <Card radius="md" withBorder padding={0}>
            <Tabs defaultValue="history" variant="outline">
              <Tabs.List className="px-3 pt-1">
                <Tabs.Tab value="history">Order History</Tabs.Tab>
                <Tabs.Tab value="tradeHistory" onClick={fetchHistory}>Trade History</Tabs.Tab>
                <Tabs.Tab value="pending">Open Orders</Tabs.Tab>
                <Tabs.Tab value="positions">Assets</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="history" p="md">
                {renderTable(filledOrders, ['Symbol', 'Side', 'Size', 'Price', 'Status', 'Time'], 'No order history')}
              </Tabs.Panel>

              <Tabs.Panel value="tradeHistory" p="md">
                {renderTable(history, ['Symbol', 'Side', 'Quantity', 'Price', 'Total', 'Closed At'], 'No trade history')}
              </Tabs.Panel>

              <Tabs.Panel value="pending" p="md">
                {renderTable(pendingOrders, ['Symbol', 'Side', 'Size', 'Price', 'Status', 'Time'], 'No open orders', true)}
              </Tabs.Panel>

              <Tabs.Panel value="positions" p="md">
                {renderTable(positions, ['Asset', 'Available', 'Reserved', 'Updated'], 'No assets')}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Grid.Col>
      </Grid>

      <TransferModal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentSide="spot"
        asset={quote as 'USDT' | 'USDC'}
        onTransferred={() => {
          refreshBalances()
          refreshOrders()
        }}
      />
    </div>
  )
}