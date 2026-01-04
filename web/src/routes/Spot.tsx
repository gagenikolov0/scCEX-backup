import { Card, TextInput, Button, Grid, Text, Loader, Tabs, Flex, Box, Group } from '@mantine/core'
import { notifications } from '@mantine/notifications'
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
import DataTable from '../components/DataTable'
import { useSymbolStats } from '../lib/useSymbolStats'
import { formatDate, getVal, cleanSymbol } from '../lib/utils'
import { AssetSelector } from '../components/AssetSelector'
import { TerminalTabs } from '../components/TerminalTabs'

export default function Spot() {
  const { isAuthed } = useAuth()
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase().trim().replace(/\s+/g, '')
  const [token, setToken] = useState(initialBase)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [placing, setPlacing] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [history, setHistory] = useState<any[]>([])
  const [percent, setPercent] = useState(0)

  const { spotStats, listen, unlisten } = useMarket()
  const { orders, spotAvailable, refreshOrders, refreshBalances, positions } = useAccount()
  const { stats, loading: loadingStats } = useSymbolStats('spot', token, quote)

  useEffect(() => setToken(initialBase), [initialBase])

  useEffect(() => {
    window.scrollTo(0, 0)
    listen('spot')
    return () => unlisten('spot')
  }, [listen, unlisten])

  // Robust stats map
  const statsMap = useMemo(() => {
    const map = new Map();
    spotStats.forEach(s => {
      map.set(s.symbol, s);
      map.set(s.symbol.replace('_', ''), s);
    });
    return map;
  }, [spotStats])

  const { availableIntervals, interval, setInterval } = useIntervals({
    symbol: `${token}${quote}`,
    market: 'spot'
  })

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
        notifications.show({ title: 'Order Error', message: j?.error || 'Order failed', color: 'red' })
      }
    } catch (e) { notifications.show({ title: 'Error', message: 'Order failed', color: 'red' }) } finally { setPlacing(null) }
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
        notifications.show({ title: 'Cancel Error', message: j?.error || 'Cancel failed', color: 'red' })
      }
    } catch (e) { notifications.show({ title: 'Error', message: 'Cancel failed', color: 'red' }) }
  }

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending' && !o.symbol.includes('_')), [orders])
  const available = (spotAvailable as any)?.[quote] ?? '0'
  const baseAvail = positions.find((r: any) => (r?.asset || '').toUpperCase() === token.toUpperCase())?.available ?? '0'

  return (
    <Box>
      <Flex align="center" gap="lg" py={4}>
        <AssetSelector
          currentSymbol={token}
          currentQuote={quote}
          market="spot"
          stats={spotStats}
          onSelect={setToken}
        />

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
            <TerminalTabs
              defaultValue="history"
              tabs={[
                { value: 'history', label: 'Trade History' },
                { value: 'pending', label: 'Open Orders' },
                { value: 'positions', label: 'Assets' }
              ]}
            >

              <Tabs.Panel value="history" p={0}>
                <DataTable
                  data={history}
                  emptyMessage="No trade history"
                  columns={[
                    {
                      label: 'Symbol',
                      key: 'symbol',
                      render: (item) => (
                        <Flex direction="column" lh={1.2} gap={0}>
                          <Text size="sm" fw={700}>{cleanSymbol(item.symbol)}</Text>
                          {item.side && (
                            <Text size="xxs" color={item.side === 'buy' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                              {item.side}
                            </Text>
                          )}
                        </Flex>
                      )
                    },
                    { label: 'Quantity', key: 'quantity', render: (item) => Number(getVal(item.quantity || item.quantityBase || 0)).toFixed(4) },
                    { label: 'Price', key: 'price', render: (item) => getVal(item.price || item.priceQuote) },
                    {
                      label: 'Quote Amount', key: 'total', render: (item) => {
                        const t = getVal(item.total || item.quoteAmount)
                        return t ? `${Number(t).toFixed(2)} ${quote}` : '-'
                      }
                    },
                    { label: 'Time', key: 'time', render: (item) => formatDate(item.createdAt || item.closedAt) }
                  ]}
                />
              </Tabs.Panel>

              <Tabs.Panel value="pending" p={0}>
                <DataTable
                  data={pendingOrders}
                  emptyMessage="No open orders"
                  columns={[
                    {
                      label: 'Symbol',
                      key: 'symbol',
                      render: (item) => (
                        <Flex direction="column" lh={1.2} gap={0}>
                          <Text size="sm" fw={700}>{cleanSymbol(item.symbol)}</Text>
                          {item.side && (
                            <Text size="xxs" color={item.side === 'buy' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                              {item.side}
                            </Text>
                          )}
                        </Flex>
                      )
                    },
                    { label: 'Quantity', key: 'quantity', render: (item) => Number(getVal(item.quantity || item.quantityBase || 0)).toFixed(4) },
                    { label: 'Price', key: 'price', render: (item) => getVal(item.price || item.priceQuote) },
                    { label: 'Status', key: 'status' },
                    { label: 'Time', key: 'time', render: (item) => formatDate(item.createdAt) },
                    {
                      label: 'Action',
                      key: 'action',
                      render: (item) => (
                        <Button size="compact-xs" variant="light" color="var(--red)" onClick={() => cancelOrder(item.id)}>
                          Cancel
                        </Button>
                      )
                    }
                  ]}
                />
              </Tabs.Panel>

              <Tabs.Panel value="positions" p={0}>
                <DataTable
                  data={positions}
                  emptyMessage="No assets"
                  columns={[
                    { label: 'Asset', key: 'asset' },
                    { label: 'Available', key: 'available', render: (item) => getVal(item.available) },
                    { label: 'Reserved', key: 'reserved', render: (item) => getVal(item.reserved) },
                    {
                      label: 'Value',
                      key: 'value',
                      render: (item) => {
                        const asset = item.asset
                        const available = parseFloat(getVal(item.available) || '0')
                        if (asset === 'USDT' || asset === 'USDC') {
                          return `${available.toFixed(2)} ${quote}`
                        } else {
                          const sym = `${asset}${quote}`;
                          const pairStats = statsMap.get(sym) || statsMap.get(sym.replace('_', ''));
                          const price = parseFloat(pairStats?.lastPrice || '0')
                          return price > 0 ? `${(available * price).toFixed(2)} ${quote}` : '-'
                        }
                      }
                    },
                    { label: 'Updated', key: 'updated', render: (item) => formatDate(item.updatedAt) }
                  ]}
                />
              </Tabs.Panel>
            </TerminalTabs>
          </Flex>
        </Grid.Col>

        {/* Right Side: Sidebar Trade Panel */}
        <Grid.Col span={{ base: 12, lg: 2 }}>
          <Card padding={0} withBorder radius="md" h={1171} style={{ overflowY: 'auto' }} shadow="xs">
            <Box bg="var(--bg-2)" h={40} px="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center' }}>
              <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Spot Trade</Text>
            </Box>
            <Flex direction="column" gap="md" p="md">
              <Tabs value={tradeSide} onChange={(v) => setTradeSide(v as 'buy' | 'sell')} variant="pills" radius="md" color={tradeSide === 'buy' ? 'var(--green)' : 'var(--red)'}>
                <Tabs.List grow>
                  <Tabs.Tab value="buy">Buy</Tabs.Tab>
                  <Tabs.Tab value="sell">Sell</Tabs.Tab>
                </Tabs.List>
              </Tabs>

              <Tabs value={orderType} onChange={(v) => setOrderType(v as 'market' | 'limit')} variant="pills" radius="md">
                <Tabs.List grow>
                  <Tabs.Tab value="market">Market</Tabs.Tab>
                  <Tabs.Tab value="limit">Limit</Tabs.Tab>
                </Tabs.List>
              </Tabs>

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
    </Box >
  )
}