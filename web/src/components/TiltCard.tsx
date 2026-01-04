import { Paper } from '@mantine/core'
import type { PaperProps } from '@mantine/core'
import React, { useRef, useState } from 'react'

interface TiltCardProps extends PaperProps {
    children: React.ReactNode
    tiltMaxAngleX?: number
    tiltMaxAngleY?: number
    onClick?: React.MouseEventHandler<HTMLDivElement>
}

export function TiltCard({
    children,
    tiltMaxAngleX = 10,
    tiltMaxAngleY = 10,
    className,
    style,
    ...props
}: TiltCardProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [transform, setTransform] = useState('')
    const [transition, setTransition] = useState('transform 0.1s ease-out')

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return

        const rect = ref.current.getBoundingClientRect()
        const width = rect.width
        const height = rect.height
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const xPct = mouseX / width - 0.5
        const yPct = mouseY / height - 0.5

        const x = yPct * tiltMaxAngleX * -1 // Invert rotation for natural feel
        const y = xPct * tiltMaxAngleY

        setTransform(`perspective(1000px) rotateX(${x}deg) rotateY(${y}deg) scale3d(1.02, 1.02, 1.02)`)
        setTransition('transform 0.1s ease-out')
    }

    const handleMouseLeave = () => {
        setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
        setTransition('transform 0.5s ease-out')
    }

    return (
        <Paper
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={className}
            style={{
                transform,
                transition,
                transformStyle: 'preserve-3d',
                willChange: 'transform',
                ...style
            }}
            {...props}
        >
            {children}
        </Paper>
    )
}
