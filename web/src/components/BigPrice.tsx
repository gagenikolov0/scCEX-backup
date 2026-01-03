import { useEffect, useState } from 'react'
import { Text } from '@mantine/core'
import { usePrice } from '../contexts/PriceContext'

interface BigPriceProps {
    symbol: string
    market?: 'spot' | 'futures'
}

export default function BigPrice({ symbol, market = 'futures' }: BigPriceProps) {
    const [price, setPrice] = useState<number | null>(null)
    const [openPrice, setOpenPrice] = useState<number | null>(null)
    const [color, setColor] = useState('gray')

    // Centralized WS update
    const tick = usePrice(market, symbol)

    useEffect(() => {
        if (tick) {
            setPrice(tick.price)
            setOpenPrice(tick.open)
        }
    }, [tick])

    // Initial fetch removed to prevent console errors/spam.
    // We rely solely on the WebSocket connection (usePrice) which connects rapidly.

    useEffect(() => {
        if (price === null || openPrice === null) return
        if (price > openPrice) {
            setColor('var(--green)')
        } else if (price < openPrice) {
            setColor('var(--red)')
        } else {
            setColor('dimmed')
        }
    }, [price, openPrice])

    if (!price) return null

    return (
        <Text
            component="span"
            fw={750}
            c={color}
            style={{ fontSize: '1.6rem', lineHeight: 1 }}
        >
            {price < 0.1 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toFixed(2)}
        </Text>
    )
}
