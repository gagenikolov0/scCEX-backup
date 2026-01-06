import { useEffect, useState, memo } from 'react'
import { API_BASE } from '../config/api'
import { Box, Text, SimpleGrid } from '@mantine/core'

type Trade = {
    price: number
    qty: number
    time: number
    side: 'buy' | 'sell'
}

type MarketTradesProps = {
    symbol: string
    market: 'spot' | 'futures'
}

const TradeRow = memo(({ trade, market }: { trade: Trade, market: 'spot' | 'futures' }) => {
    const isBuy = trade.side === 'buy'
    // Format: HH:mm:ss
    const timeStr = new Date(trade.time).toLocaleTimeString(undefined, { hour12: false })

    return (
        <Box
            style={{
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background-color 0.1s ease'
            }}
            mod={{ 'data-hover': true }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            <SimpleGrid cols={3} spacing={9} verticalSpacing={2} px={4} py={1}>
                <Text size="xs" fw={700} c={isBuy ? "var(--green)" : "var(--red)"}>
                    {trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text size="xs" ta="right">
                    {trade.qty.toFixed(market === 'spot' ? 4 : 0)}
                </Text>
                <Text size="xs" c="dimmed" ta="right">{timeStr}</Text>
            </SimpleGrid>
        </Box>
    )
})

export default function MarketTrades({ symbol, market, depth = 30 }: MarketTradesProps & { depth?: number }) {
    const [trades, setTrades] = useState<Trade[]>([])
    const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting')

    useEffect(() => {
        if (!symbol) return

        setTrades([])
        setStatus('connecting')

        const wsBase = API_BASE.replace(/^http/, 'ws')
        const path = market === 'futures' ? '/ws/futures-trades' : '/ws/spot-trades'
        const sym = market === 'futures'
            ? (symbol.includes('_') ? symbol : symbol.replace(/(USDT|USDC)$/i, '_$1'))
            : symbol.replace('_', '')

        let ws: WebSocket | null = null
        let stopped = false

        const connect = () => {
            if (stopped) return
            try {
                ws = new WebSocket(`${wsBase}${path}`)
                ws.onopen = () => {
                    if (stopped) { try { ws?.close() } catch { }; return }
                    setStatus('open')
                    try { ws?.send(JSON.stringify({ type: 'sub', symbol: sym })) } catch { }
                }
                ws.onmessage = (ev) => {
                    try {
                        if (stopped) return
                        const msg = JSON.parse(String(ev.data))
                        if (msg.type === 'trades' && msg.symbol === sym && Array.isArray(msg.data)) {
                            // Slice immediately to Keep it efficient? Or just slice on render.
                            // The backend sends 50. We render 'depth'.
                            setTrades(msg.data)
                        }
                    } catch { }
                }
                ws.onerror = () => { if (!stopped) setStatus('error') }
                ws.onclose = () => {
                    if (!stopped) {
                        setStatus('closed')
                        setTimeout(connect, 3000)
                    }
                }
            } catch {
                if (!stopped) setTimeout(connect, 3000)
            }
        }

        connect()

        return () => {
            stopped = true
            if (ws) {
                try { ws.send(JSON.stringify({ type: 'unsub', symbol: sym })) } catch { }
                ws.close()
            }
        }
    }, [symbol, market])

    return (
        <Box h="100%" display="flex" style={{ flexDirection: 'column', overflow: 'hidden' }}>
            <SimpleGrid cols={3} spacing={4} mb={8} px="sm" mt="xs">
                <Text size="xs" c="dimmed" fw={700}>Price({market === 'futures' ? 'USDT' : symbol.split(/(USDT|USDC)/)[1]})</Text>
                <Text size="xs" c="dimmed" fw={700} ta="right">Qty</Text>
                <Text size="xs" c="dimmed" fw={700} ta="right">Time</Text>
            </SimpleGrid>

            {status === 'connecting' && <Text size="xs" c="dimmed" px="sm">Connecting...</Text>}

            <Box style={{ flex: 1, overflow: 'hidden' }} px="sm" pb="sm">
                {trades.slice(0, depth).map((t, i) => (
                    <TradeRow key={`${t.time}-${i}`} trade={t} market={market} />
                ))}
            </Box>
        </Box>
    )
}
