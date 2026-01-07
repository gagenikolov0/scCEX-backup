import { useState } from 'react'
import { Box, ThemeIcon, rem } from '@mantine/core'

interface CryptoIconProps {
    symbol: string
    size?: number | string
    className?: string
    style?: React.CSSProperties
}

export const ICON_SOURCES = [
    (s: string) => `https://assets.coincap.io/assets/icons/${s.toLowerCase()}@2x.png`,
    (s: string) => `https://static.okx.com/cdn/oksupport/asset/currency/icon/${s.toLowerCase()}.png`,
    (s: string) => `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${s.toLowerCase()}.png`,
]

export const getPrimaryAssetIconUrl = (symbol: string) => ICON_SOURCES[0](symbol)

export const CryptoIcon = ({ symbol, size = 24, className, style }: CryptoIconProps) => {
    const [sourceIndex, setSourceIndex] = useState(0)
    const [failed, setFailed] = useState(false)

    const handleError = () => {
        if (sourceIndex < ICON_SOURCES.length - 1) {
            setSourceIndex(prev => prev + 1)
        } else {
            setFailed(true)
        }
    }

    const iconSize = typeof size === 'string' ? size : rem(size)

    if (failed || !symbol) {
        // Fallback: Circular avatar with first letter
        return (
            <ThemeIcon
                variant="light"
                color="gray"
                size={size}
                radius="xl"
                className={className}
                style={{
                    ...style,
                    fontSize: typeof size === 'number' ? rem(size * 0.5) : '0.8em',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                }}
            >
                {symbol?.charAt(0) || '?'}
            </ThemeIcon>
        )
    }

    return (
        <Box
            className={className}
            style={{
                width: iconSize,
                height: iconSize,
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: 'rgba(255,255,255,0.05)',
                ...style
            }}
        >
            <img
                src={ICON_SOURCES[sourceIndex](symbol)}
                alt={symbol}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={handleError}
            />
        </Box>
    )
}
