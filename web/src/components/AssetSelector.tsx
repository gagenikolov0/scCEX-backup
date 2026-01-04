import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useCallback } from 'react'
import {
    Box,
    Text,
    TextInput,
    Group,
    UnstyledButton,
    ThemeIcon
} from '@mantine/core'
import {
    IconSearch,
    IconX,
    IconActivity,
    IconChevronDown,
    IconChevronUp,
    IconBolt
} from '@tabler/icons-react'
import { Virtuoso } from 'react-virtuoso'

interface AssetSelectorProps {
    currentSymbol: string
    currentQuote: string
    market: 'spot' | 'futures'
    stats: any[]
    onSelect: (base: string) => void
}

// Memoized Row for Performance
const AssetRow = React.memo(({
    asset,
    onSelect,
    currentQuote,
    cleanBase
}: {
    asset: any,
    onSelect: (b: string) => void,
    currentQuote: string,
    cleanBase: (s: string) => string
}) => {
    const base = cleanBase(asset.symbol)
    const change = parseFloat(asset.change24h || 0)
    const isPositive = change >= 0

    return (
        <UnstyledButton
            onClick={() => onSelect(base)}
            style={{
                display: 'block',
                width: '100%',
                padding: '12px 16px',
                transition: 'background 0.1s ease',
                borderBottom: '1px solid var(--glass-border)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mantine-color-default-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="gray" variant="light" size="sm" radius="xl">
                        <IconActivity size={12} />
                    </ThemeIcon>
                    <Box>
                        <Group gap={4}>
                            <Text size="sm" fw={700}>{base}</Text>
                        </Group>
                        <Text size="10px" c="dimmed">{currentQuote}</Text>
                    </Box>
                </Group>

                <Group gap={24} wrap="nowrap">
                    <Text size="sm" fw={600} ff="monospace" c="var(--mantine-color-text)">
                        {parseFloat(asset.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </Text>
                    <Text size="xs" fw={700} c={isPositive ? 'green' : 'red'} w={60} ta="right">
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                    </Text>
                </Group>
            </Group>
        </UnstyledButton>
    )
})

export const AssetSelector = React.memo(({ currentSymbol, currentQuote, market, stats, onSelect }: AssetSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const deferredQuery = useDeferredValue(query)
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const searchRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Keyboard shortcut Ctrl+K
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
                setTimeout(() => searchRef.current?.focus(), 50)
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [])

    // HIGH PERFORMANCE: Filter gating & Virtualization
    const filteredStats = useMemo(() => {
        // If not open, return empty to save processing
        if (!isOpen) return []

        let list = stats.filter(s => s.symbol.endsWith(currentQuote))

        if (deferredQuery) {
            const q = deferredQuery.toLowerCase()
            list = list.filter(s => s.symbol.toLowerCase().includes(q))
        }

        if (activeCategory === 'gainers') {
            list = [...list].sort((a, b) => (parseFloat(b.change24h || 0) - parseFloat(a.change24h || 0)))
        } else if (activeCategory === 'volume') {
            list = [...list].sort((a, b) => (parseFloat(b.volume24h || 0) - parseFloat(a.volume24h || 0)))
        }

        return list
    }, [stats, deferredQuery, currentQuote, activeCategory, isOpen])

    const cleanBase = useCallback((sym: string) => sym.replace('_', '').replace(currentQuote, ''), [currentQuote])

    return (
        <Box ref={containerRef} style={{ position: 'relative', zIndex: 1000 }}>
            <UnstyledButton
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    height: '56px',
                    padding: '0 8px',
                    borderRadius: '12px',
                    background: 'transparent',
                    border: 'none',
                    transition: 'all 0.2s ease'
                }}
            >
                <Group gap="md">
                    <ThemeIcon
                        variant="light"
                        color={market === 'futures' ? 'orange' : 'blue'}
                        size="md"
                        radius="md"
                    >
                        {market === 'futures' ? <IconActivity size={18} /> : <IconBolt size={18} />}
                    </ThemeIcon>
                    <Box>
                        <Group gap={4}>
                            <Text fw={700} size="xl" c="var(--mantine-color-text)">{currentSymbol}{currentQuote}</Text>
                            <Box style={{ color: 'var(--mantine-color-dimmed)' }}>
                                {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            </Box>
                        </Group>
                        <Text size="10px" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: '1px' }}>
                            {market === 'futures' ? 'Perpetual' : 'Spot Market'}
                        </Text>
                    </Box>
                </Group>
            </UnstyledButton>

            {/* Asset Portal Popover */}
            {isOpen && (
                <Box
                    className="glass-card"
                    style={{
                        position: 'absolute',
                        top: '64px',
                        left: '0',
                        width: '400px',
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(var(--glass-blur))',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '20px',
                        boxShadow: '0 20px 50px var(--glass-shadow)',
                        overflow: 'hidden',
                        height: '520px' // Fix height for Virtuoso
                    }}
                >
                    {/* Header Search */}
                    <Box p="md" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <TextInput
                            ref={searchRef}
                            placeholder="Search assets..."
                            leftSection={<IconSearch size={16} color="var(--mantine-color-blue-4)" />}
                            rightSection={
                                <Group gap={6} px="xs">
                                    {query && (
                                        <UnstyledButton onClick={() => setQuery('')}>
                                            <IconX size={14} color="var(--mantine-color-dimmed)" />
                                        </UnstyledButton>
                                    )}
                                    <Box visibleFrom="sm" style={{ background: 'var(--mantine-color-default-hover)', borderRadius: '4px', padding: '2px 4px' }}>
                                        <Text size="10px" fw={700} c="dimmed">Ctrl + K</Text>
                                    </Box>
                                </Group>
                            }
                            rightSectionWidth={90}
                            value={query}
                            onChange={(e) => setQuery(e.currentTarget.value)}
                            variant="unstyled"
                            styles={{
                                input: {
                                    background: 'var(--mantine-color-default-hover)',
                                    paddingLeft: '40px',
                                    height: '44px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--mantine-color-text)'
                                }
                            }}
                        />
                    </Box>

                    {/* Categories */}
                    <Box px="md" py="xs" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <Group gap="xs">
                            <UnstyledButton
                                onClick={() => setActiveCategory('all')}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: activeCategory === 'all' ? 'rgba(0, 150, 255, 0.1)' : 'transparent'
                                }}
                            >
                                <Text size="xs" fw={700} c={activeCategory === 'all' ? 'blue' : 'dimmed'}>Market</Text>
                            </UnstyledButton>
                            <UnstyledButton
                                onClick={() => setActiveCategory('gainers')}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: activeCategory === 'gainers' ? 'rgba(0, 255, 150, 0.1)' : 'transparent'
                                }}
                            >
                                <Text size="xs" fw={700} c={activeCategory === 'gainers' ? 'green' : 'dimmed'}>Gainers</Text>
                            </UnstyledButton>
                            <UnstyledButton
                                onClick={() => setActiveCategory('volume')}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: activeCategory === 'volume' ? 'rgba(255, 150, 0, 0.1)' : 'transparent'
                                }}
                            >
                                <Text size="xs" fw={700} c={activeCategory === 'volume' ? 'orange' : 'dimmed'}>Volume</Text>
                            </UnstyledButton>
                        </Group>
                    </Box>

                    {/* Content Head */}
                    <Group px="md" py="xs" justify="space-between" align="center" style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--mantine-color-body)' }}>
                        <Text size="xs" fw={600} c="dimmed">Asset</Text>
                        <Group gap={40}>
                            <Text size="xs" fw={600} c="dimmed">Price</Text>
                            <Text size="xs" fw={600} c="dimmed" w={60} ta="right">Change</Text>
                        </Group>
                    </Group>

                    {/* VIRTUALIZED Asset List */}
                    <Box style={{ height: '360px' }}>
                        <Virtuoso
                            style={{ height: '360px' }}
                            data={filteredStats}
                            itemContent={(_, asset) => (
                                <AssetRow
                                    key={asset.symbol}
                                    asset={asset}
                                    onSelect={(base) => {
                                        onSelect(base)
                                        setIsOpen(false)
                                    }}
                                    currentQuote={currentQuote}
                                    cleanBase={cleanBase}
                                />
                            )}
                            components={{
                                EmptyPlaceholder: () => (
                                    <Box p="xl" ta="center">
                                        <Text c="dimmed" size="xs">No assets found</Text>
                                    </Box>
                                )
                            }}
                        />
                    </Box>
                </Box>
            )}
        </Box>
    )
})
