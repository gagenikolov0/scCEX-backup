import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader, Tabs } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import { API_BASE } from '../config/api'
import { useMarket } from '../contexts/MarketContext'
import { useIntervals } from '../lib/useIntervals'
import BigPrice from '../components/BigPrice'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import TransferModal from '../components/TransferModal'

export default function Futures() {
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase()
  const [token, setToken] = useState(initialBase)
  const [pairQuery, setPairQuery] = useState('')
  const [stats, setStats] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const { futuresStats, listen, unlisten } = useMarket()
  const { isAuthed } = useAuth()
  const { futuresAvailable, refreshBalances, futuresPositions, orders: recentOrders } = useAccount()

  useEffect(() => {
    listen()
    return () => unlisten()
  }, [])
  const [qty, setQty] = useState('')
  const [leverage, setLeverage] = useState('10')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [loadingOrder, setLoadingOrder] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  useEffect(() => setToken(initialBase), [initialBase])

  const tokenOptions = useMemo(() => {
    const list = futuresStats
      .filter(r => typeof r.symbol === 'string' && r.symbol.endsWith(quote))
      .map(r => r.symbol.replace(`_${quote}`, ''))
    return Array.from(new Set(list))
  }, [futuresStats, quote])

  const filteredOptions = useMemo(() => {
    const q = pairQuery.trim().toLowerCase()
    return (q ? tokenOptions.filter(t => t.toLowerCase().includes(q)) : tokenOptions).slice(0, 500)
  }, [tokenOptions, pairQuery])

  const { availableIntervals, interval, setInterval } = useIntervals({
    symbol: `${token}_${quote}`,
    market: 'futures'
  })

  // WebSocket for Stats in Header (selected pair)
  useEffect(() => {
    setStats(null)
    setLoadingStats(true)
    const ws = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/ws/futures-24h`)
    const sym = `${token}_${quote}`
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

  const available = (futuresAvailable as any)?.[quote] ?? '0'

  const fetchData = async () => {
    if (!isAuthed) return
    try {
      await refreshBalances();
    } catch { }
  }

  const [history, setHistory] = useState<any[]>([])

  const fetchHistory = async () => {
    if (!isAuthed) return
    try {
      const res = await fetch(`${API_BASE}/api/futures/history`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      })
      if (res.ok) setHistory(await res.json())
    } catch { }
  }

  useEffect(() => {
    fetchData()
    fetchHistory()
  }, [isAuthed])

  const placeOrder = async (side: 'long' | 'short') => {
    if (!isAuthed || !qty) return
    setLoadingOrder(side === 'long' ? 'buy' : 'sell')
    try {
      const res = await fetch(`${API_BASE}/api/futures/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          symbol: `${token}_${quote}`,
          side,
          type: orderType,
          quantity: qty,
          leverage,
          price: orderType === 'limit' ? limitPrice : undefined
        })
      })
      if (res.ok) {
        setQty('')
        fetchData()
        refreshBalances()
      } else {
        const j = await res.json()
        alert(j.error || 'Failed to place order')
      }
    } catch {
      alert('Network error')
    } finally {
      setLoadingOrder(null)
    }
  }

  const cancelOrder = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/futures/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      })
      if (res.ok) {
        fetchData()
        refreshBalances()
      }
      else {
        const j = await res.json()
        alert(j.error || 'Failed to cancel')
      }
    } catch { alert('Network error') }
  }

  const closePosition = async (symbol: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/futures/close-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ symbol })
      })
      if (res.ok) {
        fetchData()
        refreshBalances()
        fetchHistory()
      }
      else {
        const j = await res.json()
        alert(j.error || 'Failed to close')
      }
    } catch { alert('Network error') }
  }

  const renderTable = (data: any[], columns: string[], emptyMessage: string) => (
    <table className="w-full text-sm">
      <thead className="text-neutral-500">
        <tr className="text-left border-b">
          {columns.map(col => <th key={col} className="py-2 pr-3">{col}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td className="py-4 text-center text-neutral-400" colSpan={columns.length}>{emptyMessage}</td>
          </tr>
        ) : (
          data.map((item, idx) => (
            <tr key={item._id || idx} className="border-b last:border-0 hover:bg-neutral-50/50">
              {columns.map(col => {
                let val: any = '-'
                const c = col.toLowerCase()

                if (c === 'symbol') val = item.symbol
                else if (c === 'side') val = <Text size="xs" color={item.side === 'long' ? 'teal' : 'red'} fw={600} className="uppercase">{item.side}</Text>
                else if (c === 'size') val = Number(item.quantity).toFixed(4)
                else if (c === 'entry') val = item.entryPrice
                else if (c === 'exit') val = item.exitPrice
                else if (c === 'price') val = item.price
                else if (c === 'liq. price') val = <Text size="xs" color="orange" fw={600}>{item.liquidationPrice ? Number(item.liquidationPrice).toFixed(2) : '-'}</Text>
                else if (c === 'pnl' || c === 'realized pnl') {
                  // BUG FIX: Use the specific symbol's price from futuresStats, not just the page-level stats.
                  const itemStats = futuresStats.find(s => s.symbol === item.symbol)
                  const lastPrice = Number(itemStats?.lastPrice || 0)
                  const entryPrice = Number(item.entryPrice || 0)
                  const qty = Number(item.quantity || 0)
                  const margin = Number(item.margin || 0)

                  let pnlValue = item.realizedPnL
                  if (pnlValue === undefined && lastPrice > 0) {
                    pnlValue = item.side === 'long' ? (lastPrice - entryPrice) * qty : (entryPrice - lastPrice) * qty
                  }

                  if (pnlValue !== undefined) {
                    const roi = margin > 0 ? (pnlValue / margin) * 100 : 0
                    val = (
                      <div className="flex flex-col">
                        <Text size="xs" color={pnlValue >= 0 ? 'teal' : 'red'} fw={600}>
                          {pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)} {quote}
                        </Text>
                        <Text size="10px" color={pnlValue >= 0 ? 'teal' : 'red'}>
                          ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                        </Text>
                      </div>
                    )
                  }
                }
                else if (c === 'leverage') val = `${item.leverage}x`
                else if (c === 'status') val = item.status
                else if (c === 'time') val = new Date(item.createdAt || item.updatedAt || item.closedAt).toLocaleString()
                else if (c === 'action') {
                  if (columns.includes('PnL')) {
                    val = <Button size="compact-xs" color="red" variant="light" onClick={() => closePosition(item.symbol)}>Close</Button>
                  } else {
                    val = item.status === 'pending' ? <Button size="compact-xs" color="gray" variant="light" onClick={() => cancelOrder(item._id)}>Cancel</Button> : '-'
                  }
                }

                return <td key={col} className="py-2 pr-3">{val}</td>
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  return (
    <div className="grid gap-4">
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
              <Text size="sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Price: <BigPrice symbol={`${token}_${quote}`} market="futures" />
              </Text>
              <Text size="sm" c={(Number(stats?.change24h) || 0) >= 0 ? 'teal' : 'red'}>
                24h: {stats?.change24h != null ? `${Number(stats.change24h).toFixed(2)}%` : '-'}
              </Text>
              <Text size="sm">High: {stats?.high24h ?? '-'} Low: {stats?.low24h ?? '-'} Vol: {stats?.volume24h ? Number(stats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</Text>
            </>
          )}
        </Group>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-2">
              <PriceChart
                key={`${token}_${quote}-${interval}-futures`}
                symbol={`${token}_${quote}`}
                interval={interval}
                market="futures"
                orders={recentOrders.filter((o: any) => o.symbol === `${token}_${quote}` && o.status === 'pending')}
                positions={futuresPositions.filter((p: any) => p.symbol === `${token}_${quote}`)}
              />
            </div>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Order Book</div>
            <div className="p-0 h-[360px] overflow-y-auto text-sm">
              <OrderBook symbol={`${token}_${quote}`} market="futures" depth={50} />
            </div>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 2 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Trade</div>
            <div className="p-4 grid gap-3">
              <div className="text-xs text-neutral-500">Available: {available} {quote}</div>

              <div className="flex gap-1 p-1 bg-neutral-100 rounded">
                <Button size="xs" variant={orderType === 'market' ? 'filled' : 'subtle'} onClick={() => setOrderType('market')} className="flex-1">Market</Button>
                <Button size="xs" variant={orderType === 'limit' ? 'filled' : 'subtle'} onClick={() => setOrderType('limit')} className="flex-1">Limit</Button>
              </div>

              {orderType === 'limit' && (
                <TextInput label="Limit Price" placeholder="0.00" value={limitPrice} onChange={(e) => setLimitPrice(e.currentTarget.value)} size="xs" />
              )}

              <TextInput label="Quantity (USDT)" placeholder="0.00" value={qty} onChange={(e) => setQty(e.currentTarget.value)} size="xs" />

              <TextInput
                label="Leverage"
                value={leverage}
                onChange={(e) => {
                  const val = e.currentTarget.value.replace(/\D/g, '')
                  if (val === '' || (Number(val) >= 1 && Number(val) <= 100)) {
                    setLeverage(val)
                  }
                }}
                placeholder="10"
                size="xs"
                description="Max 100x"
              />

              <Group gap={4} grow>
                {['10', '20', '50', '100'].map(lv => (
                  <Button key={lv} size="compact-xs" variant="outline" color="gray" onClick={() => setLeverage(lv)}>
                    {lv}x
                  </Button>
                ))}
              </Group>

              <div className="flex gap-2">
                <Button className="flex-1" color="teal" loading={loadingOrder === 'buy'} onClick={() => placeOrder('long')} disabled={!isAuthed}>Buy / Long</Button>
                <Button className="flex-1" color="red" loading={loadingOrder === 'sell'} onClick={() => placeOrder('short')} disabled={!isAuthed}>Sell / Short</Button>
              </div>

              <Button variant="default" onClick={() => setTransferOpen(true)} disabled={!isAuthed}>Transfer</Button>
              {!isAuthed && <div className="text-xs text-neutral-500">Login to trade and see your balances.</div>}
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={12}>
          <Card radius="md" withBorder padding={0}>
            <Tabs defaultValue="positions" variant="outline">
              <Tabs.List className="px-3 pt-1">
                <Tabs.Tab value="positions">Positions</Tabs.Tab>
                <Tabs.Tab value="orders">Open Orders</Tabs.Tab>
                <Tabs.Tab value="history" onClick={fetchHistory}>History</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="positions" p="md">
                {renderTable(futuresPositions, ['Symbol', 'Side', 'Size', 'Entry', 'Liq. Price', 'PnL', 'Leverage', 'Action'], 'No active positions')}
              </Tabs.Panel>

              <Tabs.Panel value="orders" p="md">
                {renderTable(recentOrders.filter(o => o.symbol?.includes('_')), ['Symbol', 'Side', 'Size', 'Price', 'Status', 'Time', 'Action'], 'No recent orders')}
              </Tabs.Panel>

              <Tabs.Panel value="history" p="md">
                {renderTable(history, ['Symbol', 'Side', 'Size', 'Entry', 'Exit', 'Realized PnL', 'Time'], 'No history found')}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Grid.Col>
      </Grid>

      <TransferModal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentSide="futures"
        asset={quote as 'USDT' | 'USDC'}
        onTransferred={() => {
          refreshBalances()
          fetchData()
        }}
      />
    </div>
  )
}
