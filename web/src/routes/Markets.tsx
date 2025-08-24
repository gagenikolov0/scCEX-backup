import { useMemo, useState } from 'react'
import { Card, TextInput, Anchor } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useMarket } from '../markets/MarketContext'

function splitSymbol(sym: string): { base: string; quote: string } {
  if (sym.endsWith('USDT')) return { base: sym.slice(0, -4), quote: 'USDT' }
  if (sym.endsWith('USDC')) return { base: sym.slice(0, -4), quote: 'USDC' }
  return { base: sym, quote: '' }
}

export default function Markets() {
  const { spotTickers: tickers, futuresTickers: futures } = useMarket()
  const [q, setQ] = useState('')

  const filterFn = (t: any) => !q || t.symbol.toLowerCase().includes(q.toLowerCase())

  const spotUSDT = useMemo(() => tickers.filter(t => t.symbol.endsWith('USDT')).filter(filterFn), [tickers, q])
  const spotUSDC = useMemo(() => tickers.filter(t => t.symbol.endsWith('USDC')).filter(filterFn), [tickers, q])

  const renderMarketCard = (title: string, data: any[], type: 'spot' | 'futures') => (
    <Card padding={0} radius="md" withBorder>
      <div className="p-3 border-b text-sm font-medium">{title}</div>
      <div className="divide-y max-h-[420px] overflow-auto">
        {data.map(item => {
          if (type === 'spot') {
            const { base, quote } = splitSymbol(item.symbol)
            return (
              <Anchor key={`${type}-${quote.toLowerCase()}-${item.symbol}`} component={Link} to={`/${type}?base=${base}&quote=${quote}`} underline="never" c="inherit" className="flex justify-between items-center px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <div className="text-sm font-medium">{base}/{quote}</div>
                <div className="text-sm tabular-nums">{item.price}</div>
              </Anchor>
            )
          } else {
            const base = item.symbol.replace('_USDT', '').replace('_USDC', '')
            const quote = item.symbol.includes('_USDT') ? 'USDT' : 'USDC'
            return (
              <Anchor component={Link} underline="never" c="inherit" key={`${type}-${quote.toLowerCase()}-${item.symbol}`} to={`/${type}?base=${base}&quote=${quote}`} className="flex justify-between items-center px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <div className="text-sm font-medium">{item.symbol.replace('_','/')} Perp</div>
                <div className="text-sm tabular-nums">{item.lastPrice ?? ''}</div>
              </Anchor>
            )
          }
        })}
      </div>
    </Card>
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <TextInput placeholder="Search (e.g. BTC, SOL)" value={q} onChange={e => setQ(e.currentTarget.value)} className="max-w-xs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderMarketCard('Spot · USDT', spotUSDT, 'spot')}
        {renderMarketCard('Spot · USDC', spotUSDC, 'spot')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderMarketCard('Futures · USDT Perpetuals', futures.filter(f => typeof f.symbol === 'string' && f.symbol.endsWith('_USDT')), 'futures')}
        {renderMarketCard('Futures · USDC Perpetuals', futures.filter(f => typeof f.symbol === 'string' && f.symbol.endsWith('_USDC')), 'futures')}
      </div>
    </div>
  )
}


