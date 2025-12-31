import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader, Tabs, Modal, NumberInput, Slider, Badge, Flex, Box, Stack, Table, Tooltip } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, memo } from 'react'
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

const MemoizedTable = memo(({ data, columns, emptyMessage, statsMap, quote, onAction, onTpsl }: any) => {
  return (
    <Box style={{ height: '430px', overflowY: 'auto' }}>
      <Box style={{ overflowX: 'auto', flex: 1 }} px="xs">
        <Table verticalSpacing="xs" horizontalSpacing={4} highlightOnHover fs="sm" withRowBorders={false}>
          <Table.Thead bg="var(--bg-2)" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <Table.Tr>
              {columns.map((col: any) => {
                const label = typeof col === 'string' ? col : col.label
                return (
                  <Table.Th key={label} c="dimmed" fw={600} style={{ whiteSpace: 'nowrap' }} py={10}>
                    {label}
                  </Table.Th>
                )
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody style={{ verticalAlign: 'middle' }}>
            {data.length === 0 ? (
              <Table.Tr>
                <Table.Td py={16} ta="center" c="dimmed" colSpan={columns.length}>
                  {emptyMessage}
                </Table.Td>
              </Table.Tr>
            ) : (
              data.map((item: any, idx: number) => (
                <Table.Tr key={item._id || idx}>
                  {columns.map((column: any) => {
                    let val: any = '-'
                    const key = typeof column === 'string' ? column : column.key
                    const c = key.toLowerCase()

                    if (c === 'symbol') {
                      const cleanSymbol = item.symbol?.replace('_', '') || item.symbol
                      val = (
                        <Flex direction="column" lh={1.2} gap={0}>
                          <Text size="sm" fw={700}>{cleanSymbol}</Text>
                          {(item.leverage || item.side) && (
                            <Group gap={2}>
                              {item.leverage && <Text size="xxs" c="dimmed" fw={500}>{item.leverage}x</Text>}
                              {item.side && (
                                <Text size="xxs" color={item.side === 'long' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                                  {item.side}
                                </Text>
                              )}
                            </Group>
                          )}
                        </Flex>
                      )
                    }
                    else if (c === 'side') val = <Text size="xs" color={item.side === 'long' ? 'var(--green)' : 'var(--red)'} fw={600} tt="uppercase">{item.side}</Text>
                    else if (c === 'size') val = Number(item.quantity).toFixed(4)
                    else if (c === 'entry') val = item.entryPrice
                    else if (c === 'exit') val = item.exitPrice
                    else if (c === 'price') val = item.price
                    else if (c === 'liq. price') val = <Text size="sm" c="var(--liq)" fw={600}>{item.liquidationPrice ? Number(item.liquidationPrice).toFixed(2) : '-'}</Text>
                    else if (c === 'pnl') {
                      const itemStats = statsMap.get(item.symbol)
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
                        <Flex direction="column" lh={1.2}>
                          <Text size="xs" color={pnlValue >= 0 ? 'var(--green)' : 'var(--red)'} fw={600}>
                            {pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)} {quote}
                          </Text>
                          <Text size="xxs" color={pnlValue >= 0 ? 'var(--green)' : 'var(--red)'}>
                            ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                          </Text>
                        </Flex>
                      )
                    }
                    else if (c === 'realized pnl') {
                      const realizedPnl = Number(item.realizedPnL || 0)
                      const margin = Number(item.margin || item.marginToRelease || 0)
                      const roi = margin > 0 ? (realizedPnl / margin) * 100 : 0

                      val = (
                        <Flex direction="column" lh={1.2}>
                          <Group gap={4}>
                            <Text size="xs" color={realizedPnl >= 0 ? 'var(--green)' : 'var(--red)'} fw={600}>
                              {realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(2)} {quote}
                            </Text>
                            {item.note === 'Liquidated' && (
                              <Tooltip label={`Liquidated at ${item.exitPrice}`}>
                                <Badge color="var(--red)" size="xs" variant="filled" onMouseEnter={() => console.log('LIQ Item:', item)}>LIQ</Badge>
                              </Tooltip>
                            )}
                          </Group>
                          <Text size="xxs" color={realizedPnl >= 0 ? 'var(--green)' : 'var(--red)'}>
                            ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                          </Text>
                        </Flex>
                      )
                    }
                    else if (c === 'leverage') val = `${item.leverage}x`
                    else if (c === 'margin') val = `${Number(item.margin || 0).toFixed(2)} ${quote}`
                    else if (c === 'tp/sl') {
                      val = (
                        <Flex direction="column" gap={2} lh={1}>
                          <Text size="xxs" color="var(--green)" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onTpsl(item)}>
                            TP: {item.tpPrice > 0 ? item.tpPrice : '--'} {item.tpQuantity > 0 ? `(${Math.round((item.tpQuantity / item.quantity) * 100)}%)` : ''}
                          </Text>
                          <Text size="xxs" color="var(--red)" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onTpsl(item)}>
                            SL: {item.slPrice > 0 ? item.slPrice : '--'} {item.slQuantity > 0 ? `(${Math.round((item.slQuantity / item.quantity) * 100)}%)` : ''}
                          </Text>
                        </Flex>
                      )
                    }
                    else if (c === 'status') val = item.status
                    else if (c === 'time') val = new Date(item.createdAt || item.updatedAt || item.closedAt).toLocaleString()
                    else if (c === 'action') {
                      const isPosTable = columns.some((col: any) => {
                        const k = typeof col === 'string' ? col : col.key
                        return k.toLowerCase() === 'pnl'
                      })
                      if (isPosTable) {
                        val = <Button size="compact-xs" color="#fe445c" variant="light" onClick={() => onAction(item)}>Close</Button>
                      } else {
                        val = item.status === 'pending' ? <Button size="compact-xs" color="gray" variant="light" onClick={() => onAction(item)}>Cancel</Button> : '-'
                      }
                    }

                    return (
                      <Table.Td key={typeof column === 'string' ? column : column.label}>
                        {val}
                      </Table.Td>
                    )
                  })}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </Box>
  )
})

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
  const statsMap = useMemo(() => new Map(futuresStats.map(s => [s.symbol, s])), [futuresStats])

  const [qty, setQty] = useState('')
  const [leverage, setLeverage] = useState('10')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [loadingOrder, setLoadingOrder] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [tradeMode, setTradeMode] = useState<'open' | 'close'>('open')
  const [percent, setPercent] = useState(0)
  const [openedLeverage, setOpenedLeverage] = useState(false)
  const [tempLeverage, setTempLeverage] = useState('10')
  const [partialCloseData, setPartialCloseData] = useState<any | null>(null)
  const [partialCloseQty, setPartialCloseQty] = useState('')
  const [partialClosePercent, setPartialClosePercent] = useState(0)
  const [tpslData, setTpslData] = useState<any | null>(null)
  const [tpslPrices, setTpslPrices] = useState({ tp: '', sl: '', tpQty: '', slQty: '' })
  const [tpslPercents, setTpslPercents] = useState({ tp: 0, sl: 0 })

  const tokenOptions = useMemo(() => {
    const list = futuresStats
      .filter(r => typeof r.symbol === 'string' && r.symbol.endsWith(quote))
      .map(r => r.symbol.replace('_', '').replace(quote, ''))
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

  useEffect(() => {
    listen('futures')
    return () => unlisten('futures')
  }, [listen, unlisten])

  // For Futures Header (selected pair)
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
    fetchHistory()
  }, [isAuthed])

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
        refreshBalances()
        setTpslData(null)
      } else {
        const j = await res.json()
        alert(j.error || 'Failed to update TP/SL')
      }
    } catch { alert('Network error') }
  }

  const handleTpslClick = (item: any) => {
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
  }

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
          transitionProps={{ transition: 'pop-top-left', duration: 0, timingFunction: 'ease' }}
        >
          <Menu.Target>
            <Button variant="transparent" size="lg" h={56} px="xs" bg="transparent">
              <Flex direction="column" align="flex-start" lh={1.2}>
                <Text size="xl" fw={700}>{token}{quote}</Text>
                <Text size="xxs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.05em' }}>Perpetual</Text>
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

        <Flex align="center" style={{ borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: '24px' }}>
          {loadingStats ? <Loader size="xs" /> : (
            <Group gap={24}>
              <Box>
                <Box fs="1.25rem" fw={700}>
                  <BigPrice symbol={`${token}${quote}`} market="futures" />
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
                    key={`${token}_${quote}-${interval}-futures`}
                    symbol={`${token}_${quote}`}
                    interval={interval}
                    height={630}
                    market="futures"
                    orders={recentOrders.filter((o: any) => o.symbol === `${token}_${quote}` && o.status === 'pending')}
                    positions={futuresPositions.filter((p: any) => p.symbol === `${token}_${quote}`)}
                    onClosePosition={(pos) => setPartialCloseData({ symbol: pos.symbol, totalQty: Number(pos.quantity) })}
                    onIntervalChange={setInterval}
                    availableIntervals={availableIntervals}
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
                    <OrderBook symbol={`${token}_${quote}`} market="futures" depth={12} />
                  </Box>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Tables aligned to complete the sidebar pillar height */}
            <Card padding={0} withBorder radius="md" h={525} style={{ overflowY: 'auto' }} shadow="xs">
              <Tabs defaultValue="positions" variant="pills" radius="md">
                <Tabs.List pt={4} px={4}>
                  <Tabs.Tab value="positions">Positions</Tabs.Tab>
                  <Tabs.Tab value="orders">Open Orders</Tabs.Tab>
                  <Tabs.Tab value="history" onClick={fetchHistory}>Position History</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="positions" p={0}>
                  <MemoizedTable
                    data={futuresPositions}
                    columns={[
                      { label: 'Trading Pair', key: 'Symbol' },
                      { label: 'Size (Qty)', key: 'Size' },
                      { label: 'Avg Entry Price', key: 'Entry' },
                      'Margin',
                      'Liq. Price',
                      { label: 'Unrealized PNL', key: 'PnL' },
                      { label: 'Realized PNL', key: 'Realized PnL' },
                      'TP/SL',
                      { label: 'Close', key: 'Action' }
                    ]}
                    emptyMessage="No active positions"
                    statsMap={statsMap}
                    quote={quote}
                    onAction={(item: any) => setPartialCloseData({ symbol: item.symbol, totalQty: Number(item.quantity) })}
                    onTpsl={handleTpslClick}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="orders" p={0}>
                  <MemoizedTable
                    data={recentOrders.filter(o => o.symbol?.includes('_'))}
                    columns={['Symbol', 'Size', 'Price', 'Status', 'Time', 'Action']}
                    emptyMessage="No recent orders"
                    statsMap={statsMap}
                    quote={quote}
                    onAction={(item: any) => cancelOrder(item._id)}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="history" p={0}>
                  <MemoizedTable
                    data={history}
                    columns={['Symbol', 'Size', 'Entry', 'Exit', 'Realized PnL', 'Time']}
                    emptyMessage="No trade history"
                    statsMap={statsMap}
                    quote={quote}
                  />
                </Tabs.Panel>
              </Tabs>
            </Card>
          </Flex>
        </Grid.Col>

        {/* Right Side: Sidebar Trade Panel */}
        <Grid.Col span={{ base: 12, lg: 2 }}>
          <Card padding={0} withBorder radius="md" h={1171} style={{ overflowY: 'auto' }} shadow="xs">
            <Box bg="var(--bg-2)" h={40} px="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center' }}>
              <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Futures Trade</Text>
            </Box>
            <Flex direction="column" gap="md" p="md">
              <Tabs value={tradeMode} onChange={(val) => setTradeMode(val as 'open' | 'close')} variant="pills" radius="md" color="blue">
                <Tabs.List grow>
                  <Tabs.Tab value="open">Open</Tabs.Tab>
                  <Tabs.Tab value="close">Close</Tabs.Tab>
                </Tabs.List>
              </Tabs>

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
                    lockScroll={false}
                  >
                    <Stack gap="md">
                      <NumberInput
                        label="Leverage"
                        value={Number(tempLeverage)}
                        onChange={(val) => setTempLeverage(String(val))}
                        max={500}
                        min={1}
                        size="md"
                        suffix="x"
                      />

                      <Group gap="xs">
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
                    </Stack>
                  </Modal>
                </>
              )}

              <Tabs value={orderType} onChange={(v) => setOrderType(v as 'market' | 'limit')} variant="pills" radius="md">
                <Tabs.List grow>
                  <Tabs.Tab value="market">Market</Tabs.Tab>
                  <Tabs.Tab value="limit">Limit</Tabs.Tab>
                </Tabs.List>
              </Tabs>

              {orderType === 'limit' && (
                <TextInput label="Limit Price" placeholder="0.00" value={limitPrice} onChange={(e) => setLimitPrice(e.currentTarget.value)} size="xs" />
              )}

              {tradeMode === 'open' ? (
                <Text size="xs" c="dimmed">Available: {Number(available).toLocaleString(undefined, { maximumFractionDigits: 4 })} {quote}</Text>
              ) : (
                <Text size="xs" c="dimmed">
                  Position Available: {
                    (() => {
                      const pos = futuresPositions.find(p => p.symbol === `${token}_${quote}`)
                      return pos ? `${Number(pos.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token}` : `0 ${token}`
                    })()
                  }
                </Text>
              )}

              <TextInput
                label={tradeMode === 'open' ? `Quantity (${quote})` : `Quantity (${token})`}
                placeholder="0.00"
                value={qty}
                onChange={(e) => setQty(e.currentTarget.value)}
                size="xs"
              />

              {tradeMode === 'open' && (
                <Text size="xs" c="dimmed" mt={-8}>
                  Est. Margin: <Text component="span" fw={600} c="var(--mantine-color-text)">
                    {(Number(qty || 0) / Number(leverage || 1)).toFixed(2)} {quote}
                  </Text>
                </Text>
              )}

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

              <Flex gap="md">
                {tradeMode === 'open' ? (
                  <>
                    <Button flex={1} color="var(--green)" loading={loadingOrder === 'buy'} onClick={() => placeOrder('long')} disabled={!isAuthed}>Buy / Long</Button>
                    <Button flex={1} color="var(--red)" loading={loadingOrder === 'sell'} onClick={() => placeOrder('short')} disabled={!isAuthed}>Sell / Short</Button>
                  </>
                ) : (
                  <Button
                    flex={1}
                    color="#fe445c"
                    variant="filled"
                    onClick={() => closePosition(`${token}_${quote}`, qty)}
                    disabled={!isAuthed || !qty}
                  >
                    Close Position
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

      <Modal
        opened={!!partialCloseData}
        onClose={() => setPartialCloseData(null)}
        title={`Close Position: ${partialCloseData?.symbol.replace('_', '')}`}
        centered
        size="sm"
        lockScroll={false}
      >
        <Flex direction="column" gap="md" py="xs">
          <Text size="sm" c="dimmed">
            Available to close: <Text component="span" fw={600} c="var(--mantine-color-text)">{partialCloseData?.totalQty}</Text>
          </Text>

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
            color="#fe445c"
            fullWidth
            onClick={() => closePosition(partialCloseData!.symbol, partialCloseQty)}
            disabled={!partialCloseQty || parseFloat(partialCloseQty) <= 0}
          >
            Confirm Close
          </Button>
        </Flex>
      </Modal>

      <TransferModal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentSide="futures"
        asset={quote as 'USDT' | 'USDC'}
        onTransferred={() => {
          refreshBalances()
        }}
      />

      <Modal opened={!!tpslData} onClose={() => setTpslData(null)} title={`TP/SL Settings - ${tpslData?.symbol.replace('_', '')}`} centered size="sm" lockScroll={false}>
        <Stack gap="md">
          <Box>
            <Text size="sm" fw={600} color="var(--green)">Take Profit (TP)</Text>
            <Flex direction="column" gap="sm" mt="xs">
              <TextInput
                label="Trigger Price"
                placeholder="0.00"
                value={tpslPrices.tp}
                onChange={(e) => setTpslPrices({ ...tpslPrices, tp: e.currentTarget.value })}
                size="xs"
              />
              <TextInput
                label="Quantity to Close"
                placeholder="All"
                value={tpslPrices.tpQty}
                onChange={(e) => setTpslPrices({ ...tpslPrices, tpQty: e.currentTarget.value })}
                size="xs"
              />
              <TradeSlider
                value={tpslPercents.tp}
                onChange={(val) => {
                  setTpslPercents({ ...tpslPercents, tp: val })
                  const q = val === 100 ? tpslData!.totalQty : (tpslData!.totalQty * val) / 100
                  setTpslPrices({ ...tpslPrices, tpQty: q > 0 ? q.toFixed(8).replace(/\.?0+$/, '') : '' })
                }}
              />
            </Flex>
          </Box>

          <Box>
            <Text size="sm" fw={600} color="var(--red)">Stop Loss (SL)</Text>
            <Flex direction="column" gap="sm" mt="xs">
              <TextInput
                label="Trigger Price"
                placeholder="0.00"
                value={tpslPrices.sl}
                onChange={(e) => setTpslPrices({ ...tpslPrices, sl: e.currentTarget.value })}
                size="xs"
              />
              <TextInput
                label="Quantity to Close"
                placeholder="All"
                value={tpslPrices.slQty}
                onChange={(e) => setTpslPrices({ ...tpslPrices, slQty: e.currentTarget.value })}
                size="xs"
              />
              <TradeSlider
                value={tpslPercents.sl}
                onChange={(val) => {
                  setTpslPercents({ ...tpslPercents, sl: val })
                  const q = val === 100 ? tpslData!.totalQty : (tpslData!.totalQty * val) / 100
                  setTpslPrices({ ...tpslPrices, slQty: q > 0 ? q.toFixed(8).replace(/\.?0+$/, '') : '' })
                }}
              />
            </Flex>
          </Box>
          <Group grow mt="md">
            <Button variant="light" color="gray" onClick={() => setTpslData(null)}>Cancel</Button>
            <Button color="blue" onClick={() => updateTPSL(tpslData!.symbol, tpslPrices.tp, tpslPrices.sl, tpslPrices.tpQty, tpslPrices.slQty)}>Save TP/SL</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}