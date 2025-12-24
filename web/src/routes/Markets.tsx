import { useMemo, useState, useEffect } from 'react'
import { Card, TextInput, Anchor } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useMarket } from '../contexts/MarketContext'

function splitSymbol(sym: string): { base: string; quote: string } {
  if (sym.endsWith('USDT')) return { base: sym.slice(0, -4), quote: 'USDT' }
  if (sym.endsWith('USDC')) return { base: sym.slice(0, -4), quote: 'USDC' }
  return { base: sym, quote: '' }
}

export default function Markets() {
  const { spotStats, futuresStats, listen, unlisten } = useMarket()
  const [q, setQ] = useState('')

  useEffect(() => {
    listen()
    return () => unlisten()
  }, [])

  const filterFn = (t: any) => !q || t.symbol.toLowerCase().includes(q.toLowerCase())

  const spotUSDT = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDT')).filter(filterFn), [spotStats, q])
  const spotUSDC = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDC')).filter(filterFn), [spotStats, q])

  const renderMarketCard = (title: string, data: any[], type: 'spot' | 'futures') => (
    <Card padding={0} radius="md" withBorder shadow="xs">
      <div className="p-3 border-b text-sm font-semibold bg-neutral-50 dark:bg-neutral-900/50 flex justify-between">
        <span>{title}</span>
        <span className="text-neutral-500 font-normal">24h Change</span>
      </div>
      <div className="divide-y max-h-[440px] overflow-auto">
        {data.map(item => {
          let base: string = '', quote: string = '', price: string = '', change: string | number = 0, high: string = '', low: string = '', vol: string = ''

          const baseInfo = type === 'spot' ? splitSymbol(item.symbol) : { base: item.symbol.replace('_USDT', '').replace('_USDC', '').replace('_', '/'), quote: item.symbol.includes('_USDT') ? 'USDT' : 'USDC' }
          base = baseInfo.base
          quote = baseInfo.quote
          price = item.lastPrice ?? ''
          change = item.change24h ?? 0
          high = item.high24h ?? ''
          low = item.low24h ?? ''
          vol = item.volume24h ? parseFloat(item.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 }) : ''

          const changeNum = parseFloat(String(change)) || 0
          const changeColor = changeNum > 0 ? 'text-green-500' : changeNum < 0 ? 'text-[#FF4761]' : 'text-neutral-500'

          return (
            <Anchor key={`${type}-${quote.toLowerCase()}-${item.symbol}`} component={Link} to={`/${type}?base=${base.replace('/', '_')}&quote=${quote}`} underline="never" c="inherit" className="flex flex-col px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>{base}</span>
                  <span className="text-xs font-normal text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{quote}</span>
                </div>
                <div className={`text-sm font-bold tabular-nums ${changeColor}`}>
                  {changeNum > 0 ? '+' : ''}{changeNum.toFixed(2)}%
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-lg font-mono tabular-nums leading-none">{price}</div>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="text-[10px] text-neutral-400 font-mono uppercase tracking-tighter">
                    <span className="text-green-500/70">H </span>{high} <span className="ml-1 text-red-500/70">L </span>{low}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono flex gap-1 items-center">
                    <span className="opacity-70">VOL</span> {vol}
                  </div>
                </div>
              </div>
            </Anchor>
          )
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
        {renderMarketCard('Futures · USDT Perpetuals', futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDT')), 'futures')}
        {renderMarketCard('Futures · USDC Perpetuals', futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDC')), 'futures')}
      </div>
    </div>
  )
}


