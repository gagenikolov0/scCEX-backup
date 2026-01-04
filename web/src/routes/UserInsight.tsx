import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
    Container,
    Grid,
    Paper,
    Text,
    Group,
    Stack,
    Avatar,
    Badge,
    Title,
    Table,
    Loader,
    Center,
    ThemeIcon,
} from '@mantine/core'
import { IconHistory, IconTrendingUp, IconTrendingDown, IconWallet, IconCalendarTime, IconChartBar, IconHash } from '@tabler/icons-react'
import { API_BASE } from '../config/api'
import { useAuth } from '../contexts/AuthContext'
import { CountUp } from '../components/CountUp'

export default function UserInsight() {
    const { username } = useParams()
    const { accessToken } = useAuth()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchInsight = async () => {
            setLoading(true)
            try {
                const res = await fetch(`${API_BASE}/api/user/insight/${username}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                })
                if (!res.ok) throw new Error('Trader not found or insight restricted')
                const json = await res.json()
                setData(json)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }

        if (username) fetchInsight()
    }, [username, accessToken])

    if (loading) return <Center h="80vh"><Loader size="xl" variant="dots" /></Center>
    if (error) return <Center h="80vh"><Stack align="center"><Title order={2}>404</Title><Text c="dimmed">{error}</Text></Stack></Center>

    return (
        <Container size="xl" py="xl">
            <Stack gap="xl">
                {/* Profile Header Block */}
                <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, var(--bg-1) 0%, var(--bg-2) 100%)', border: '1px solid var(--border-1)' }}>
                    <Group justify="space-between" align="center">
                        <Group gap="xl">
                            <Avatar src={data.user.profilePicture} size={100} radius="xl" style={{ border: '4px solid var(--mantine-primary-color-filled)', boxShadow: 'var(--mantine-shadow-xl)' }} />
                            <Stack gap={4}>
                                <Title order={1} fw={900} style={{ letterSpacing: '-0.02em' }}>{data.user.username}</Title>
                                <Group gap="xs">
                                    <Badge variant="dot" color="blue">Institutional TRADER</Badge>
                                    <Group gap={4}>
                                        <IconCalendarTime size={14} color="var(--mantine-color-dimmed)" />
                                        <Text size="xs" c="dimmed">Joined {new Date(data.user.createdAt).toLocaleDateString()}</Text>
                                    </Group>
                                </Group>
                            </Stack>
                        </Group>

                        <Stack gap={0} align="flex-end">
                            <Text size="xs" fw={700} c="dimmed" tt="uppercase">Estimated Net Worth</Text>
                            <CountUp
                                end={data.balances.totalPortfolioUSD}
                                prefix="$"
                                decimals={2}
                                style={{ fontSize: 34 }}
                                fw={950}
                                className="text-glow"
                            />
                        </Stack>
                    </Group>
                </Paper>

                <Grid gutter="md">
                    {/* Left Column: Balances & History */}
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Stack gap="md">
                            {/* Active Positions */}
                            <Paper p="md" radius="md" withBorder>
                                <Group mb="md" justify="space-between">
                                    <Group gap="xs">
                                        <ThemeIcon variant="light" color="blue"><IconChartBar size={18} /></ThemeIcon>
                                        <Title order={4}>Active Futures Positions</Title>
                                    </Group>
                                    <Badge variant="filled" color="blue" size="lg">{data.activePositions.length}</Badge>
                                </Group>

                                <div style={{ overflowX: 'auto' }}>
                                    <Table verticalSpacing="sm">
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Symbol</Table.Th>
                                                <Table.Th>Size</Table.Th>
                                                <Table.Th>Entry Price</Table.Th>
                                                <Table.Th>PnL (ROE%)</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {(data.activePositions || []).map((pos: any, i: number) => (
                                                <Table.Tr key={i}>
                                                    <Table.Td>
                                                        <Group gap="xs">
                                                            <Badge color={(pos.side || 'long') === 'long' ? 'green' : 'red'}>{(pos.side || 'long').toUpperCase()}</Badge>
                                                            <Text fw={700} size="sm">{pos.symbol}</Text>
                                                            <Text size="xs" c="dimmed">{pos.leverage}x</Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm" fw={500}>{pos.quantity} {pos.symbol.split('_')[0]}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm">${pos.entryPrice.toLocaleString()}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm" color={pos.realizedPnL >= 0 ? 'green' : 'red'} fw={700}>
                                                            {pos.realizedPnL >= 0 ? '+' : ''}{pos.realizedPnL.toLocaleString()} USDT
                                                        </Text>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                            {data.activePositions.length === 0 && (
                                                <Table.Tr><Table.Td colSpan={4} align="center"><Text c="dimmed" py="xl">No active positions</Text></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </div>
                            </Paper>

                            {/* Trade History */}
                            <Paper p="md" radius="md" withBorder>
                                <Group mb="md" gap="xs">
                                    <ThemeIcon variant="light" color="gray"><IconHistory size={18} /></ThemeIcon>
                                    <Title order={4}>Recent Realized Performance</Title>
                                </Group>

                                <div style={{ overflowX: 'auto' }}>
                                    <Table verticalSpacing="sm">
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Asset</Table.Th>
                                                <Table.Th>Exit Price</Table.Th>
                                                <Table.Th>Realized PnL</Table.Th>
                                                <Table.Th>Date</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {(data.history || []).map((h: any, i: number) => (
                                                <Table.Tr key={i}>
                                                    <Table.Td>
                                                        <Group gap="xs">
                                                            <Text fw={700} size="sm">{h.symbol}</Text>
                                                            <Badge size="xs" variant="outline" color={(h.side || 'long') === 'long' ? 'green' : 'red'}>{(h.side || 'long').toUpperCase()}</Badge>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm">${h.exitPrice.toLocaleString()}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4}>
                                                            {(h.realizedPnL ?? 0) >= 0 ? <IconTrendingUp size={14} color="green" /> : <IconTrendingDown size={14} color="red" />}
                                                            <input type="hidden" /> {/* Spacer */}
                                                            <Text size="sm" color={(h.realizedPnL ?? 0) >= 0 ? 'green' : 'red'} fw={700}>
                                                                {(h.realizedPnL ?? 0) >= 0 ? '+' : ''}{(h.realizedPnL ?? 0).toFixed(2)} USDT
                                                            </Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="xs" c="dimmed">{new Date(h.closedAt).toLocaleDateString()}</Text>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                </div>
                            </Paper>
                        </Stack>
                    </Grid.Col>

                    {/* Right Column: Asset Allocation */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Stack gap="md">
                            <Paper p="md" radius="md" withBorder>
                                <Group mb="md" gap="xs">
                                    <ThemeIcon variant="light" color="green"><IconWallet size={18} /></ThemeIcon>
                                    <Title order={4}>Spot Holdings</Title>
                                </Group>
                                <Stack gap="xs">
                                    {(data.balances?.spot || []).map((s: any, i: number) => (
                                        <Paper key={i} p="sm" radius="sm" style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)' }}>
                                            <Group justify="space-between">
                                                <Group gap="sm">
                                                    <ThemeIcon radius="xl" size="sm" variant="outline"><IconHash size={12} /></ThemeIcon>
                                                    <Text fw={700} size="sm">{s.asset}</Text>
                                                </Group>
                                                <Text fw={800} size="sm">{parseFloat(s.available).toLocaleString()}</Text>
                                            </Group>
                                        </Paper>
                                    ))}
                                    {data.balances.spot.length === 0 && <Text c="dimmed" ta="center">No active spot assets</Text>}
                                </Stack>
                            </Paper>

                            <Paper p="md" radius="md" withBorder style={{ background: 'rgba(51, 154, 240, 0.03)' }}>
                                <Title order={5} mb="sm" c="blue" tt="uppercase" style={{ letterSpacing: '0.1em' }}>Futures Margin</Title>
                                <Stack gap="xs">
                                    {(data.balances?.futures || []).map((f: any, i: number) => (
                                        <Group key={i} justify="space-between">
                                            <Text size="sm" fw={500}>{f.asset}</Text>
                                            <Text size="sm" fw={700}>{parseFloat(f.available).toLocaleString()} {f.asset}</Text>
                                        </Group>
                                    ))}
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Stack>
        </Container>
    )
}
