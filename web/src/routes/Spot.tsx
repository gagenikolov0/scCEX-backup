
import { Card, TextInput, Button, Grid, Menu, ScrollArea, Text, Loader, Tabs } from '@mantine/core'
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
import BigPrice from '../components/BigPrice'
import TradeSlider from '../components/TradeSlider'

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
  const [percent, setPercent] = useState(0)

  const { spotStats, listen, unlisten } = useMarket()
  const { positions, orders, spotAvailable, refreshOrders, refreshBalances } = useAccount()

  useEffect(() => {
    listen()
    return () => unlisten()
  }, [])

  useEffect(() => setToken(initialBase), [initialBase])

  const tokenOptions = useMemo(() => {
    const list = spotStats.filter(t => t.symbol.endsWith(quote)).map(t => t.symbol.replace(quote, ''))
    return Array.from(new Set(list))
  }, [spotStats, quote])

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

  // For Spot Header (selected pair)
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

  // Necessary HTTP Post server 
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
    if (isAuthed) fetchHistory()
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

                const getVal = (v: any) => {
                  if (v && typeof v === 'object' && v.$numberDecimal) return v.$numberDecimal
                  return v
                }

                if (c === 'symbol') {
                  const cleanSymbol = item.symbol?.replace('_', '') || item.symbol
                  val = (
                    <div className="flex flex-col leading-tight">
                      <Text size="xs" fw={700}>{cleanSymbol}</Text>
                      {item.side && (
                        <Text size="10px" color={item.side === 'buy' ? '#0bba74' : '#ff4761'} fw={700} className="uppercase">
                          {item.side}
                        </Text>
                      )}
                    </div>
                  )
                }

                else if (c === 'side') val = <Text size="xs" color={item.side === 'buy' ? '#0bba74' : '#ff4761'} fw={600} className="uppercase">{item.side}</Text>
                else if (c === 'quantity' || c === 'size') val = Number(getVal(item.quantity || item.quantityBase || 0)).toFixed(4)
                else if (c === 'price') val = getVal(item.price || item.priceQuote)
                else if (c === 'total' || c === 'quote amount') {
                  const t = getVal(item.total || item.quoteAmount)
                  val = t ? `${Number(t).toFixed(2)} ${quote} ` : '-'
                }
                else if (c === 'status') val = item.status
                else if (c === 'time' || c === 'closed at') val = formatDate(item.createdAt || item.closedAt)
                else if (c === 'asset') val = item.asset
                else if (c === 'available') val = getVal(item.available)
                else if (c === 'reserved') val = getVal(item.reserved)
                else if (c === 'value') {
                  const asset = item.asset
                  const available = parseFloat(getVal(item.available) || '0')
                  if (asset === 'USDT' || asset === 'USDC') {
                    val = `${available.toFixed(2)} ${quote}`
                  } else {
                    const pairStats = spotStats.find(s => s.symbol === `${asset}${quote}`)
                    const price = parseFloat(pairStats?.lastPrice || '0')
                    val = price > 0 ? `${(available * price).toFixed(2)} ${quote}` : '-'
                  }
                }
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

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-6 py-2">
        <Menu shadow="md" width={260} position="bottom-start" withinPortal trigger="hover" openDelay={100} closeDelay={200} transitionProps={{ transition: 'pop-top-left', duration: 200, timingFunction: 'ease' }}>
          <Menu.Target>
            <Button variant="transparent" size="lg" className="h-14 px-2 !bg-transparent hover:!bg-transparent focus:!bg-transparent active:!bg-transparent data-[expanded]:!bg-transparent active:scale-100">
              <div className="flex flex-col items-start leading-tight">
                <div className="text-xl font-bold tracking-tight asset-selector-text">{token}{quote}</div>
                <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Spot</div>
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

        <div className="flex items-center w-fit header-divider">
          {loadingStats ? <Loader size="xs" /> : (
            <>
              <div style={{ marginRight: '24px' }} className="flex flex-col">
                <Text size="xs" c="dimmed" fw={500}></Text>
                <div className="text-lg font-bold">
                  <BigPrice symbol={`${token}${quote}`} market="spot" />
                </div>
              </div>

              <div style={{ marginRight: '24px' }} className="flex flex-col">
                <Text size="xs" c="dimmed" fw={500}>24h change</Text>
                <Text style={{ fontSize: '12px' }} fw={500} c={(Number(stats?.change24h) || 0) >= 0 ? '#0bba74' : '#FF4761'}>
                  {stats?.change24h != null ? (Number(stats.change24h) >= 0 ? '+' : '') + `${Number(stats.change24h).toFixed(2)}%` : '-'}
                </Text>
              </div>

              <div style={{ marginRight: '24px' }} className="flex flex-col">
                <Text size="xs" c="dimmed" fw={500}>24h high</Text>
                <Text style={{ fontSize: '12px' }} fw={600}>{stats?.high24h ?? '-'}</Text> {/* Should be white color in dark mode, full FFF color */}
              </div>

              <div style={{ marginRight: '24px' }} className="flex flex-col">
                <Text size="xs" c="dimmed" fw={500}>24h low</Text>
                <Text style={{ fontSize: '12px' }} fw={600}>{stats?.low24h ?? '-'}</Text> {/* Should be white color in dark mode, full FFF color */}
              </div>

              <div className="flex flex-col">
                <Text size="xs" c="dimmed" fw={500}>24h volume</Text>
                <Text style={{ fontSize: '12px' }} fw={600}> {/* Should be white color in dark mode, full FFF color */}
                  {stats?.volume24h ? Number(stats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                </Text>
              </div>
            </>
          )}
        </div>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card padding={0} radius="md" withBorder>
            <PriceChart
              onIntervalChange={setInterval}
              availableIntervals={availableIntervals}
              key={`${token}${quote}-${interval}-spot`}
              symbol={`${token}${quote}`}
              interval={interval}
              orders={orders.filter((o: any) => o.symbol === `${token}${quote}` && o.status === 'pending')}
            />
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
            <div className="p-3 border-b text-sm font-medium">Spot</div>
            <div className="p-4 grid gap-3">
              <div className="flex gap-1 p-1 bg-neutral-100 rounded">
                <Button
                  size="xs"
                  variant={tradeSide === 'buy' ? 'filled' : 'subtle'}
                  color="#0bba74"
                  onClick={() => setTradeSide('buy')}
                  className="flex-1"
                >
                  Buy
                </Button>
                <Button
                  size="xs"
                  variant={tradeSide === 'sell' ? 'filled' : 'subtle'}
                  color="#ff4761"
                  onClick={() => setTradeSide('sell')}
                  className="flex-1"
                >
                  Sell
                </Button>
              </div>

              <div className="text-xs text-neutral-500">
                Available: {tradeSide === 'buy' ? `${Number(available).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${quote} ` : `${Number(baseAvail).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token} `}
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

              <TextInput
                label="Quantity"
                placeholder="0.00"
                value={qty}
                onChange={(e) => setQty(e.currentTarget.value)}
                size="xs"
                rightSection={<Text size="xs" c="dimmed" pr="md">{token}</Text>}
              />

              <TradeSlider
                value={percent}
                onChange={(val) => {
                  setPercent(val)
                  if (tradeSide === 'buy') {
                    const bal = parseFloat(spotAvailable[quote as keyof typeof spotAvailable] || '0')
                    const p = parseFloat(price) || parseFloat(stats?.lastPrice || '0')
                    if (p > 0) {
                      setQty(((bal * val / 100) / p).toFixed(8).replace(/\.?0+$/, ''))
                    }
                  } else {
                    const pos = positions.find(p => p.asset === token)
                    const bal = parseFloat(pos?.available || '0')
                    if (val === 100) {
                      setQty(bal.toString())
                    } else {
                      setQty((bal * val / 100).toFixed(8).replace(/\.?0+$/, ''))
                    }
                  }
                }}
              />

              <div className="flex gap-2">
                {tradeSide === 'buy' ? (
                  <Button
                    className="flex-1"
                    variant="filled"
                    color="#0bba74"
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
                    color="#ff4761"
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

      <Grid gutter="md">
        <Grid.Col span={12}>
          <Card radius="md" withBorder padding={0}>
            <Tabs defaultValue="history" variant="outline">
              <Tabs.List className="px-3 pt-1">
                <Tabs.Tab value="history">Trade History</Tabs.Tab>
                <Tabs.Tab value="pending">Open Orders</Tabs.Tab>
                <Tabs.Tab value="positions">Assets</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="history" p="md">
                {renderTable(history, ['Symbol', 'Quantity', 'Price', 'Quote Amount', 'Time'], 'No trade history')}
              </Tabs.Panel>

              <Tabs.Panel value="pending" p="md">
                {renderTable(pendingOrders, ['Symbol', 'Quantity', 'Price', 'Status', 'Time'], 'No open orders', true)}
              </Tabs.Panel>

              <Tabs.Panel value="positions" p="md">
                {renderTable(positions, ['Asset', 'Available', 'Reserved', 'Value', 'Updated'], 'No assets')}
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