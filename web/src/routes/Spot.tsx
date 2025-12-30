import { Card, TextInput, Button, Grid, Menu, ScrollArea, Text, Loader, Tabs, Flex, Box, Group, Table } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, memo } from 'react'
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

const MemoizedTable = memo(({ data, columns, emptyMessage, showCancel, statsMap, quote, cancelOrder }: any) => {
  const formatDate = (date: string) => date ? new Date(date).toLocaleString() : '-'

  return (
    <Box style={{ height: '430px', overflowY: 'auto' }}>
      <Box style={{ overflowX: 'auto', flex: 1 }} px="xs">
        <Table verticalSpacing="xs" horizontalSpacing={4} highlightOnHover fs="sm" withRowBorders={false}>
          <Table.Thead bg="var(--bg-2)" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <Table.Tr>
              {columns.map((col: string) => <Table.Th key={col} c="dimmed" fw={600} py={10}>{col}</Table.Th>)}
              {showCancel && <Table.Th c="dimmed" fw={600} py={10}>Action</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody style={{ verticalAlign: 'middle' }}>
            {data.length === 0 ? (
              <Table.Tr>
                <Table.Td py={16} ta="center" c="dimmed" colSpan={columns.length + (showCancel ? 1 : 0)}>{emptyMessage}</Table.Td>
              </Table.Tr>
            ) : (
              data.map((item: any, index: number) => (
                <Table.Tr key={item.id || item._id || index}>
                  {columns.map((col: string) => {
                    let val: any = '-'
                    const c = col.toLowerCase()

                    const getVal = (v: any) => {
                      if (v && typeof v === 'object' && v.$numberDecimal) return v.$numberDecimal
                      return v
                    }

                    if (c === 'symbol') {
                      const cleanSymbol = item.symbol?.replace('_', '') || item.symbol
                      val = (
                        <Flex direction="column" lh={1.2} gap={0}>
                          <Text size="sm" fw={700}>{cleanSymbol}</Text>
                          {item.side && (
                            <Text size="xxs" color={item.side === 'buy' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                              {item.side}
                            </Text>
                          )}
                        </Flex>
                      )
                    }

                    else if (c === 'side') val = <Text size="xs" color={item.side === 'buy' ? 'var(--green)' : 'var(--red)'} fw={600} tt="uppercase">{item.side}</Text>
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
                        const pairStats = statsMap.get(`${asset}${quote}`)
                        const price = parseFloat(pairStats?.lastPrice || '0')
                        val = price > 0 ? `${(available * price).toFixed(2)} ${quote}` : '-'
                      }
                    }
                    else if (c === 'updated') val = formatDate(item.updatedAt)

                    return (
                      <Table.Td key={col}>
                        {val}
                      </Table.Td>
                    )
                  })}
                  {showCancel && (
                    <Table.Td>
                      <Button size="compact-xs" variant="light" color="var(--red)" onClick={() => cancelOrder(item.id)}>
                        Cancel
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  )
})

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
  const { orders, spotAvailable, refreshOrders, refreshBalances, positions } = useAccount()

  useEffect(() => setToken(initialBase), [initialBase])

  const statsMap = useMemo(() => new Map(spotStats.map(s => [s.symbol, s])), [spotStats])

  const tokenOptions = useMemo(() => {
    const list = spotStats.filter(t => t.symbol.endsWith(quote)).map(t => t.symbol.replace('_', '').replace(quote, ''))
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

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders])
  const available = (spotAvailable as any)?.[quote] ?? '0'
  const baseAvail = positions.find((r: any) => (r?.asset || '').toUpperCase() === token.toUpperCase())?.available ?? '0'

  return (
    <Box>
      <Flex align="center" gap="lg" py={4}>
        <Menu
          shadow="md"
          width={260}
          position="bottom-start"
          withinPortal
          trigger="hover"
          openDelay={0}
          closeDelay={50}
          transitionProps={{ transition: 'pop-top-left', duration: 150, timingFunction: 'ease' }}
          onOpen={() => listen('spot')}
          onClose={() => unlisten('spot')}
        >
          <Menu.Target>
            <Button variant="transparent" size="lg" h={56} px="xs" bg="transparent">
              <Flex direction="column" align="flex-start" lh={1.2}>
                <Text size="xl" fw={700}>{token}{quote}</Text>
                <Text size="xxs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.05em' }}>Spot</Text>
              </Flex>
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Box p="xs">
              <TextInput placeholder="Search pair" value={pairQuery} onChange={(e) => setPairQuery(e.currentTarget.value)} size="xs" />
            </Box>
            <ScrollArea.Autosize mah={320} mx={0} type="auto">
              {filteredOptions.map((t) => (
                <Menu.Item key={t} onClick={() => setToken(t)}>{t}/{quote}</Menu.Item>
              ))}
            </ScrollArea.Autosize>
          </Menu.Dropdown>
        </Menu>

        <Flex align="center" pl={24} style={{ borderLeft: '1px solid var(--mantine-color-default-border)' }}>
          {loadingStats ? <Loader size="xs" /> : (
            <Group gap={24}>
              <Box>
                <Box fs="1.25rem" fw={700}>
                  <BigPrice symbol={`${token}${quote}`} market="spot" />
                </Box>
              </Box>

              <Flex direction="column">
                <Text size="xs" c="dimmed" fw={600}>24h Change</Text>
                <Text size="xs" fw={500} color={(Number(stats?.change24h) || 0) >= 0 ? 'var(--green)' : 'var(--red)'}>
                  {stats?.change24h != null ? (Number(stats.change24h) >= 0 ? '+' : '') + `${Number(stats.change24h).toFixed(2)}%` : '-'}
                </Text>
              </Flex>

              <Flex direction="column">
                <Text size="xs" c="dimmed" fw={500}>24h High</Text>
                <Text size="xs" fw={600}>{stats?.high24h ?? '-'}</Text>
              </Flex>

              <Flex direction="column">
                <Text size="xs" c="dimmed" fw={500}>24h Low</Text>
                <Text size="xs" fw={600}>{stats?.low24h ?? '-'}</Text>
              </Flex>

              <Flex direction="column">
                <Text size="xs" c="dimmed" fw={500}>24h Volume</Text>
                <Text size="xs" fw={600}>
                  {stats?.volume24h ? Number(stats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                </Text>
              </Flex>
            </Group>
          )}
        </Flex>
      </Flex>

      <Grid gutter="md">
        {/* Left Side: Chart, OrderBook, and History Table */}
        <Grid.Col span={{ base: 12, lg: 10 }}>
          <Flex direction="column" gap="md">
            <Grid gutter="md" columns={10}>
              <Grid.Col span={{ base: 10, lg: 8 }}>
                <Card padding={0} radius="md" withBorder shadow="xs">
                  <PriceChart
                    onIntervalChange={setInterval}
                    availableIntervals={availableIntervals}
                    key={`${token}${quote}-${interval}-spot`}
                    symbol={`${token}${quote}`}
                    interval={interval}
                    height={630}
                    orders={orders.filter((o: any) => o.symbol === `${token}${quote}` && o.status === 'pending')}
                  />
                </Card>
              </Grid.Col>

              {/* OrderBook */}
              <Grid.Col span={{ base: 10, lg: 2 }}>
                <Card padding={0} radius="md" withBorder shadow="xs" h={630}>
                  <Box bg="var(--bg-2)" h={40} px="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center' }}>
                    <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Order Book</Text>
                  </Box>
                  <Box h={600} style={{ overflowY: 'auto' }}>
                    <OrderBook symbol={`${token}${quote}`} market="spot" depth={12} />
                  </Box>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Tables aligned to complete the sidebar pillar height */}
            <Card padding={0} withBorder radius="md" h={525} style={{ overflowY: 'auto' }} shadow="xs">
              <Tabs defaultValue="history" variant="outline">
                <Tabs.List pt={4} px={12}>
                  <Tabs.Tab value="history">Trade History</Tabs.Tab>
                  <Tabs.Tab value="pending">Open Orders</Tabs.Tab>
                  <Tabs.Tab value="positions">Assets</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="history" p={0}>
                  <MemoizedTable data={history} columns={['Symbol', 'Quantity', 'Price', 'Quote Amount', 'Time']} emptyMessage="No trade history" statsMap={statsMap} quote={quote} />
                </Tabs.Panel>

                <Tabs.Panel value="pending" p={0}>
                  <MemoizedTable data={pendingOrders} columns={['Symbol', 'Quantity', 'Price', 'Status', 'Time']} emptyMessage="No open orders" showCancel cancelOrder={cancelOrder} statsMap={statsMap} quote={quote} />
                </Tabs.Panel>

                <Tabs.Panel value="positions" p={0}>
                  <MemoizedTable data={positions} columns={['Asset', 'Available', 'Reserved', 'Value', 'Updated']} emptyMessage="No assets" statsMap={statsMap} quote={quote} />
                </Tabs.Panel>
              </Tabs>
            </Card>
          </Flex>
        </Grid.Col>

        {/* Right Side: Sidebar Trade Panel */}
        <Grid.Col span={{ base: 12, lg: 2 }}>
          <Card padding={0} withBorder radius="md" h={1171} style={{ overflowY: 'auto' }} shadow="xs">
            <Box bg="var(--bg-2)" h={40} px="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center' }}>
              <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Spot Trade</Text>
            </Box>
            <Flex direction="column" gap="md" p="md">
              <Group gap={4} p={4} style={{ background: 'var(--bg-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Button
                  size="xs"
                  variant={tradeSide === 'buy' ? 'filled' : 'subtle'}
                  color="var(--green)"
                  onClick={() => setTradeSide('buy')}
                  flex={1}
                >
                  Buy
                </Button>
                <Button
                  size="xs"
                  variant={tradeSide === 'sell' ? 'filled' : 'subtle'}
                  color="var(--red)"
                  onClick={() => setTradeSide('sell')}
                  flex={1}
                >
                  Sell
                </Button>
              </Group>

              <Group gap={4} p={4} style={{ background: 'var(--bg-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Button
                  size="xs"
                  variant={orderType === 'market' ? 'filled' : 'subtle'}
                  onClick={() => setOrderType('market')}
                  flex={1}
                >
                  Market
                </Button>
                <Button
                  size="xs"
                  variant={orderType === 'limit' ? 'filled' : 'subtle'}
                  onClick={() => setOrderType('limit')}
                  flex={1}
                >
                  Limit
                </Button>
              </Group>

              <Text size="xs" c="dimmed">
                Available: {tradeSide === 'buy' ? `${Number(available).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${quote} ` : `${Number(baseAvail).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token} `}
              </Text>

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

              <Flex gap="md">
                {tradeSide === 'buy' ? (
                  <Button
                    flex={1}
                    variant="filled"
                    color="var(--green)"
                    loading={placing === 'buy'}
                    disabled={!isAuthed}
                    onClick={() => placeOrder('buy')}
                  >
                    Buy {token}
                  </Button>
                ) : (
                  <Button
                    flex={1}
                    variant="filled"
                    color="var(--red)"
                    loading={placing === 'sell'}
                    disabled={!isAuthed}
                    onClick={() => placeOrder('sell')}
                  >
                    Sell {token}
                  </Button>
                )}
              </Flex>
              <Button variant="default" onClick={() => setTransferOpen(true)} disabled={!isAuthed}>Transfer</Button>
              <Button
                variant="filled"
                color="blue"
                radius="md"
                onClick={() => window.location.href = '/deposit'}
              >
                Deposit
              </Button>
              {!isAuthed && <Text size="xs" c="dimmed">Login to trade and see your balances.</Text>}
            </Flex>
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
    </Box>
  )
}