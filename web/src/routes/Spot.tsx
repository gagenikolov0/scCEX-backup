import { Card, TextInput, Button, Grid, Text, Loader, Tabs, Flex, Box, Group, Stack, SegmentedControl, rem } from '@mantine/core'
import { IconWallet } from '@tabler/icons-react'
import { CryptoIcon } from '../components/CryptoIcon'
import { notifications } from '@mantine/notifications'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import MarketTrades from '../components/MarketTrades'
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
  const [sidebarTab, setSidebarTab] = useState<'book' | 'trades'>('book')
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
      <Flex
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'stretch', md: 'center' }}
        gap={{ base: 'sm', md: 'lg' }}
        pb="4px"
      >
        <Box w={{ base: '100%', md: 'auto' }}>
          <AssetSelector
            currentSymbol={token}
            currentQuote={quote}
            market="spot"
            stats={spotStats}
            onSelect={setToken}
          />
        </Box>

        <Box style={{ flex: 1 }}>
          {loadingStats ? <Loader size="xs" /> : (
            <Flex gap="md" wrap={{ base: 'wrap', md: 'nowrap' }} align="center">
              <Group gap="lg" wrap="nowrap">
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
              </Group>

              <Group gap="lg" wrap="nowrap">
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
            </Flex>
          )}
        </Box>
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

              {/* OrderBook & Trades */}
              <Grid.Col span={{ base: 10, lg: 2 }}>
                <Card padding={0} radius="md" withBorder shadow="xs" h={630}>
                  <Box bg="var(--bg-2)" p={4} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                    <SegmentedControl
                      fullWidth
                      size="xs"
                      value={sidebarTab}
                      onChange={(v) => setSidebarTab(v as any)}
                      data={[
                        { label: 'Order Book', value: 'book' },
                        { label: 'Trades', value: 'trades' }
                      ]}
                      styles={{ root: { backgroundColor: 'transparent' } }}
                    />
                  </Box>
                  <Box h={588} style={{ overflowY: 'hidden' }}>
                    {sidebarTab === 'book' ? (
                      <OrderBook symbol={`${token}${quote}`} market="spot" depth={28} />
                    ) : (
                      <MarketTrades symbol={`${token}${quote}`} market="spot" depth={33} />
                    )}
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
                    {
                      label: 'Asset',
                      key: 'asset',
                      render: (item) => (
                        <Group gap="xs">
                          <CryptoIcon symbol={item.asset} size={24} />
                          <Text size="sm" fw={700}>{item.asset}</Text>
                        </Group>
                      )
                    },
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
            <Box bg="var(--bg-2)" h={39.59} px="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text size="sm" fw={700} tt="uppercase" style={{ letterSpacing: '0.05em' }}>Spot Trade</Text>
            </Box>
            <Flex direction="column" gap="sm" p="md">
              <SegmentedControl
                value={tradeSide}
                onChange={(v) => setTradeSide(v as 'buy' | 'sell')}
                fullWidth
                size="xs"
                radius="md"
                color={tradeSide === 'buy' ? 'green' : 'red'}
                data={[
                  { label: 'Buy', value: 'buy' },
                  { label: 'Sell', value: 'sell' }
                ]}
              />

              <SegmentedControl
                value={orderType}
                onChange={(v) => setOrderType(v as 'market' | 'limit')}
                size="xs"
                radius="md"
                data={[
                  { label: 'Limit', value: 'limit' },
                  { label: 'Market', value: 'market' }
                ]}
              />

              {/* Balance & Info */}
              <Group justify="space-between" mb={-4}>
                <Group gap={4}>
                  <IconWallet size={10} color="var(--mantine-color-dimmed)" />
                  <Text style={{ fontSize: rem(11) }} c="dimmed">Available:</Text>
                  <Text style={{ fontSize: rem(11), cursor: 'pointer' }} fw={700} onClick={() => {
                    if (tradeSide === 'buy') {
                      setQty(available)
                    } else {
                      setQty(baseAvail)
                    }
                  }}>
                    {tradeSide === 'buy'
                      ? `${Number(available).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                      : `${Number(baseAvail).toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
                  </Text>
                  <Text style={{ fontSize: rem(11) }} c="dimmed">{tradeSide === 'buy' ? quote : token}</Text>
                </Group>
                <Text style={{ fontSize: rem(11), cursor: 'pointer' }} c="blue" fw={700} onClick={() => setTransferOpen(true)}>Transfer</Text>
              </Group>

              {/* Inputs */}
              <Stack gap={6}>
                {orderType === 'limit' && (
                  <TextInput
                    placeholder="Price"
                    value={price}
                    onChange={(e) => setPrice(e.currentTarget.value)}
                    disabled={!isAuthed}
                    rightSection={<Text size="xs" c="dimmed" pr="xs">{quote}</Text>}
                    rightSectionWidth={50}
                    radius="md"
                    size="xs"
                  />
                )}

                <TextInput
                  placeholder="Amount"
                  value={qty}
                  onChange={(e) => setQty(e.currentTarget.value)}
                  rightSection={<Text size="xs" c="dimmed" pr="xs">{token}</Text>}
                  rightSectionWidth={50}
                  radius="md"
                  size="xs"
                />
              </Stack>

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

              <Button
                fullWidth
                size="sm"
                radius="md"
                variant="filled"
                color={tradeSide === 'buy' ? 'var(--green)' : 'var(--red)'}
                loading={placing === tradeSide}
                disabled={!isAuthed}
                onClick={() => placeOrder(tradeSide)}
                mt={4}
              >
                {tradeSide === 'buy' ? `Buy ${token}` : `Sell ${token}`}
              </Button>

              {!isAuthed && (
                <Button variant="light" size="sm" fullWidth radius="md" component="a" href="/login">
                  Log in or Sign up
                </Button>
              )}
            </Flex>
          </Card>
        </Grid.Col>
      </Grid>

      <TransferModal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentSide="spot"
        initialAsset={quote as 'USDT' | 'USDC'}
        onTransferred={() => {
          refreshBalances()
          refreshOrders()
        }}
      />
    </Box >
  )
}