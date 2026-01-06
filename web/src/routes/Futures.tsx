import { Card, TextInput, Button, Grid, Group, Text, Loader, Tabs, Modal, Badge, Flex, Box, Stack, Tooltip, ActionIcon, SegmentedControl } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState, useCallback } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import MarketTrades from '../components/MarketTrades'
import { API_BASE } from '../config/api'
import { useMarket } from '../contexts/MarketContext'
import { useIntervals } from '../lib/useIntervals'
import BigPrice from '../components/BigPrice'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import TransferModal from '../components/TransferModal'
import TradeSlider from '../components/TradeSlider'
import DataTable from '../components/DataTable'
import { FuturesTradeForm } from '../components/FuturesTradeForm'
import { useSymbolStats } from '../lib/useSymbolStats'
import { formatDate, cleanSymbol } from '../lib/utils'
import { AssetSelector } from '../components/AssetSelector'
import { TerminalTabs } from '../components/TerminalTabs'
import SharePNLModal from '../components/SharePNLModal'
import { IconShare } from '@tabler/icons-react'

export default function Futures() {
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase().trim().replace(/\s+/g, '')
  const [token, setToken] = useState(initialBase)
  const [sidebarTab, setSidebarTab] = useState<'book' | 'trades'>('book')

  const { futuresStats, listen, unlisten } = useMarket()
  const { isAuthed } = useAuth()
  const { futuresAvailable, refreshBalances, futuresPositions, orders: recentOrders } = useAccount()
  const { stats, loading: loadingStats } = useSymbolStats('futures', token, quote)
  const statsMap = useMemo(() => {
    const map = new Map();
    futuresStats.forEach(s => {
      // Store both formats to be safe
      map.set(s.symbol, s);
      map.set(s.symbol.replace('_', ''), s);
    });
    return map;
  }, [futuresStats])

  const [loadingOrder, setLoadingOrder] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [partialCloseData, setPartialCloseData] = useState<any | null>(null)
  const [partialCloseQty, setPartialCloseQty] = useState('')
  const [partialClosePercent, setPartialClosePercent] = useState(0)
  const [tpslData, setTpslData] = useState<any | null>(null)
  const [tpslPrices, setTpslPrices] = useState({ tp: '', sl: '', tpQty: '', slQty: '' })
  const [tpslPercents, setTpslPercents] = useState({ tp: 0, sl: 0 })
  const [shareData, setShareData] = useState<any>(null)

  const { availableIntervals, interval, setInterval } = useIntervals({
    symbol: `${token}_${quote}`,
    market: 'futures'
  })

  useEffect(() => {
    listen('futures')
    return () => unlisten('futures')
  }, [listen, unlisten])

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



  const placeOrder = useCallback(async (side: 'long' | 'short', qty: string, orderType: 'market' | 'limit', limitPrice: string, leverage: string) => {
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
        refreshBalances()
      } else {
        const j = await res.json()
        notifications.show({ title: 'Order Error', message: j.error || 'Failed to place order', color: 'red' })
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Network error', color: 'red' })
    } finally {
      setLoadingOrder(null)
    }
  }, [isAuthed, token, quote, refreshBalances])

  const cancelOrder = useCallback(async (id: string) => {
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
        notifications.show({ title: 'Cancel Error', message: j.error || 'Failed to cancel', color: 'red' })
      }
    } catch { notifications.show({ title: 'Error', message: 'Network error', color: 'red' }) }
  }, [refreshBalances])

  const closePosition = useCallback(async (symbol: string, quantity?: string) => {
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
        notifications.show({ title: 'Close Error', message: j.error || 'Failed to close', color: 'red' })
      }
    } catch { notifications.show({ title: 'Error', message: 'Network error', color: 'red' }) }
  }, [refreshBalances, fetchHistory])

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
        notifications.show({ title: 'TP/SL Error', message: j.error || 'Failed to update TP/SL', color: 'red' })
      }
    } catch { notifications.show({ title: 'Error', message: 'Network error', color: 'red' }) }
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
            market="futures"
            stats={futuresStats}
            onSelect={setToken}
          />
        </Box>

        <Box style={{ flex: 1 }}>
          {loadingStats ? <Loader size="xs" /> : (
            <Flex gap="md" wrap={{ base: 'wrap', md: 'nowrap' }} align="center">
              <Group gap="lg" wrap="nowrap">
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
                      <OrderBook symbol={`${token}_${quote}`} market="futures" depth={28} />
                    ) : (
                      <MarketTrades symbol={`${token}_${quote}`} market="futures" depth={33} />
                    )}
                  </Box>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Tables aligned to complete the sidebar pillar height */}
            <TerminalTabs
              defaultValue="positions"
              tabs={[
                { value: 'positions', label: 'Positions' },
                { value: 'orders', label: 'Open Orders' },
                { value: 'history', label: 'Position History', onClick: fetchHistory }
              ]}
            >

              <Tabs.Panel value="positions" p={0}>
                <DataTable
                  data={futuresPositions}
                  emptyMessage="No active positions"
                  columns={[
                    {
                      label: 'Trading Pair',
                      key: 'symbol',
                      render: (item) => (
                        <Flex direction="column" lh={1.2} gap={0}>
                          <Text size="sm" fw={700}>{cleanSymbol(item.symbol)}</Text>
                          <Group gap={2}>
                            <Text size="xxs" c="dimmed" fw={500}>{item.leverage}x</Text>
                            <Text size="xxs" color={item.side === 'long' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                              {item.side}
                            </Text>
                          </Group>
                        </Flex>
                      )
                    },
                    { label: 'Size (Qty)', key: 'quantity', render: (item) => Number(item.quantity).toFixed(4) },
                    {
                      label: 'Avg Entry Price',
                      key: 'entryPrice',
                      render: (item) => {
                        const val = Number(item.entryPrice)
                        return val > 1 ? val.toFixed(2) : val.toFixed(6).replace(/\.?0+$/, '')
                      }
                    },
                    { label: 'Margin', key: 'margin', render: (item) => `${Number(item.margin || 0).toFixed(2)} ${quote}` },
                    { label: 'Liq. Price', key: 'liquidationPrice', render: (item) => <Text size="sm" c="var(--liq)" fw={600}>{item.liquidationPrice ? Number(item.liquidationPrice).toFixed(2) : '-'}</Text> },
                    {
                      label: 'Unrealized PNL',
                      key: 'pnl',
                      render: (item) => {
                        // Try exact match, then de-underscored, then manual
                        const itemStats = statsMap.get(item.symbol) ||
                          statsMap.get(item.symbol.replace('_', '')) ||
                          statsMap.get(item.symbol + quote);


                        const lastPrice = Number(itemStats?.lastPrice || 0)
                        const entryPrice = Number(item.entryPrice || 0)
                        const qty = Number(item.quantity || 0)
                        const margin = Number(item.margin || 0)

                        let pnlValue = 0
                        if (lastPrice > 0) {
                          pnlValue = item.side === 'long' ? (lastPrice - entryPrice) * qty : (entryPrice - lastPrice) * qty
                        }

                        const roi = margin > 0 ? (pnlValue / margin) * 100 : 0
                        return (
                          <Group gap={8} wrap="nowrap">
                            <Flex direction="column" lh={1.2} style={{ flex: 1 }}>
                              <Text size="xs" color={pnlValue >= 0 ? 'var(--green)' : 'var(--red)'} fw={600}>
                                {pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)} {quote}
                              </Text>
                              <Text size="xxs" color={pnlValue >= 0 ? 'var(--green)' : 'var(--red)'}>
                                ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                              </Text>
                            </Flex>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              color="gray"
                              onClick={() => setShareData({
                                symbol: item.symbol,
                                side: item.side,
                                leverage: item.leverage,
                                pnl: pnlValue,
                                roi: roi,
                                entryPrice: entryPrice,
                                markPrice: lastPrice,
                                liquidationPrice: item.liquidationPrice
                              })}
                            >
                              <IconShare size={14} />
                            </ActionIcon>
                          </Group>
                        )
                      }
                    },
                    {
                      label: 'Realized PNL',
                      key: 'realizedPnL',
                      render: (item) => {
                        const realizedPnl = Number(item.realizedPnL || 0)
                        const margin = Number(item.margin || item.marginToRelease || 0)
                        const roi = margin > 0 ? (realizedPnl / margin) * 100 : 0

                        return (
                          <Flex direction="column" lh={1.2}>
                            <Group gap={4}>
                              <Text size="xs" color={realizedPnl >= 0 ? 'var(--green)' : 'var(--red)'} fw={600}>
                                {realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(2)} {quote}
                              </Text>
                              {item.note === 'Liquidated' && (
                                <Tooltip label={`Liquidated at ${item.exitPrice}`}>
                                  <Badge color="var(--red)" size="xs" variant="filled">LIQ</Badge>
                                </Tooltip>
                              )}
                            </Group>
                            <Text size="xxs" color={realizedPnl >= 0 ? 'var(--green)' : 'var(--red)'}>
                              ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                            </Text>
                          </Flex>
                        )
                      }
                    },
                    {
                      label: 'TP/SL',
                      key: 'tpsl',
                      render: (item) => (
                        <Flex direction="column" gap={2} lh={1}>
                          <Text size="xxs" color="var(--green)" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleTpslClick(item)}>
                            TP: {item.tpPrice > 0 ? item.tpPrice : '--'} {item.tpQuantity > 0 ? `(${Math.round((item.tpQuantity / item.quantity) * 100)}%)` : ''}
                          </Text>
                          <Text size="xxs" color="var(--red)" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleTpslClick(item)}>
                            SL: {item.slPrice > 0 ? item.slPrice : '--'} {item.slQuantity > 0 ? `(${Math.round((item.slQuantity / item.quantity) * 100)}%)` : ''}
                          </Text>
                        </Flex>
                      )
                    },
                    {
                      label: 'Close',
                      key: 'action',
                      render: (item) => <Button size="compact-xs" color="#fe445c" variant="light" onClick={() => setPartialCloseData({ symbol: item.symbol, totalQty: Number(item.quantity) })}>Close</Button>
                    }
                  ]}
                />
              </Tabs.Panel>

              <Tabs.Panel value="orders" p={0}>
                <DataTable
                  data={recentOrders.filter(o => o.symbol?.includes('_'))}
                  emptyMessage="No recent orders"
                  columns={[
                    {
                      label: 'Symbol',
                      key: 'symbol',
                      render: (item) => (
                        <Flex direction="column" lh={1.2} gap={0}>
                          <Text size="sm" fw={700}>{cleanSymbol(item.symbol)}</Text>
                          <Group gap={2}>
                            <Text size="xxs" c="dimmed" fw={500}>{item.leverage}x</Text>
                            <Text size="xxs" color={item.side === 'long' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                              {item.side}
                            </Text>
                          </Group>
                        </Flex>
                      )
                    },
                    { label: 'Size', key: 'quantity', render: (item) => Number(item.quantity).toFixed(4) },
                    { label: 'Price', key: 'price' },
                    { label: 'Status', key: 'status' },
                    { label: 'Time', key: 'createdAt', render: (item) => formatDate(item.createdAt) },
                    {
                      label: 'Action',
                      key: 'action',
                      render: (item) => item.status === 'pending' ? <Button size="compact-xs" color="gray" variant="light" onClick={() => cancelOrder(item._id)}>Cancel</Button> : '-'
                    }
                  ]}
                />
              </Tabs.Panel>

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
                          <Group gap={2}>
                            <Text size="xxs" c="dimmed" fw={500}>{item.leverage}x</Text>
                            <Text size="xxs" color={item.side === 'long' ? 'var(--green)' : 'var(--red)'} fw={700} tt="uppercase">
                              {item.side}
                            </Text>
                          </Group>
                        </Flex>
                      )
                    },
                    { label: 'Size', key: 'quantity', render: (item) => Number(item.quantity).toFixed(4) },
                    { label: 'Entry', key: 'entryPrice' },
                    { label: 'Exit', key: 'exitPrice' },
                    {
                      label: 'Realized PnL',
                      key: 'realizedPnL',
                      render: (item) => {
                        const realizedPnl = Number(item.realizedPnL || 0)
                        const margin = Number(item.margin || item.marginToRelease || 0)
                        const roi = margin > 0 ? (realizedPnl / margin) * 100 : 0

                        return (
                          <Group gap={8} wrap="nowrap">
                            <Flex direction="column" lh={1.2} style={{ flex: 1 }}>
                              <Group gap={4}>
                                <Text size="xs" color={realizedPnl >= 0 ? 'var(--green)' : 'var(--red)'} fw={600}>
                                  {realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(2)} {quote}
                                </Text>
                                {item.note === 'Liquidated' && (
                                  <Tooltip label={`Liquidated at ${item.exitPrice}`}>
                                    <Badge color="var(--red)" size="xs" variant="filled">LIQ</Badge>
                                  </Tooltip>
                                )}
                              </Group>
                              <Text size="xxs" color={realizedPnl >= 0 ? 'var(--green)' : 'var(--red)'}>
                                ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                              </Text>
                            </Flex>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              color="gray"
                              onClick={() => setShareData({
                                symbol: item.symbol,
                                side: item.side,
                                leverage: item.leverage,
                                pnl: realizedPnl,
                                roi: roi,
                                entryPrice: item.entryPrice,
                                exitPrice: item.exitPrice,
                                isHistory: true
                              })}
                            >
                              <IconShare size={14} />
                            </ActionIcon>
                          </Group>
                        )
                      }
                    },
                    { label: 'Time', key: 'time', render: (item) => formatDate(item.createdAt || item.updatedAt || item.closedAt) }
                  ]}
                />
              </Tabs.Panel>
            </TerminalTabs>
          </Flex>
        </Grid.Col>

        {/* Right Side: Sidebar Trade Panel */}
        <Grid.Col span={{ base: 12, lg: 2 }}>
          <FuturesTradeForm
            token={token}
            quote={quote}
            isAuthed={isAuthed}
            available={available}
            futuresPositions={futuresPositions}
            onPlaceOrder={placeOrder}
            onClosePosition={closePosition}
            onTransferClick={() => setTransferOpen(true)}
            loadingOrder={loadingOrder}
          />
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
        initialAsset={quote as 'USDT' | 'USDC'}
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
            <Button
              fullWidth
              color="blue"
              onClick={() => {
                // Validation
                if (tpslData) {
                  const s = tpslData.symbol
                  const currentStat = statsMap.get(s) || statsMap.get(s.replace('_', ''))
                  const currentPrice = parseFloat(currentStat?.lastPrice || '0')
                  const position = futuresPositions.find(p => p.symbol === s)

                  if (currentPrice > 0 && position) {
                    const isLong = position.side === 'long'
                    const tp = parseFloat(tpslPrices.tp)
                    const sl = parseFloat(tpslPrices.sl)

                    if (tp > 0) {
                      if (isLong && tp <= currentPrice) {
                        notifications.show({ title: 'Invalid TP', message: `Long TP (${tp}) must be higher than current price (${currentPrice})`, color: 'red' })
                        return
                      }
                      if (!isLong && tp >= currentPrice) {
                        notifications.show({ title: 'Invalid TP', message: `Short TP (${tp}) must be lower than current price (${currentPrice})`, color: 'red' })
                        return
                      }
                    }

                    if (sl > 0) {
                      if (isLong && sl >= currentPrice) {
                        notifications.show({ title: 'Invalid SL', message: `Long SL (${sl}) must be lower than current price (${currentPrice})`, color: 'red' })
                        return
                      }
                      if (!isLong && sl <= currentPrice) {
                        notifications.show({ title: 'Invalid SL', message: `Short SL (${sl}) must be higher than current price (${currentPrice})`, color: 'red' })
                        return
                      }
                    }
                  }

                  updateTPSL(
                    tpslData.symbol,
                    tpslPrices.tp,
                    tpslPrices.sl,
                    tpslPrices.tpQty,
                    tpslPrices.slQty
                  )
                }
              }}
            >
              Confirm TP/SL
            </Button>
          </Group>
        </Stack>
      </Modal>

      <SharePNLModal
        opened={!!shareData}
        onClose={() => setShareData(null)}
        data={shareData}
      />
    </Box >
  )
}