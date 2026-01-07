import { useMemo, useState } from 'react'
import {
    Button, Box, Title, Text, Stack, Group,
    TextInput,
    Container, Paper, Select, UnstyledButton,
    rem, Anchor,
    NumberInput, Divider, Badge
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { API_BASE } from '../config/api'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { ParticlesBackground } from '../components/ParticlesBackground'
import {
    IconCurrencyEthereum, IconBrandBinance,
    IconHexagon,
    IconHistory, IconChevronDown,
    IconWallet, IconArrowRight, IconInfoCircle,
    IconAlertTriangle, IconCurrencyBitcoin, IconCurrencySolana
} from '@tabler/icons-react'
import { CryptoIcon } from '../components/CryptoIcon'
import { VerticalStep } from '../components/VerticalStep'

const ASSETS = [
    { symbol: 'USDT', name: 'Tether', color: 'green', fee: '0.1' },
    { symbol: 'USDC', name: 'USD Coin', color: 'blue', fee: '0.1' },
    { symbol: 'BTC', name: 'Bitcoin', color: 'orange', fee: '0.00005' },
    { symbol: 'ETH', name: 'Ethereum', color: 'blue', fee: '0.0005' },
    { symbol: 'SOL', name: 'Solana', color: 'cyan', fee: '0.001' },
]

const NETWORKS: Record<string, { name: string; icon: any; color: string; asset?: string; fee?: string }> = {
    'ERC20': { name: 'Ethereum (ERC20)', icon: IconCurrencyEthereum, color: 'blue', asset: 'ETH' },
    'TRC20': { name: 'Tron (TRC20)', icon: IconHexagon, color: 'red', asset: 'TRX' },
    'BEP20': { name: 'BNB Smart Chain (BEP20)', icon: IconBrandBinance, color: 'yellow', asset: 'BNB' },
    'SOL': { name: 'Solana', icon: IconCurrencySolana, color: 'cyan', asset: 'SOL' },
    'BTC': { name: 'Bitcoin', icon: IconCurrencyBitcoin, color: 'orange', asset: 'BTC' },
}

export default function Withdraw() {
    const { spotAvailable, positions, refreshBalances } = useAccount()
    const { accessToken } = useAuth()

    const [selectedAsset, setSelectedAsset] = useState('USDT')
    const [selectedNetwork, setSelectedNetwork] = useState('TRC20')
    const [address, setAddress] = useState('')
    const [amount, setAmount] = useState<string | number>('')
    const [loading, setLoading] = useState(false)
    const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([])

    const fetchWithdrawals = async () => {
        if (!accessToken) return
        try {
            const res = await fetch(`${API_BASE}/api/user/withdrawals`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
            if (res.ok) {
                const data = await res.json()
                setRecentWithdrawals(data.withdrawals || [])
            }
        } catch { }
    }

    // Initial load
    useMemo(() => {
        fetchWithdrawals()
    }, [accessToken])

    const floorToFixed = (num: number, fixed: number) => {
        const re = new RegExp('^-?\\d+(?:\\.\\d{0,' + (fixed || -1) + '})?')
        const match = num.toString().match(re)
        return match ? match[0] : num.toFixed(fixed)
    }

    const maxBalance = useMemo(() => {
        if (selectedAsset === 'USDT') return parseFloat(spotAvailable.USDT || '0')
        if (selectedAsset === 'USDC') return parseFloat(spotAvailable.USDC || '0')
        const pos = positions.find(p => p.asset === selectedAsset)
        return parseFloat(pos?.available || '0')
    }, [selectedAsset, spotAvailable, positions])

    const currentFee = useMemo(() => {
        const assetObj = ASSETS.find(a => a.symbol === selectedAsset)
        return parseFloat(assetObj?.fee || '1.0')
    }, [selectedAsset])

    const handleMax = () => {
        setAmount(floorToFixed(maxBalance, 8))
    }

    const handleWithdraw = async () => {
        const amtNum = parseFloat(amount.toString())
        if (!amount || amtNum <= 0) return
        if (!address) {
            notifications.show({ title: 'Error', message: 'Please enter a recipient address', color: 'red' })
            return
        }

        if (amtNum > maxBalance) {
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
                    asset: selectedAsset,
                    network: selectedNetwork,
                    address,
                    amount: amtNum
                })
            })

            const j = await res.json()
            if (!res.ok) throw new Error(j.error || 'Withdrawal failed')

            notifications.show({
                title: 'Withdrawal Submitted',
                message: `Your request to withdraw ${amtNum} ${selectedAsset} has been sent.`,
                color: 'green'
            })
            setAmount('')
            setAddress('')
            refreshBalances()
            fetchWithdrawals()
        } catch (e: any) {
            notifications.show({ title: 'Error', message: e.message, color: 'red' })
        } finally {
            setLoading(false)
        }
    }


    const allAssets = useMemo(() => {
        // Collect all assets with non-zero balance first
        const held: any[] = []
        positions.forEach(pos => {
            if (parseFloat(pos.available) > 0) {
                const existing = ASSETS.find(a => a.symbol === pos.asset)
                held.push({
                    symbol: pos.asset,
                    name: existing?.name || pos.asset,
                    color: existing?.color || 'gray',
                    fee: existing?.fee || '0.00'
                })
            }
        })

        // Collect remaining base assets that are NOT in the held list
        const remaining = ASSETS.filter(a => !held.find(h => h.symbol === a.symbol))

        return [...held, ...remaining]
    }, [positions, spotAvailable])

    const quickAssets = [
        { symbol: 'USDT' },
        { symbol: 'USDC' },
        { symbol: 'BTC' },
        { symbol: 'ETH' },
        { symbol: 'SOL' },
    ]

    return (
        <Box style={{ position: 'relative', minHeight: 'calc(100vh - 60px)', background: 'var(--bg-1)' }}>
            <ParticlesBackground />

            <Container size="lg" py={rem(40)} style={{ position: 'relative', zIndex: 1 }}>
                <Stack gap={rem(40)}>
                    <Box>
                        <Title order={1} size={rem(44)} fw={950} className="text-glow" style={{ letterSpacing: '-1.5px' }}>Withdraw Crypto</Title>
                        <Text c="dimmed" mt={4} size="lg" fw={500}>Safely send your assets to an external wallet or exchange</Text>
                    </Box>

                    <Box className="withdraw-grid">
                        <Box style={{ minWidth: 0 }}>
                            {/* Main Form Area */}
                            <Paper p={rem(32)} radius="lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                                <VerticalStep
                                    step={1}
                                    title="Select Asset"
                                    active={true}
                                    complete={!!selectedAsset}
                                >
                                    <Stack gap="xs">
                                        <Select
                                            size="md"
                                            radius="md"
                                            data={allAssets.map(a => ({ value: a.symbol, label: a.symbol, description: a.name }))}
                                            value={selectedAsset}
                                            onChange={(val) => setSelectedAsset(val || 'USDT')}
                                            leftSection={
                                                <CryptoIcon symbol={selectedAsset} size={20} />
                                            }
                                            rightSection={<IconChevronDown size={16} opacity={0.5} />}
                                            comboboxProps={{ transitionProps: { transition: 'pop-top-left', duration: 200 } }}
                                            renderOption={({ option }: any) => (
                                                <Group gap="xs">
                                                    <CryptoIcon symbol={option.label} size={24} />
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={700} style={{ lineHeight: 1.2 }}>{option.label}</Text>
                                                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>{option.description}</Text>
                                                    </Stack>
                                                </Group>
                                            )}
                                            styles={{
                                                input: {
                                                    backgroundColor: 'var(--bg-2)',
                                                    border: '1px solid var(--border-1)',
                                                    height: rem(48),
                                                    fontWeight: 700
                                                }
                                            }}
                                        />
                                        <Group gap="xs">
                                            {quickAssets.map(qa => (
                                                <UnstyledButton
                                                    key={qa.symbol}
                                                    onClick={() => setSelectedAsset(qa.symbol)}
                                                    style={{
                                                        padding: '4px 12px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-1)',
                                                        backgroundColor: selectedAsset === qa.symbol ? 'var(--bg-2)' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <CryptoIcon symbol={qa.symbol} size={14} />
                                                    <Text size="xs" fw={700} c={selectedAsset === qa.symbol ? 'var(--fg-1)' : 'dimmed'}>{qa.symbol}</Text>
                                                </UnstyledButton>
                                            ))}
                                        </Group>
                                    </Stack>
                                </VerticalStep>

                                <VerticalStep
                                    step={2}
                                    title="Withdrawal Network"
                                    active={!!selectedAsset}
                                    complete={!!selectedNetwork}
                                >
                                    <Select
                                        size="md"
                                        radius="md"
                                        placeholder="Choose network"
                                        data={Object.keys(NETWORKS).map(k => ({ label: k, value: k, description: NETWORKS[k].name, asset: NETWORKS[k].asset }))}
                                        value={selectedNetwork}
                                        onChange={(v) => setSelectedNetwork(v || '')}
                                        allowDeselect={false}
                                        leftSection={
                                            <CryptoIcon symbol={NETWORKS[selectedNetwork]?.asset || 'ETH'} size={20} />
                                        }
                                        rightSection={<IconChevronDown size={16} opacity={0.5} />}
                                        comboboxProps={{ transitionProps: { transition: 'pop-top-left', duration: 200 } }}
                                        renderOption={({ option }: any) => (
                                            <Group gap="xs">
                                                <CryptoIcon symbol={option.asset} size={24} />
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={700} style={{ lineHeight: 1.2 }}>{option.label}</Text>
                                                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>{option.description}</Text>
                                                </Stack>
                                            </Group>
                                        )}
                                        styles={{
                                            input: {
                                                backgroundColor: 'var(--bg-2)',
                                                border: '1px solid var(--border-1)',
                                                height: rem(48),
                                                fontWeight: 700
                                            }
                                        }}
                                    />
                                    <Group gap={6} mt="xs">
                                        <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" />
                                        <Text size="xs" c="dimmed">Ensure your receiving address supports this network.</Text>
                                    </Group>
                                </VerticalStep>

                                <VerticalStep
                                    step={3}
                                    title="Withdraw To"
                                    active={!!selectedNetwork}
                                    complete={!!address && !!amount}
                                    isLast
                                >
                                    <Stack gap="lg">
                                        <Stack gap={6}>
                                            <Text size="sm" fw={600}>Address</Text>
                                            <TextInput
                                                placeholder="Paste address here"
                                                size="md"
                                                radius="md"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                leftSection={<IconWallet size={18} />}
                                                styles={{
                                                    input: {
                                                        backgroundColor: 'var(--bg-2)',
                                                        border: '1px solid var(--border-1)'
                                                    }
                                                }}
                                            />
                                        </Stack>

                                        <Stack gap={6}>
                                            <Group justify="space-between">
                                                <Text size="sm" fw={600}>Withdrawal Amount</Text>
                                                <Group gap={4}>
                                                    <Text size="xs" c="dimmed">Available Balance:</Text>
                                                    <Text size="xs" fw={700}>{maxBalance.toFixed(selectedAsset === 'BTC' ? 8 : 4)} {selectedAsset}</Text>
                                                </Group>
                                            </Group>
                                            <NumberInput
                                                size="md"
                                                radius="md"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={setAmount}
                                                min={0}
                                                decimalScale={8}
                                                rightSectionWidth={70}
                                                rightSection={
                                                    <Button variant="light" size="compact-xs" radius="sm" onClick={handleMax} mr={5}>
                                                        MAX
                                                    </Button>
                                                }
                                                styles={{
                                                    input: {
                                                        backgroundColor: 'var(--bg-2)',
                                                        border: '1px solid var(--border-1)'
                                                    }
                                                }}
                                            />
                                        </Stack>

                                        <Button
                                            size="lg"
                                            radius="md"
                                            fullWidth
                                            onClick={handleWithdraw}
                                            loading={loading}
                                            disabled={!address || !amount || parseFloat(amount.toString()) <= 0}
                                            rightSection={<IconArrowRight size={20} />}
                                        >
                                            Withdraw {selectedAsset}
                                        </Button>
                                    </Stack>
                                </VerticalStep>
                            </Paper>
                        </Box>

                        <Stack gap="md" className="withdraw-sidebar">
                            <Paper p="xl" radius="lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                                <Text fw={900} size="sm" tt="uppercase" c="dimmed" mb="lg" style={{ letterSpacing: rem(1) }}>Transfer Summary</Text>
                                <Stack gap="md">
                                    <Group justify="space-between">
                                        <Text size="sm" c="dimmed">Network Fee</Text>
                                        <Text size="sm" fw={700}>{currentFee.toFixed(selectedAsset === 'BTC' ? 4 : 2)} {selectedAsset}</Text>
                                    </Group>
                                    <Divider style={{ borderColor: 'var(--border-1)', opacity: 0.5 }} />
                                    <Group justify="space-between">
                                        <Text size="sm" fw={700}>Total to Receive</Text>
                                        <Stack gap={0} align="flex-end">
                                            <Text size="xl" fw={900}>
                                                {amount ? Math.max(0, parseFloat(amount.toString()) - currentFee).toFixed(selectedAsset === 'BTC' ? 8 : 4) : '0.00'}
                                            </Text>
                                            <Text size="xs" fw={700} c="dimmed">{selectedAsset}</Text>
                                        </Stack>
                                    </Group>

                                    <Box p="md" bg="rgba(255,160,0,0.05)" style={{ borderRadius: rem(8), border: '1px solid rgba(255,160,0,0.2)' }}>
                                        <Group gap="xs" wrap="nowrap" align="flex-start">
                                            <IconAlertTriangle size={16} color="orange" style={{ marginTop: 2 }} />
                                            <Text size="xs" c="orange" fw={500}>
                                                Double-check the address. Crypto transfers are irreversible.
                                            </Text>
                                        </Group>
                                    </Box>
                                </Stack>
                            </Paper>

                            <Paper p="xl" radius="lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                                <Group gap="xs" mb="lg">
                                    <IconHistory size={18} color="var(--mantine-color-dimmed)" />
                                    <Text fw={900} size="sm" tt="uppercase" c="dimmed" style={{ letterSpacing: rem(1) }}>Recent Withdrawals</Text>
                                </Group>
                                <Stack gap="md">
                                    {recentWithdrawals.length === 0 ? (
                                        <Stack gap="sm" align="center" py="xl">
                                            <IconHistory size={40} style={{ opacity: 0.1 }} />
                                            <Text size="sm" c="dimmed">No recent withdrawals found</Text>
                                        </Stack>
                                    ) : (
                                        recentWithdrawals.map((w, index) => (
                                            <Box key={w._id} style={{ position: 'relative', paddingLeft: '20px' }}>
                                                {/* Timeline Line */}
                                                {index !== recentWithdrawals.length - 1 && (
                                                    <Box
                                                        style={{
                                                            position: 'absolute',
                                                            left: '6px',
                                                            top: '24px',
                                                            bottom: '-16px',
                                                            width: '1px',
                                                            background: 'var(--border-1)',
                                                            zIndex: 0
                                                        }}
                                                    />
                                                )}
                                                {/* Timeline Dot */}
                                                <Box
                                                    style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: '6px',
                                                        width: '13px',
                                                        height: '13px',
                                                        borderRadius: '50%',
                                                        background: w.status === 'completed' ? 'var(--mantine-color-green-filled)' : w.status === 'failed' ? 'var(--mantine-color-red-filled)' : 'var(--mantine-color-yellow-filled)',
                                                        border: '2px solid var(--paper-bg)',
                                                        zIndex: 1
                                                    }}
                                                />

                                                <Paper p="sm" radius="md" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                                                    <Group justify="space-between" align="start" mb={4}>
                                                        <Group gap="xs">
                                                            <CryptoIcon symbol={w.asset} size={18} />
                                                            <Text size="sm" fw={700}>{w.asset}</Text>
                                                        </Group>
                                                        <Badge
                                                            size="xs"
                                                            variant="light"
                                                            color={w.status === 'completed' ? 'green' : w.status === 'failed' ? 'red' : 'yellow'}
                                                        >
                                                            {w.status}
                                                        </Badge>
                                                    </Group>

                                                    <Group justify="space-between" align="flex-end">
                                                        <Stack gap={0}>
                                                            <Text size="xs" c="dimmed">{new Date(w.createdAt).toLocaleDateString()}</Text>
                                                            <Text size="xs" c="dimmed" style={{ fontSize: '10px' }}>{new Date(w.createdAt).toLocaleTimeString()}</Text>
                                                        </Stack>
                                                        <Text size="sm" fw={700} c="red" ff="monospace">
                                                            -{Math.max(0, parseFloat(w.amount) - (w.fee || 0)).toFixed(w.asset === 'BTC' ? 6 : 2)}
                                                        </Text>
                                                    </Group>

                                                    <Group gap={4} mt="xs" align="center">
                                                        <Text size="10px" c="dimmed" style={{ flex: 1 }} truncate>
                                                            To: {w.address.slice(0, 6)}...{w.address.slice(-4)}
                                                        </Text>
                                                        {w.txHash && (
                                                            <Anchor href={`#`} size="10px" c="blue" target="_blank">
                                                                View TX
                                                            </Anchor>
                                                        )}
                                                    </Group>
                                                </Paper>
                                            </Box>
                                        ))
                                    )}
                                </Stack>
                            </Paper>
                        </Stack>
                    </Box>
                </Stack>
            </Container>

            <style dangerouslySetInnerHTML={{
                __html: `
        .withdraw-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--mantine-spacing-xl);
          align-items: start;
        }

        @media (min-width: 75em) {
          .withdraw-grid {
            grid-template-columns: 1fr 340px;
            gap: 40px;
          }
        }
      `}} />
        </Box>
    )
}
