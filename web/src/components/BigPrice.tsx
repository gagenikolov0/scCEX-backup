import { useEffect, useState } from 'react'
import { Text, useMantineColorScheme } from '@mantine/core'
import { API_BASE } from '../config/api'
import { usePrice } from '../contexts/PriceContext'

interface BigPriceProps {
    symbol: string
    className?: string
    market?: 'spot' | 'futures'
}

export default function BigPrice({ symbol, className, market = 'futures' }: BigPriceProps) {
    const [price, setPrice] = useState<number | null>(null)
    const [openPrice, setOpenPrice] = useState<number | null>(null)
    const [color, setColor] = useState('gray')
    const { colorScheme } = useMantineColorScheme()

    // Centralized WS update
    const tick = usePrice(market, symbol)

    useEffect(() => {
        if (tick) {
            setPrice(tick.price)
            setOpenPrice(tick.open)
        }
    }, [tick])

    useEffect(() => {
        let mounted = true

        // Initial fetch for faster first render
        const fetchInitialOpen = async () => {
            try {
                const klinePath = 'spot/klines'
                const cleanSym = symbol.replace('_', '')
                const url = `${API_BASE}/api/markets/${klinePath}?symbol=${cleanSym}&interval=1m&limit=1`

                const res = await fetch(url)
                if (!res.ok) return

                const data = await res.json()
                if (Array.isArray(data) && data.length > 0) {
                    const latest = data[data.length - 1]
                    const o = parseFloat(latest[1])
                    const c = parseFloat(latest[4])
                    if (mounted) {
                        setOpenPrice(o)
                        setPrice(c)
                    }
                }
            } catch (e) {
                console.error("[BigPrice] Initial fetch failed", e)
            }
        }

        fetchInitialOpen()
        return () => { mounted = false }
    }, [symbol, market])

    useEffect(() => {
        if (price === null || openPrice === null) return
        if (price > openPrice) {
            setColor('var(--beautygreen)')
        } else if (price < openPrice) {
            setColor('var(--beautyred)')
        } else {
            setColor('var(--foreground)')
        }
    }, [price, openPrice, colorScheme])

    if (!price) return <span className="text-gray-400 text-sm"></span>

    return (
        <Text
            component="span"
            fw={750}
            c={color}
            style={{ fontSize: '1.6rem', lineHeight: 1 }}
            className={`${className} transition-colors duration-200`}
        >
            {price.toFixed(market === 'futures' ? 1 : 2)}
        </Text>
    )
}

