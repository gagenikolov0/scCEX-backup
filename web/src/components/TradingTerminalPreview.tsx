import { Box, Flex, Text, Stack, Badge } from '@mantine/core'
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
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)'
            }}
        >
            {/* Header */}
            <Flex justify="space-between" align="center" p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Flex gap="sm" align="center">
                    <Text fw={700} c="var(--mantine-color-text)">Market Pair</Text>
                    <Badge color="green" variant="light" size="xs">+5.42%</Badge>
                </Flex>
                <Flex gap="xs">
                    <Box w={8} h={8} bg="red" style={{ borderRadius: '50%', opacity: 0.5 }} />
                    <Box w={8} h={8} bg="yellow" style={{ borderRadius: '50%', opacity: 0.5 }} />
                    <Box w={8} h={8} bg="green" style={{ borderRadius: '50%', opacity: 0.5 }} />
                </Flex>
            </Flex>

            <Flex h="100%">
                {/* Chart Area (Mock) */}
                <Box style={{ flex: 1, padding: '20px', position: 'relative' }}>
                    <Flex align="center" justify="center" h="80%" direction="column" gap="md" c="dimmed" style={{ opacity: 0.3 }}>
                        <IconChartCandle size={60} />
                        <Text size="sm">Real-time matching engine</Text>
                    </Flex>
                </Box>

                {/* Sidebar (Order Book Mock) */}
                <Box w={120} style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }} p="xs">
                    <Stack gap={4}>
                        {[...Array(6)].map((_, i) => (
                            <Flex key={`sell-${i}`} justify="space-between">
                                <Box w={20 + i * 5} h={4} bg="rgba(255,0,0,0.1)" />
                                <Box w={10 + i * 2} h={4} bg="rgba(255,255,255,0.05)" />
                            </Flex>
                        ))}
                        <Box h={1} bg="rgba(255,255,255,0.1)" my={4} />
                        {[...Array(6)].map((_, i) => (
                            <Flex key={`buy-${i}`} justify="space-between">
                                <Box w={30 - i * 5} h={4} bg="rgba(0,255,0,0.1)" />
                                <Box w={15 - i * 2} h={4} bg="rgba(255,255,255,0.05)" />
                            </Flex>
                        ))}
                    </Stack>
                </Box>
            </Flex>
        </Box>
    )
}
