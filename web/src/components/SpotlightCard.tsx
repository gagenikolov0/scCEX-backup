import { Box, Paper } from '@mantine/core'
import type { PaperProps } from '@mantine/core'
import React, { useRef, useState } from 'react'

interface SpotlightCardProps extends PaperProps {
    children: React.ReactNode
    spotlightColor?: string
    onClick?: React.MouseEventHandler<HTMLDivElement>
}

export function SpotlightCard({ children, spotlightColor = 'rgba(255, 255, 255, 0.1)', className, style, ...props }: SpotlightCardProps) {
    const divRef = useRef<HTMLDivElement>(null)
    const [opacity, setOpacity] = useState(0)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return

        const rect = divRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        divRef.current.style.setProperty('--x', `${x}px`)
        divRef.current.style.setProperty('--y', `${y}px`)
    }

    const handleMouseEnter = () => setOpacity(1)
    const handleMouseLeave = () => setOpacity(0)

    return (
        <Paper
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`glass-card ${className || ''}`}
            style={{
                position: 'relative',
                overflow: 'hidden',
                ...style
            } as React.CSSProperties}
            {...props}
        >
            <div
                style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity,
                    transition: 'opacity 0.3s',
                    background: `radial-gradient(600px circle at var(--x) var(--y), ${spotlightColor}, transparent 40%)`,
                    zIndex: 0
                }}
            />
            <Box style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </Box>
        </Paper>
    )
}
