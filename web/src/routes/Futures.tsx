import { Card, TextInput, Button, Grid, Menu, ScrollArea } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PriceChart from '../components/PriceChart'
import { API_BASE } from '../config/api'

export default function Futures() {
  const [search] = useSearchParams()
  const quote = (search.get('quote') || 'USDT').toUpperCase()
  const initialBase = (search.get('base') || 'BTC').toUpperCase()
  const [token, setToken] = useState(initialBase)
  useEffect(() => {
    setToken(initialBase)
  }, [initialBase])
  type FuturesRow = { symbol: string; lastPrice?: string }
  const [futuresRows, setFuturesRows] = useState<FuturesRow[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/futures/tickers`)
        if (!res.ok) return
        const j = await res.json()
        const arr = Array.isArray(j?.data) ? j.data : []
        if (!cancelled) setFuturesRows(arr)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  const tokenOptions = useMemo(() => {
    const suffix = `_${quote}`
    const list = futuresRows
      .filter(r => typeof r.symbol === 'string' && r.symbol.endsWith(suffix))
      .map(r => r.symbol.replace(suffix, ''))
    return Array.from(new Set(list))
  }, [futuresRows, quote])

  // Ensure selected token exists in available list; if not, pick first
  useEffect(() => {
    if (tokenOptions.length > 0 && !tokenOptions.includes(token)) {
      setToken(tokenOptions[0])
    }
  }, [tokenOptions])

  const [pairQuery, setPairQuery] = useState('')
  const filteredOptions = useMemo(() => {
    const q = pairQuery.trim().toLowerCase()
    const arr = q ? tokenOptions.filter(t => t.toLowerCase().includes(q)) : tokenOptions
    return arr.slice(0, 500)
  }, [tokenOptions, pairQuery])
  const [availableIntervals, setAvailableIntervals] = useState<Array<'1m'|'5m'|'1h'|'1d'>>(['1m','5m','1h','1d'])
  const [interval, setInterval] = useState<'1m'|'5m'|'1h'|'1d'>('1m')

  // Fetch available intervals per futures symbol
  useEffect(() => {
    let cancelled = false
    const sym = `${token}_${quote}`
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/futures/intervals?symbol=${sym}`)
        const j = await res.json().catch(() => ({}))
        if (cancelled) return
        const ivs = Array.isArray(j?.intervals) ? j.intervals.filter((iv: string) => ['1m','5m','1h','1d'].includes(iv)) : ['1m','5m','1h','1d']
        setAvailableIntervals(ivs as any)
        if (!ivs.includes(interval)) setInterval((ivs[0] as any) ?? '1m')
      } catch {
        if (cancelled) return
        setAvailableIntervals(['1m','5m','1h','1d'])
      }
    })()
    return () => { cancelled = true }
  }, [token, quote])

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Menu shadow="md" width={260} position="bottom-start" withinPortal>
          <Menu.Target>
            <Button variant="outline" size="compact-md" className="h-10">
              <div className="leading-tight text-left">
                <div className="text-sm font-medium">{token}/{quote}</div>
                <div className="text-[11px] text-neutral-500">Perpetual</div>
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
                  {t}/{quote} Perp
                </Menu.Item>
              ))}
            </ScrollArea.Autosize>
          </Menu.Dropdown>
        </Menu>
        <Menu shadow="md" width={180}>
          <Menu.Target>
            <Button variant="outline" size="compact-md" className="h-10">{interval}</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {availableIntervals.map((iv) => (
              <Menu.Item key={iv} onClick={() => setInterval(iv as any)}>{iv}</Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-2">
              <PriceChart key={`${token}${quote}-${interval}-futures`} symbol={`${token}${quote}`} interval={interval} market="futures" />
            </div>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Order Book</div>
            <div className="p-3 h-[200px] overflow-auto text-sm">
              <div className="grid grid-cols-3 gap-y-1">
                <div className="text-red-600">50,000</div><div>12.4</div><div>623k</div>
                <div className="text-red-600">49,900</div><div>3.7</div><div>185k</div>
                <div className="text-green-600">49,800</div><div>8.1</div><div>403k</div>
              </div>
            </div>
          </Card>
          <Card padding={0} radius="md" withBorder>
            <div className="p-3 border-b text-sm font-medium">Recent Trades</div>
            <div className="p-3 h-[160px] overflow-auto text-sm">
              <div className="grid grid-cols-3 gap-y-1">
                <div className="text-green-600">49,820</div><div>0.12</div><div>12:01:03</div>
                <div className="text-red-600">49,810</div><div>0.08</div><div>12:00:57</div>
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
            <div className="grid gap-1">
              <TextInput id="lev" label="Leverage" placeholder="x10" />
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
          <div className="p-3 border-b text-sm font-medium">Positions & Orders</div>
          <div className="p-4 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-500">
                <tr className="text-left">
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Liq</th>
                  <th className="py-2 pr-3">uPNL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 pr-3">e.g. BTC/{quote} Perp</td>
                  <td className="py-2 pr-3 text-green-600">e.g. Long</td>
                  <td className="py-2 pr-3">e.g. 0.50 BTC x10</td>
                  <td className="py-2 pr-3">e.g. 49,800</td>
                  <td className="py-2 pr-3">e.g. 45,200</td>
                  <td className="py-2 pr-3 text-green-600">e.g. +123.40</td>
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


