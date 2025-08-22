import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import { API_BASE } from '../config/api'

export default function Spot() {
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase()
  const [token, setToken] = useState(initialBase)
  useEffect(() => {
    setToken(initialBase)
  }, [initialBase])

  type Ticker = { symbol: string; price: string }
  const [tickers, setTickers] = useState<Ticker[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/spot/tickers`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setTickers(Array.isArray(data) ? data : [])
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  const tokenOptions = useMemo(() => {
    const list = tickers
      .filter(t => t.symbol.endsWith(quote))
      .map(t => t.symbol.replace(quote, ''))
    return Array.from(new Set(list))
  }, [tickers, quote])

  const [pairQuery, setPairQuery] = useState('')
  const filteredOptions = useMemo(() => {
    const q = pairQuery.trim().toLowerCase()
    const arr = q ? tokenOptions.filter(t => t.toLowerCase().includes(q)) : tokenOptions
    return arr.slice(0, 500)
  }, [tokenOptions, pairQuery])

  const allIntervals = ['1m','5m','15m','30m','1h','2h','4h','6h','1d','2d','1w'] as const
  type Interval = typeof allIntervals[number]
  const [availableIntervals, setAvailableIntervals] = useState<Interval[]>(['1m','5m','1h','1d'])
  const [interval, setInterval] = useState<Interval>('1m')
  const [stats, setStats] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Fetch available intervals for selected symbol
  useEffect(() => {
    let cancelled = false
    const sym = `${token}${quote}`
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/spot/intervals?symbol=${sym}`)
        const j = await res.json().catch(() => ({}))
        if (cancelled) return
        const ivs = Array.isArray(j?.intervals) ? j.intervals.filter((iv: string) => (allIntervals as readonly string[]).includes(iv)) : ['1m','5m','1h','1d']
        setAvailableIntervals(ivs as Interval[])
        if (!ivs.includes(interval)) setInterval((ivs[0] as any) ?? '1m')
      } catch {
        if (cancelled) return
        setAvailableIntervals(['1m','5m','1h','1d'])
      }
    })()
    return () => { cancelled = true }
  }, [token, quote])

  // Subscribe to 24h stats via WS for selected spot pair
  useEffect(() => {
    setLoadingStats(true)
    const wsBase = API_BASE.replace(/^http/, 'ws')
    const sym = `${token}${quote}`
    let stopped = false
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(`${wsBase}/ws/spot-24h`)
      ws.onopen = () => {
        try { ws?.send(JSON.stringify({ type: 'sub', symbol: sym })) } catch {}
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg?.type === 'stats' && msg?.symbol === sym) {
            setStats(msg.data)
            setLoadingStats(false)
          }
        } catch {}
      }
      ws.onclose = () => { if (!stopped) setLoadingStats(false) }
      ws.onerror = () => { if (!stopped) setLoadingStats(false) }
    } catch {
      setLoadingStats(false)
    }
    return () => {
      stopped = true
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'unsub', symbol: sym })) } catch {}
        try { ws.close() } catch {}
      }
    }
  }, [token, quote])

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
              <TextInput
                placeholder="Search pair"
                value={pairQuery}
                onChange={(e) => setPairQuery(e.currentTarget.value)}
                size="xs"
              />
            </div>
            <ScrollArea.Autosize mah={320} mx={0} type="auto">
              {filteredOptions.map((t) => (
                <Menu.Item key={t} onClick={() => setToken(t)}>
                  {t}/{quote}
                </Menu.Item>
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
              <Menu.Item key={iv} onClick={() => setInterval(iv as any)}>{iv}</Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Group gap="md" className="ml-1" wrap="nowrap">
          {loadingStats ? <Loader size="xs" /> : (
            <>
              <Text size="sm">Price: {stats?.lastPrice ?? '-'}</Text>
              <Text size="sm" c={(Number(stats?.priceChangePercent) || 0) >= 0 ? 'teal' : 'red'}>
                24h: {stats?.priceChangePercent != null ? `${Number(stats.priceChangePercent).toFixed(2)}%` : '-'}
              </Text>
              <Text size="sm">High: {stats?.highPrice ?? '-'}</Text>
              <Text size="sm">Low: {stats?.lowPrice ?? '-'}</Text>
              <Text size="sm">Vol: {stats?.volume ?? '-'}</Text>
              <Text size="sm">QuoteVol: {stats?.quoteVolume ?? '-'}</Text>
            </>
          )}
        </Group>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-2">
              <PriceChart key={`${token}${quote}-${interval}-spot`} symbol={`${token}${quote}`} interval={interval} />
            </div>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Order Book</div>
            <div className="p-0 h-[360px] overflow-auto text-sm">
              <OrderBook symbol={`${token}${quote}`} market="spot" depth={50} />
            </div>
          </Card>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Recent Trades</div>
            <div className="p-3 h-[160px] overflow-auto text-sm">
              <div className="grid grid-cols-3 gap-y-1">
                <div className="text-green-600">e.g. 49,820</div><div>0.12</div><div>12:01:03</div>
                <div className="text-red-600">e.g. 49,810</div><div>0.08</div><div>12:00:57</div>
              </div>
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Trade</div>
          <div className="p-4 grid gap-3">
            <div className="grid gap-1">
              <TextInput id="qty" label="Quantity" placeholder="0.00" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" variant="light" color="teal">Buy</Button>
              <Button className="flex-1" color="red">Sell</Button>
            </div>
          </div>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding={0} radius="md" withBorder>
          <div className="p-3 border-b text-sm font-medium">Order History</div>
          <div className="p-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-500">
                <tr className="text-left">
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Avg Price</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 pr-3">e.g. BTC/{quote}</td>
                  <td className="py-2 pr-3 text-green-600">e.g. Buy</td>
                  <td className="py-2 pr-3">e.g. 0.50 BTC</td>
                  <td className="py-2 pr-3">e.g. 49,800</td>
                  <td className="py-2 pr-3">e.g. Filled</td>
                </tr>
              </tbody>
            </table>
          </div>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  )
}


