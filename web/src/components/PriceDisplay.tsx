import { useEffect, useState, useRef } from 'react'
import { Text } from '@mantine/core'

interface PriceDisplayProps {
    price: string | number | null | undefined
    size?: string
    className?: string
}

export default function PriceDisplay({ price, size = 'sm', className }: PriceDisplayProps) {
    const [colorClass, setColorClass] = useState('')
    const prevPriceRef = useRef<number | null>(null)

    const currentPrice = (typeof price === 'string' ? parseFloat(price) : price) ?? null
    const displayPrice = price ?? '-'

    useEffect(() => {
        if (currentPrice === null || isNaN(currentPrice)) return

        if (prevPriceRef.current !== null && currentPrice !== prevPriceRef.current) {
            const isUp = currentPrice > prevPriceRef.current
            setColorClass(isUp ? 'text-green-500 bg-green-50/50' : 'text-red-500 bg-red-50/50')

            const timer = setTimeout(() => {
                setColorClass('')
            }, 600)

            return () => clearTimeout(timer)
        }

        prevPriceRef.current = currentPrice as number
    }, [currentPrice])

    return (
        <Text
            size={size}
            className={`${className} transition-all duration-300 rounded px-1 ${colorClass}`}
            component="span"
        >
            {displayPrice}
        </Text>
    )
}
