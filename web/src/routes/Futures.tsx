import { Card, TextInput, Button, Grid, Menu, ScrollArea, Group, Text, Loader } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import OrderBook from '../components/OrderBook'
import { API_BASE } from '../config/api'
import { useMarket } from '../contexts/MarketContext'
import { useIntervals } from '../lib/useIntervals'

export default function Futures() {
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase()
  const [token, setToken] = useState(initialBase)
  const [pairQuery, setPairQuery] = useState('')
  const [stats, setStats] = useState<any | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const { futuresTickers: futuresRows } = useMarket()

  useEffect(() => setToken(initialBase), [initialBase])

  const tokenOptions = useMemo(() => {
    const suffix = `_${quote}`
    const list = futuresRows
      .filter(r => typeof r.symbol === 'string' && r.symbol.endsWith(suffix))
      .map(r => r.symbol.replace(suffix, ''))
    return Array.from(new Set(list))
  }, [futuresRows, quote])

  const filteredOptions = useMemo(() => {
    const q = pairQuery.trim().toLowerCase()
    return (q ? tokenOptions.filter(t => t.toLowerCase().includes(q)) : tokenOptions).slice(0, 500)
  }, [tokenOptions, pairQuery])

  const { availableIntervals, interval, setInterval } = useIntervals({
    symbol: `${token}_${quote}`,
    market: 'futures'
  })

  // WebSocket for 24h stats - Ultra-clean version
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
      } catch {}
    }
    ws.onclose = () => !stopped && setLoadingStats(false)
    ws.onerror = () => !stopped && setLoadingStats(false)
    
    return () => { stopped = true; ws.readyState === WebSocket.OPEN && ws.close() }
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
              <Text size="sm" c={(Number(stats?.riseFallRate) || 0) >= 0 ? 'teal' : 'red'}>
                24h: {stats?.riseFallRate != null ? `${Number(stats.riseFallRate).toFixed(2)}%` : '-'}
              </Text>
              <Text size="sm">H: {stats?.highPrice ?? '-'} L: {stats?.lowPrice ?? '-'} V: {stats?.volume ?? '-'}</Text>
            </>
          )}
        </Group>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-2">
              <PriceChart key={`${token}_${quote}-${interval}-futures`} symbol={`${token}_${quote}`} interval={interval} market="futures" />
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
              <div className="text-xs text-neutral-500">Futures trading coming soon...</div>
            </div>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  )
}


