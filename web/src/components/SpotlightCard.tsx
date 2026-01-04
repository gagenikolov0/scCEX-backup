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
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [opacity, setOpacity] = useState(0)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return

        const rect = divRef.current.getBoundingClientRect()
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
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
            }}
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
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
                    zIndex: 0
                }}
            />
            <Box style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </Box>
        </Paper>
    )
}
