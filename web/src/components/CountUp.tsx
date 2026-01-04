import { useEffect, useRef, useState } from 'react'
import { Text } from '@mantine/core'
import type { TextProps } from '@mantine/core'

interface CountUpProps extends TextProps {
    end: number
    suffix?: string
    prefix?: string
    duration?: number
    decimals?: number
}

export function CountUp({ end, suffix = '', prefix = '', duration = 2000, decimals = 0, ...props }: CountUpProps) {
    const [count, setCount] = useState(0)
    const elementRef = useRef<HTMLDivElement>(null)
    const hasAnimated = useRef(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true
                    let startTimestamp: number | null = null
                    const step = (timestamp: number) => {
                        if (!startTimestamp) startTimestamp = timestamp
                        const progress = Math.min((timestamp - startTimestamp) / duration, 1)

                        // Ease out quart
                        const ease = 1 - Math.pow(1 - progress, 4)

                        setCount(end * ease)

                        if (progress < 1) {
                            window.requestAnimationFrame(step)
                        }
                    }
                    window.requestAnimationFrame(step)
                }
            },
            { threshold: 0.5 }
        )

        if (elementRef.current) {
            observer.observe(elementRef.current)
        }

        return () => observer.disconnect()
    }, [end, duration])

    return (
        <Text ref={elementRef} {...props}>
            {prefix}{count.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
        </Text>
    )
}
