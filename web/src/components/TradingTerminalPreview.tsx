import { Box, Flex, Text, Stack } from '@mantine/core'
import { IconChartCandle } from '@tabler/icons-react'

export function TradingTerminalPreview() {
    return (
        <Box
            className="glass-card"
            style={{
                width: '100%',
                height: '400px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.6)'
            }}
        >
            {/* Header */}
            <Flex justify="space-between" align="center" p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Flex gap="sm" align="center">
                    <Text fw={700} c="white">BTC/USDT</Text>
                    <Text c="green" fw={700} size="sm">+5.42%</Text>
                </Flex>
                <Flex gap="xs">
                    <Box w={12} h={12} bg="red" style={{ borderRadius: '50%', opacity: 0.5 }} />
                    <Box w={12} h={12} bg="yellow" style={{ borderRadius: '50%', opacity: 0.5 }} />
                    <Box w={12} h={12} bg="green" style={{ borderRadius: '50%', opacity: 0.5 }} />
                </Flex>
            </Flex>

            <Flex h="100%">
                {/* Chart Area (Mock) */}
                <Box style={{ flex: 1, padding: '20px', position: 'relative' }}>
                    <Flex align="center" justify="center" h="80%" direction="column" gap="md" c="dimmed" style={{ opacity: 0.3 }}>
                        <IconChartCandle size={80} />
                        <Text>Advanced Charting Engine</Text>
                    </Flex>

                    {/* Simulated Candle Animation Overlay */}
                    <Box style={{
                        position: 'absolute', bottom: '100px', left: '20%', width: '10px', height: '60px', bg: 'green',
                        animation: 'pulse 2s infinite'
                    }} />
                </Box>

                {/* Sidebar (Order Book Mock) */}
                <Box w={140} style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }} p="xs">
                    <Stack gap={4}>
                        {[...Array(8)].map((_, i) => (
                            <Flex key={`sell-${i}`} justify="space-between">
                                <Text size="xs" c="red">{(98000 + i * 50).toLocaleString()}</Text>
                                <Text size="xs" c="dimmed">{(Math.random()).toFixed(3)}</Text>
                            </Flex>
                        ))}
                        <Text size="lg" fw={700} c="green" my={8} ta="center">98,420</Text>
                        {[...Array(8)].map((_, i) => (
                            <Flex key={`buy-${i}`} justify="space-between">
                                <Text size="xs" c="green">{(98000 - i * 50).toLocaleString()}</Text>
                                <Text size="xs" c="dimmed">{(Math.random()).toFixed(3)}</Text>
                            </Flex>
                        ))}
                    </Stack>
                </Box>
            </Flex>
        </Box>
    )
}
