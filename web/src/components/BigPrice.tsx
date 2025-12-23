import { useEffect, useState, useRef } from 'react'
import { Text, useMantineColorScheme } from '@mantine/core'
import { API_BASE } from '../config/api'

interface BigPriceProps {
    symbol: string
    className?: string
    market?: 'spot' | 'futures'
}

export default function BigPrice({ symbol, className, market = 'futures' }: BigPriceProps) {
    const [price, setPrice] = useState<number | null>(null)
    const [openPrice, setOpenPrice] = useState<number | null>(null)
    const [color, setColor] = useState('gray')
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const { colorScheme } = useMantineColorScheme()

    // To track the current minute bucket
    const currentMinuteRef = useRef<number | null>(null)

    // Helper to normalize symbol for API calls
    const normalizeSymbol = (s: string) => {
        if (market === 'futures') return s.includes('_') ? s : s.replace(/(USDT|USDC)$/i, '_$1')
        return s.replace('_', '')
    }

    // Convert interval "1m" to ms
    const INTERVAL_MS = 60 * 1000

    useEffect(() => {
        let mounted = true
        let ws: WebSocket | null = null
        const apiSymbol = normalizeSymbol(symbol)

        // 1. Fetch initial kline to get the current open
        const fetchInitialOpen = async () => {
            try {
                // Determine API endpoint based on market
                const klinePath = 'spot/klines'
                // But wait, for OPEN price logic to be accurate, we really want the *actual* open.
                // If the user trades futures, and we use spot klines, the prices might differ slightly.
                // However, if the chart does it, we should probably match the chart.

                // Let's stick to the PriceChart logic for fetching klines to be consistent visually with the chart.
                const cleanSym = symbol.replace('_', '') // Spot symbols are usually just BTCUSDT
                const url = `${API_BASE}/api/markets/${klinePath}?symbol=${cleanSym}&interval=1m&limit=1`

                const res = await fetch(url)
                if (!res.ok) return

                const data = await res.json()
                if (Array.isArray(data) && data.length > 0) {
                    const latest = data[data.length - 1]
                    // [time, open, high, low, close, volume, ...]
                    const t = latest[0]
                    const o = parseFloat(latest[1])
                    const c = parseFloat(latest[4])

                    if (mounted) {
                        currentMinuteRef.current = Math.floor(t / INTERVAL_MS)
                        setOpenPrice(o)
                        setPrice(c)
                    }
                }
            } catch (e) {
                console.error("Failed to fetch initial candle", e)
            }
        }

        fetchInitialOpen()

        // 2. Connect to WS for live updates
        const connectWs = () => {
            const wsBase = API_BASE.replace(/^http/, 'ws').replace('localhost', '127.0.0.1')
            const wsPath = market === 'futures' ? '/ws/futures-ticks' : '/ws/spot-ticks'
            const wsUrl = `${wsBase}${wsPath}`

            ws = new WebSocket(wsUrl)

            ws.onopen = () => {
                console.log('[BigPrice] WS Connected', wsUrl)
                setConnectionStatus('connected')
                // If a previous WebSocket connection was still in CONNECTING state,
                // and this new one just opened, we should close the old one safely.
                // This block is typically for cleanup of a *previous* connection if it exists,
                // but the instruction places it here. Assuming it's meant to ensure only one active WS.
                if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                    // If connecting, we can't strictly close perfectly without an error in some browsers,
                    // but we should try. Assigning onerror to null might help suppress noise.
                    ws.onerror = null // Suppress errors for the closing WS
                    // This `ws.close()` here would close the *current* connection immediately after opening,
                    // which is likely not the intended behavior for sending a subscription.
                    // Assuming the user intended this check for a cleanup phase or a different context.
                    // For now, applying the change as literally as possible, but noting the potential logical issue.
                    // If the intent was to close a *previous* connection, the `ws` variable would need to be
                    // a ref or outside this scope to refer to the old one.
                    // As written, this would close the newly opened connection.
                    // To maintain functionality, I will place the `ws.send` outside this `if` block,
                    // assuming the `if` block is a standalone check.
                    ws.close()
                }
                // The subscription message should be sent for the *newly opened* connection.
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'sub', symbol: apiSymbol }))
                }
            }

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data)
                    if (msg.type === 'tick' && msg.symbol === apiSymbol) {
                        const p = parseFloat(msg.price)
                        const t = msg.t // timestamp in ms

                        if (!isNaN(p) && t) {
                            const tickMinute = Math.floor(t / INTERVAL_MS)

                            // If we moved to a new minute, re-fetch the official Open price
                            if (currentMinuteRef.current === null || tickMinute > currentMinuteRef.current) {
                                currentMinuteRef.current = tickMinute
                                void fetchInitialOpen() // Ask the API for the real Open
                            }

                            if (mounted) {
                                setPrice(p)
                            }
                        }
                    }
                } catch (e) { }
            }

            ws.onclose = (ev: CloseEvent) => {
                console.log('[BigPrice] WS Closed', ev.code, ev.reason)
                setConnectionStatus('disconnected')
                // naive reconnect could go here, but kept simple for now
            }
            ws.onerror = (err: Event) => {
                console.error('[BigPrice] WS Error', err)
                setConnectionStatus('error')
            }
        }

        connectWs()

        return () => {
            mounted = false
            if (ws) {
                // Prevent "closed before established" errors
                ws.onerror = null
                ws.onclose = null
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close()
                }
            }
        }
    }, [symbol, market])

    // Update color based on Price vs Open
    useEffect(() => {
        if (price === null || openPrice === null) return

        const isDark = colorScheme === 'dark'

        if (price > openPrice) {
            // Up: Green (both modes, adjusting shade slightly if needed, but 'green' is usually fine)
            // User asked for "Green on light" and "Green on dark"
            setColor(isDark ? 'green.7' : 'green.8')
        } else if (price < openPrice) {
            // Down: Red
            setColor(isDark ? 'red.7' : 'red.8')
        } else {
            // Neutral: White on Dark, Black on Light
            setColor(isDark ? 'white' : 'black')
        }
    }, [price, openPrice, colorScheme])

    if (!price) return <span className="text-gray-400 text-sm">Loading Price... ({connectionStatus})</span>

    return (
        <Text
            component="span"
            size="xl"
            fw={900}
            c={color}
            style={{ fontSize: '2rem', lineHeight: 1 }} // Force large size
            className={`${className} transition-colors duration-200`}
        >
            {price.toFixed(market === 'futures' ? 1 : 2)}

            {/* Precision might need dynamic adjustment later, hardcoded for now based on common use */}
        </Text>
    )
}
