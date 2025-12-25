import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader, Tabs, SegmentedControl, Modal, NumberInput, Slider, Badge } from '@mantine/core'
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
import TradeSlider from '../components/TradeSlider'

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
  const [tradeMode, setTradeMode] = useState<'open' | 'close'>('open')
  const [percent, setPercent] = useState(0)
  const [openedLeverage, setOpenedLeverage] = useState(false)
  const [tempLeverage, setTempLeverage] = useState(leverage)

  const [tpslData, setTpslData] = useState<{ symbol: string; totalQty: number; tp?: number; tpQty?: number; sl?: number; slQty?: number } | null>(null)
  const [tpslPrices, setTpslPrices] = useState({ tp: '', sl: '', tpQty: '', slQty: '' })
  const [tpslPercents, setTpslPercents] = useState({ tp: 0, sl: 0 })

  const [partialCloseData, setPartialCloseData] = useState<{ symbol: string; totalQty: number } | null>(null)
  const [partialCloseQty, setPartialCloseQty] = useState('')
  const [partialClosePercent, setPartialClosePercent] = useState(0)

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

  // Sync quantity in "Open" mode when leverage or percent changes
  useEffect(() => {
    if (tradeMode === 'open' && percent > 0) {
      const max = parseFloat(available)
      const lev = Number(leverage || 1)
      const newQty = ((max * lev * percent) / 100).toFixed(8).replace(/\.?0+$/, '')
      if (newQty !== qty) setQty(newQty)
    }
  }, [percent, leverage, tradeMode, available])

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

  const closePosition = async (symbol: string, quantity?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/futures/close-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ symbol, quantity })
      })
      if (res.ok) {
        fetchData()
        refreshBalances()
        setPartialCloseData(null)
        fetchHistory()
      }
      else {
        const j = await res.json()
        alert(j.error || 'Failed to close')
      }
    } catch { alert('Network error') }
  }

  const updateTPSL = async (symbol: string, tp: string, sl: string, tpQty: string, slQty: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/futures/positions/tpsl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          symbol,
          tpPrice: tp || 0,
          slPrice: sl || 0,
          tpQuantity: tpQty || 0,
          slQuantity: slQty || 0
        })
      })
      if (res.ok) {
        refreshBalances() // This usually syncs everything
        setTpslData(null)
      } else {
        const j = await res.json()
        alert(j.error || 'Failed to update TP/SL')
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
                else if (c === 'liq. price') val = <Text size="xs" color="#e8590c" fw={600}>{item.liquidationPrice ? Number(item.liquidationPrice).toFixed(2) : '-'}</Text>
                else if (c === 'pnl') {
                  // Unrealized PnL (live calculation)
                  const itemStats = futuresStats.find(s => s.symbol === item.symbol)
                  const lastPrice = Number(itemStats?.lastPrice || 0)
                  const entryPrice = Number(item.entryPrice || 0)
                  const qty = Number(item.quantity || 0)
                  const margin = Number(item.margin || 0)

                  let pnlValue = 0
                  if (lastPrice > 0) {
                    pnlValue = item.side === 'long' ? (lastPrice - entryPrice) * qty : (entryPrice - lastPrice) * qty
                  }

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
                else if (c === 'realized pnl') {
                  // Realized PnL (from partial closes or history)
                  const realizedPnl = Number(item.realizedPnL || 0)
                  const margin = Number(item.margin || item.marginToRelease || 0)
                  const roi = margin > 0 ? (realizedPnl / margin) * 100 : 0

                  val = (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <Text size="xs" color={realizedPnl >= 0 ? '#0BBA74' : '#FF4761'} fw={600}>
                          {realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(2)} {quote}
                        </Text>
                        {item.note === 'Liquidated' && (
                          <Badge color="red" size="xs" variant="filled">LIQ</Badge>
                        )}
                      </div>
                      <Text size="10px" color={realizedPnl >= 0 ? '#0BBA74' : '#FF4761'}>
                        ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                      </Text>
                    </div>
                  )
                }
                else if (c === 'leverage') val = `${item.leverage}x`
                else if (c === 'margin') val = `${Number(item.margin || 0).toFixed(2)} ${quote}`
                else if (c === 'tp/sl') {
                  val = (
                    <div className="flex flex-col gap-0.5 min-w-[80px]">
                      <Text size="10px" color="teal" className="cursor-pointer hover:underline" onClick={() => {
                        setTpslData({ symbol: item.symbol, totalQty: Number(item.quantity), tp: item.tpPrice, tpQty: item.tpQuantity, sl: item.slPrice, slQty: item.slQuantity })
                        setTpslPrices({
                          tp: item.tpPrice > 0 ? String(item.tpPrice) : '',
                          sl: item.slPrice > 0 ? String(item.slPrice) : '',
                          tpQty: item.tpQuantity > 0 ? String(item.tpQuantity) : '',
                          slQty: item.slQuantity > 0 ? String(item.slQuantity) : ''
                        })
                        setTpslPercents({
                          tp: item.tpQuantity > 0 ? Math.round((item.tpQuantity / item.quantity) * 100) : 0,
                          sl: item.slQuantity > 0 ? Math.round((item.slQuantity / item.quantity) * 100) : 0
                        })
                      }}>
                        TP: {item.tpPrice > 0 ? item.tpPrice : '--'} {item.tpQuantity > 0 ? `(${Math.round((item.tpQuantity / item.quantity) * 100)}%)` : ''}
                      </Text>
                      <Text size="10px" color="red" className="cursor-pointer hover:underline" onClick={() => {
                        setTpslData({ symbol: item.symbol, totalQty: Number(item.quantity), tp: item.tpPrice, tpQty: item.tpQuantity, sl: item.slPrice, slQty: item.slQuantity })
                        setTpslPrices({
                          tp: item.tpPrice > 0 ? String(item.tpPrice) : '',
                          sl: item.slPrice > 0 ? String(item.slPrice) : '',
                          tpQty: item.tpQuantity > 0 ? String(item.tpQuantity) : '',
                          slQty: item.slQuantity > 0 ? String(item.slQuantity) : ''
                        })
                        setTpslPercents({
                          tp: item.tpQuantity > 0 ? Math.round((item.tpQuantity / item.quantity) * 100) : 0,
                          sl: item.slQuantity > 0 ? Math.round((item.slQuantity / item.quantity) * 100) : 0
                        })
                      }}>
                        SL: {item.slPrice > 0 ? item.slPrice : '--'} {item.slQuantity > 0 ? `(${Math.round((item.slQuantity / item.quantity) * 100)}%)` : ''}
                      </Text>
                    </div>
                  )
                }
                else if (c === 'status') val = item.status
                else if (c === 'time') val = new Date(item.createdAt || item.updatedAt || item.closedAt).toLocaleString()
                else if (c === 'action') {
                  if (columns.includes('PnL')) {
                    val = <Button size="compact-xs" color="red" variant="light" onClick={() => setPartialCloseData({ symbol: item.symbol, totalQty: Number(item.quantity) })}>Close</Button>
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
              <Text size="sm" c={(Number(stats?.change24h) || 0) >= 0 ? 'teal' : '#FF4761'}>
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
                onClosePosition={(pos) => setPartialCloseData({ symbol: pos.symbol, totalQty: Number(pos.quantity) })}
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
              <SegmentedControl
                value={tradeMode}
                onChange={(val) => setTradeMode(val as 'open' | 'close')}
                data={[
                  { label: 'Open', value: 'open' },
                  { label: 'Close', value: 'close' },
                ]}
                size="xs"
                color="blue"
              />

              {tradeMode === 'open' ? (
                <div className="text-xs text-neutral-500">Available: {Number(available).toLocaleString(undefined, { maximumFractionDigits: 4 })} {quote}</div>
              ) : (
                <div className="text-xs text-neutral-500">
                  Position Available: {
                    (() => {
                      const pos = futuresPositions.find(p => p.symbol === `${token}_${quote}`)
                      return pos ? `${Number(pos.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token}` : `0 ${token}`
                    })()
                  }
                </div>
              )}

              <div className="flex gap-1 p-1 bg-neutral-100 rounded">
                <Button size="xs" variant={orderType === 'market' ? 'filled' : 'subtle'} onClick={() => setOrderType('market')} className="flex-1">Market</Button>
                <Button size="xs" variant={orderType === 'limit' ? 'filled' : 'subtle'} onClick={() => setOrderType('limit')} className="flex-1">Limit</Button>
              </div>

              {orderType === 'limit' && (
                <TextInput label="Limit Price" placeholder="0.00" value={limitPrice} onChange={(e) => setLimitPrice(e.currentTarget.value)} size="xs" />
              )}

              <TextInput
                label={tradeMode === 'open' ? "Quantity (USDT)" : `Quantity (${token})`}
                placeholder="0.00"
                value={qty}
                onChange={(e) => setQty(e.currentTarget.value)}
                size="xs"
              />

              <TradeSlider
                value={percent}
                onChange={(val) => {
                  setPercent(val)
                  if (tradeMode === 'close') {
                    const pos = futuresPositions.find(p => p.symbol === `${token}_${quote}`)
                    if (pos) {
                      if (val === 100) {
                        setQty(pos.quantity.toString())
                      } else {
                        setQty(((pos.quantity * val) / 100).toFixed(8).replace(/\.?0+$/, ''))
                      }
                    }
                  }
                }}
              />

              {tradeMode === 'open' && (
                <>
                  <Button
                    variant="default"
                    fullWidth
                    size="sm"
                    justify="space-between"
                    onClick={() => {
                      setTempLeverage(leverage)
                      setOpenedLeverage(true)
                    }}
                    rightSection={<Text size="xs" c="dimmed">Isolated</Text>}
                  >
                    {leverage}x
                  </Button>

                  <Modal
                    opened={openedLeverage}
                    onClose={() => setOpenedLeverage(false)}
                    title="Adjust Leverage"
                    centered
                    size="xs"
                  >
                    <div className="flex flex-col gap-6">
                      <NumberInput
                        label="Leverage"
                        value={Number(tempLeverage)}
                        onChange={(val) => setTempLeverage(String(val))}
                        max={500}
                        min={1}
                        size="md"
                        suffix="x"
                      />

                      <Group gap={4} grow>
                        {['10', '20', '50', '100', '500'].map(lv => (
                          <Button
                            key={lv}
                            size="compact-sm"
                            variant={tempLeverage === lv ? "filled" : "outline"}
                            color={tempLeverage === lv ? "blue" : "gray"}
                            onClick={() => setTempLeverage(lv)}
                          >
                            {lv}x
                          </Button>
                        ))}
                      </Group>

                      <Slider
                        value={Number(tempLeverage)}
                        onChange={(val) => setTempLeverage(String(val))}
                        max={500}
                        min={1}
                        step={1}
                        label={(val) => `${val}x`}
                        marks={[
                          { value: 1, label: '1x' },
                          { value: 250, label: '250x' },
                          { value: 500, label: '500x' },
                        ]}
                        mb="xl"
                      />

                      <Group grow mt="md">
                        <Button variant="light" color="gray" onClick={() => setOpenedLeverage(false)}>
                          Cancel
                        </Button>
                        <Button color="blue" onClick={() => {
                          setLeverage(tempLeverage)
                          setOpenedLeverage(false)
                        }}>
                          Confirm
                        </Button>
                      </Group>
                    </div>
                  </Modal>
                </>
              )}

              <div className="flex gap-2">
                {tradeMode === 'open' ? (
                  <>
                    <Button className="flex-1" color="teal" loading={loadingOrder === 'buy'} onClick={() => placeOrder('long')} disabled={!isAuthed}>Buy / Long</Button>
                    <Button className="flex-1" color="red" loading={loadingOrder === 'sell'} onClick={() => placeOrder('short')} disabled={!isAuthed}>Sell / Short</Button>
                  </>
                ) : (
                  <Button
                    className="flex-1"
                    color="red"
                    variant="filled"
                    onClick={() => closePosition(`${token}_${quote}`, qty)}
                    disabled={!isAuthed || !qty}
                  >
                    Close Position
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
            <Tabs defaultValue="positions" variant="outline">
              <Tabs.List className="px-3 pt-1">
                <Tabs.Tab value="positions">Positions</Tabs.Tab>
                <Tabs.Tab value="orders">Open Orders</Tabs.Tab>
                <Tabs.Tab value="history" onClick={fetchHistory}>History</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="positions" p="md">
                {renderTable(futuresPositions, ['Symbol', 'Side', 'Size', 'Entry', 'Margin', 'Liq. Price', 'PnL', 'Realized PnL', 'TP/SL', 'Leverage', 'Action'], 'No active positions')}
              </Tabs.Panel>

              <Tabs.Panel value="orders" p="md">
                {renderTable(recentOrders.filter(o => o.symbol?.includes('_')), ['Symbol', 'Side', 'Size', 'Price', 'Status', 'Time', 'Action'], 'No recent orders')}
              </Tabs.Panel>

              <Tabs.Panel value="history" p="md">
                {renderTable(history, ['Symbol', 'Side', 'Size', 'Entry', 'Exit', 'Realized PnL', 'Time'], 'No trade history')}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Grid.Col>
      </Grid>

      <Modal
        opened={!!partialCloseData}
        onClose={() => setPartialCloseData(null)}
        title={`Close Position: ${partialCloseData?.symbol}`}
        centered
        size="sm"
      >
        <div className="grid gap-4 py-2">
          <div className="text-sm text-neutral-500">
            Available to close: <span className="font-semibold text-neutral-800">{partialCloseData?.totalQty}</span>
          </div>

          <TextInput
            label="Quantity to Close"
            placeholder="0.00"
            value={partialCloseQty}
            onChange={(e) => setPartialCloseQty(e.currentTarget.value)}
            rightSection={<Text size="xs" c="dimmed" pr="md">{token}</Text>}
          />

          <TradeSlider
            value={partialClosePercent}
            onChange={(val) => {
              setPartialClosePercent(val)
              if (partialCloseData) {
                if (val === 100) {
                  setPartialCloseQty(partialCloseData.totalQty.toString())
                } else {
                  setPartialCloseQty(((partialCloseData.totalQty * val) / 100).toFixed(8).replace(/\.?0+$/, ''))
                }
              }
            }}
          />

          <Button
            color="red"
            fullWidth
            onClick={() => closePosition(partialCloseData!.symbol, partialCloseQty)}
            disabled={!partialCloseQty || parseFloat(partialCloseQty) <= 0}
          >
            Confirm Close
          </Button>
        </div>
      </Modal>

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

      <Modal opened={!!tpslData} onClose={() => setTpslData(null)} title={`TP/SL Settings - ${tpslData?.symbol}`} centered size="sm">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 p-3 border rounded-md bg-neutral-50/50">
            <Text size="sm" fw={600} color="teal">Take Profit (TP)</Text>
            <TextInput
              label="Trigger Price"
              placeholder="0.00"
              value={tpslPrices.tp}
              onChange={(e) => setTpslPrices({ ...tpslPrices, tp: e.currentTarget.value })}
            />
            <TextInput
              label="Quantity to Close"
              placeholder="All"
              value={tpslPrices.tpQty}
              onChange={(e) => setTpslPrices({ ...tpslPrices, tpQty: e.currentTarget.value })}
            />
            <TradeSlider
              value={tpslPercents.tp}
              onChange={(val) => {
                setTpslPercents({ ...tpslPercents, tp: val })
                const q = val === 100 ? tpslData!.totalQty : (tpslData!.totalQty * val) / 100
                setTpslPrices({ ...tpslPrices, tpQty: q > 0 ? q.toFixed(8).replace(/\.?0+$/, '') : '' })
              }}
            />
          </div>

          <div className="grid gap-4 p-3 border rounded-md bg-neutral-50/50">
            <Text size="sm" fw={600} color="red">Stop Loss (SL)</Text>
            <TextInput
              label="Trigger Price"
              placeholder="0.00"
              value={tpslPrices.sl}
              onChange={(e) => setTpslPrices({ ...tpslPrices, sl: e.currentTarget.value })}
            />
            <TextInput
              label="Quantity to Close"
              placeholder="All"
              value={tpslPrices.slQty}
              onChange={(e) => setTpslPrices({ ...tpslPrices, slQty: e.currentTarget.value })}
            />
            <TradeSlider
              value={tpslPercents.sl}
              onChange={(val) => {
                setTpslPercents({ ...tpslPercents, sl: val })
                const q = val === 100 ? tpslData!.totalQty : (tpslData!.totalQty * val) / 100
                setTpslPrices({ ...tpslPrices, slQty: q > 0 ? q.toFixed(8).replace(/\.?0+$/, '') : '' })
              }}
            />
          </div>

          <Group grow mt="md">
            <Button variant="light" color="gray" onClick={() => setTpslData(null)}>Cancel</Button>
            <Button color="blue" onClick={() => updateTPSL(tpslData!.symbol, tpslPrices.tp, tpslPrices.sl, tpslPrices.tpQty, tpslPrices.slQty)}>Save TP/SL</Button>
          </Group>
        </div>
      </Modal>
    </div>
  )
}
