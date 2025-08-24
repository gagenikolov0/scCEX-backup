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
  const [price, setPrice] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [placing, setPlacing] = useState<null | 'buy' | 'sell'>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [stats, setStats] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

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

  // WebSocket for 24h stats - Ultra-clean version
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
      } catch {}
    }
    ws.onclose = () => !stopped && setLoadingStats(false)
    ws.onerror = () => !stopped && setLoadingStats(false)
    
    return () => { stopped = true; ws.readyState === WebSocket.OPEN && ws.close() }
  }, [token, quote])

  const placeOrder = async (side: 'buy'|'sell') => {
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
        setQty(''); 
        setPrice(''); 
        // Refresh all data to show immediate updates
        refreshOrders();
        refreshBalances();
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
        // Refresh all data to show immediate updates
        refreshOrders();
        refreshBalances();
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
        <tr className="text-left">
          {columns.map(col => <th key={col} className="py-2 pr-3">{col}</th>)}
          {showCancel && <th className="py-2 pr-3">Action</th>}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr className="border-t">
            <td className="py-2 pr-3" colSpan={columns.length + (showCancel ? 1 : 0)}>{emptyMessage}</td>
          </tr>
        ) : (
          data.map((item, index) => (
            <tr key={item.id || index} className="border-t">
              {columns.map(col => {
                let value = ''
                if (col === 'Symbol') value = item.symbol || '-'
                else if (col === 'Side') value = item.side || '-'
                else if (col === 'Size') value = item.quantity || item.available || '-'
                else if (col === 'Price') value = item.price || '-'
                else if (col === 'Status') value = item.status || '-'
                else if (col === 'Time') value = formatDate(item.createdAt) || '-'
                else if (col === 'Asset') value = item.asset || '-'
                else if (col === 'Available') value = item.available || '-'
                else if (col === 'Updated') value = formatDate(item.updatedAt) || '-'
                else value = item[col.toLowerCase()] || '-'
                
                return (
                  <td key={col} className={`py-2 pr-3 ${col === 'Side' && item.side === 'buy' ? 'text-green-600' : col === 'Side' && item.side === 'sell' ? 'text-red-600' : ''}`}>
                    {value}
                  </td>
                )
              })}
              {showCancel && (
                <td className="py-2 pr-3">
                  <Button size="xs" variant="subtle" color="red" onClick={() => cancelOrder(item.id)}>
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
              <Text size="sm">H: {stats?.highPrice ?? '-'} L: {stats?.lowPrice ?? '-'} V: {stats?.volume ?? '-'}
              </Text>
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
              
              {/* Order Type Toggle */}
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
              
              {/* Price Input (only for limit orders) */}
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
              {renderTable(orders.filter(o => o.status !== 'pending'), ['Symbol', 'Side', 'Size', 'Price', 'Status', 'Time'], 'No orders')}
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Pending Orders */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Pending Orders</div>
            <div className="p-4 overflow-auto">
              {renderTable(orders.filter(o => o.status === 'pending'), ['Symbol', 'Side', 'Size', 'Price', 'Status', 'Time'], 'No pending orders', true)}
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
              {renderTable(positions, ['Asset', 'Available', 'Updated'], 'No positions')}
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      <TransferModal 
        opened={transferOpen} 
        onClose={() => setTransferOpen(false)} 
        currentSide="spot" 
        asset={quote as 'USDT'|'USDC'} 
        onTransferred={() => {
          // Refresh all data after transfer
          refreshBalances();
          refreshOrders();
        }} 
      />
    </div>
  )
}


