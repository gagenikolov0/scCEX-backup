import { useMemo, useState } from 'react'
import { Button, Box, Title, Text, Stack, SimpleGrid, Group, TextInput, NumberInput, Container, Paper, Select, ThemeIcon } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { API_BASE } from '../config/api'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { SpotlightCard } from '../components/SpotlightCard'
import { IconCurrencyEthereum, IconCurrencyBitcoin, IconCurrencySolana, IconHexagon, IconWallet, IconArrowRight, IconAlertTriangle } from '@tabler/icons-react'

// Reuse styles/icons from Deposit
const ASSETS = [
    { id: 'USDT', name: 'Tether', icon: IconHexagon, color: 'green' },
    { id: 'USDC', name: 'USD Coin', icon: IconHexagon, color: 'blue' },
    { id: 'BTC', name: 'Bitcoin', icon: IconCurrencyBitcoin, color: 'orange' },
    { id: 'ETH', name: 'Ethereum', icon: IconCurrencyEthereum, color: 'grape' },
    { id: 'SOL', name: 'Solana', icon: IconCurrencySolana, color: 'cyan' },
]

const CHAINS = [
    { id: 'ERC20', name: 'Ethereum (ERC20)' },
    { id: 'TRC20', name: 'Tron (TRC20)' },
    { id: 'BEP20', name: 'BSC (BEP20)' },
    { id: 'SOL', name: 'Solana' },
    { id: 'BTC', name: 'Bitcoin' },
]

export default function Withdraw() {
    const { spotAvailable, positions } = useAccount()
    const { accessToken } = useAuth()

    const [asset, setAsset] = useState<string>('USDT')
    const [network, setNetwork] = useState<string>('ERC20')
    const [address, setAddress] = useState('')
    const [amount, setAmount] = useState<string | number>('')
    const [loading, setLoading] = useState(false)

    // Calculate Max Balance based on Spot implementation
    const maxBalance = useMemo(() => {
        if (asset === 'USDT') return parseFloat(spotAvailable.USDT || '0')
        if (asset === 'USDC') return parseFloat(spotAvailable.USDC || '0')
        const pos = positions.find(p => p.asset === asset)
        return parseFloat(pos?.available || '0')
    }, [asset, spotAvailable, positions])

    const handleMax = () => {
        setAmount(maxBalance)
    }

    const handleWithdraw = async () => {
        if (!amount || parseFloat(amount.toString()) <= 0) return
        if (!address) return

        if (parseFloat(amount.toString()) > maxBalance) {
            notifications.show({ title: 'Error', message: 'Insufficient spot balance', color: 'red' })
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/user/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    asset,
                    network,
                    address,
                    amount: parseFloat(amount.toString())
                })
            })

            const j = await res.json()
            if (!res.ok) throw new Error(j.error || 'Withdrawal failed')

            notifications.show({ title: 'Success', message: 'Withdrawal request submitted', color: 'green' })
            setAmount('')
            setAddress('')
        } catch (e: any) {
            notifications.show({ title: 'Error', message: e.message, color: 'red' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Box style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 60px)' }}>
            <ParticlesBackground />

            <Container size="lg" py={60} style={{ position: 'relative', zIndex: 1 }}>
                <Stack gap={60} align="center">

                    <Stack align="center" gap="xs">
                        <Title order={1} size={48} className="text-glow">Withdraw Assets</Title>
                        <Text c="dimmed" size="lg">Send crypto to an external wallet</Text>
                    </Stack>

                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing={60} w="100%">

                        {/* Left Col: Asset Selection */}
                        <Stack gap="xl">
                            <SpotlightCard p="xl" radius="lg" className="glass-card no-move">
                                <Stack gap="lg">
                                    <Text fw={700} size="lg">1. Select Asset</Text>
                                    <SimpleGrid cols={3}>
                                        {ASSETS.map(a => {
                                            const isSelected = asset === a.id
                                            return (
                                                <Box
                                                    key={a.id}
                                                    onClick={() => setAsset(a.id)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        border: isSelected ? '1px solid var(--mantine-primary-color-5)' : '1px solid transparent',
                                                        background: isSelected ? 'var(--mantine-color-default-hover)' : 'transparent',
                                                        borderRadius: '12px',
                                                        padding: '12px',
                                                        textAlign: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Stack gap={4} align="center">
                                                        <ThemeIcon variant="light" color={a.color} radius="xl"><a.icon size={18} /></ThemeIcon>
                                                        <Text fw={700} size="sm">{a.id}</Text>
                                                    </Stack>
                                                </Box>
                                            )
                                        })}
                                    </SimpleGrid>

                                    <Text fw={700} size="lg" mt="md">2. Select Network</Text>
                                    <Select
                                        size="lg"
                                        data={CHAINS.map(c => ({ value: c.id, label: c.name }))}
                                        value={network}
                                        onChange={(v) => v && setNetwork(v)}
                                        classNames={{ input: 'glass-input' }}
                                    />
                                </Stack>
                            </SpotlightCard>

                            <SpotlightCard p="md" radius="md" className="glass-card" spotlightColor="rgba(255, 100, 100, 0.1)">
                                <Group>
                                    <IconAlertTriangle color="orange" size={24} />
                                    <Box style={{ flex: 1 }}>
                                        <Text size="sm" fw={700} c="orange">Security Warning</Text>
                                        <Text size="xs" c="dimmed">Ensure the network matches the receiving wallet. Transactions are irreversible.</Text>
                                    </Box>
                                </Group>
                            </SpotlightCard>
                        </Stack>

                        {/* Right Col: Details */}
                        <Stack gap="xl">
                            <SpotlightCard p="xl" radius="lg" className="glass-card no-move">
                                <Stack gap="lg">
                                    <Text fw={700} size="lg">3. Withdrawal Details</Text>

                                    <Stack gap={4}>
                                        <Text size="sm" fw={500}>Recipient Address</Text>
                                        <TextInput
                                            placeholder={`Enter ${asset} address`}
                                            size="lg"
                                            radius="md"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            classNames={{ input: 'glass-input' }}
                                            leftSection={<IconWallet size={18} />}
                                        />
                                    </Stack>

                                    <Stack gap={4}>
                                        <Group justify="space-between">
                                            <Text size="sm" fw={500}>Amount</Text>
                                            <Group gap={4}>
                                                <Text size="xs" c="dimmed">Available Spot:</Text>
                                                <Text size="xs" fw={700}>{maxBalance.toFixed(4)} {asset}</Text>
                                            </Group>
                                        </Group>
                                        <NumberInput
                                            size="lg"
                                            radius="md"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={setAmount}
                                            classNames={{ input: 'glass-input' }}
                                            rightSectionWidth={80}
                                            rightSection={
                                                <Button
                                                    variant="subtle"
                                                    size="xs"
                                                    onClick={handleMax}
                                                    style={{ margin: 4 }}
                                                >
                                                    MAX
                                                </Button>
                                            }
                                            min={0}
                                            max={maxBalance}
                                        />
                                    </Stack>

                                    <Button
                                        size="xl"
                                        radius="md"
                                        onClick={handleWithdraw}
                                        loading={loading}
                                        disabled={!address || !amount || parseFloat(amount.toString()) <= 0}
                                        rightSection={<IconArrowRight />}
                                        gradient={{ from: 'indigo', to: 'cyan' }}
                                        variant="gradient"
                                        mt="md"
                                    >
                                        Withdraw {asset}
                                    </Button>
                                </Stack>
                            </SpotlightCard>

                            {/* Summary */}
                            <Paper p="md" radius="md" bg="transparent">
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed">Network Fee</Text>
                                    <Text size="sm" fw={700}>1.00 {asset}</Text>
                                </Group>
                                <Group justify="space-between" mt={4}>
                                    <Text size="sm" c="dimmed">Total Receive</Text>
                                    <Text size="lg" fw={700}>
                                        {amount ? Math.max(0, parseFloat(amount.toString()) - 1).toFixed(4) : '0.00'} {asset}
                                    </Text>
                                </Group>
                            </Paper>
                        </Stack>

                    </SimpleGrid>
                </Stack>
            </Container>
        </Box>
    )
}
