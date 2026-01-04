import { useMemo, useState } from 'react'
import { Button, Box, Title, Text, Stack, SimpleGrid, Group, CopyButton, ThemeIcon, Container, Paper } from '@mantine/core'
import QRCode from 'react-qr-code'
import { API_BASE } from '../config/api'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { SpotlightCard } from '../components/SpotlightCard'
import { IconCurrencyEthereum, IconCurrencyBitcoin, IconCurrencySolana, IconCurrencyRipple, IconBrandBinance, IconHexagon, IconCopy, IconCheck } from '@tabler/icons-react'

const CHAINS = [
  { id: 'BTC', name: 'Bitcoin', icon: IconCurrencyBitcoin, color: 'orange' },
  { id: 'ETH', name: 'Ethereum', icon: IconCurrencyEthereum, color: 'grape' },
  { id: 'BSC', name: 'BNB Smart Chain', icon: IconBrandBinance, color: 'yellow' },
  { id: 'SOL', name: 'Solana', icon: IconCurrencySolana, color: 'cyan' },
  { id: 'TRON', name: 'Tron (TRC20)', icon: IconHexagon, color: 'red' },
  { id: 'XRP', name: 'Ripple', icon: IconCurrencyRipple, color: 'blue' },
] as const

type ChainId = typeof CHAINS[number]['id']

export default function Deposit() {
  type AddressGroup = {
    ethAddress?: string | null
    tronAddress?: string | null
    bscAddress?: string | null
    solAddress?: string | null
    xrpAddress?: string | null
    btcAddress?: string | null
  }

  const [group, setGroup] = useState<AddressGroup | null>(null)
  const [selectedChain, setSelectedChain] = useState<ChainId>('ETH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAddress = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${API_BASE}/api/user/address-group`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to fetch address')
      }
      const j = await res.json()
      setGroup(j)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount if authed could be good, but manual trigger is fine too.
  // We'll auto-fetch on first select if not present
  useMemo(() => {
    if (!group && !loading && !error) fetchAddress()
  }, [])

  const currentAddress = useMemo(() => {
    if (!group) return null
    const map: Record<ChainId, keyof AddressGroup> = {
      'ETH': 'ethAddress',
      'BSC': 'bscAddress',
      'TRON': 'tronAddress',
      'SOL': 'solAddress',
      'XRP': 'xrpAddress',
      'BTC': 'btcAddress' // Assuming backend supports this or we map to ETH for now if same wallet
    }
    // Fallback if backend doesn't have explicit BTC field yet using ETH address for simulation if needed, 
    // but strictly we should use correct one.
    return group[map[selectedChain]] ?? null
  }, [group, selectedChain])

  return (
    <Box style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 60px)' }}>
      <ParticlesBackground />

      <Container size="lg" py={60} style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap={60} align="center">

          {/* Header */}
          <Stack align="center" gap="xs">
            <Title order={1} size={48} className="text-glow">Deposit Assets</Title>
            <Text c="dimmed" size="lg">Select a network to view your deposit address</Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={80} w="100%">

            {/* Left: Chain Selector */}
            <Stack gap="lg">
              <Text fw={700} size="xl">1. Select Network</Text>
              <SimpleGrid cols={2} spacing="md">
                {CHAINS.map(chain => {
                  const isSelected = selectedChain === chain.id
                  return (
                    <SpotlightCard
                      key={chain.id}
                      p="lg"
                      radius="md"
                      className={`glass-card no-move ${isSelected ? 'selected' : ''}`}
                      style={{
                        cursor: 'pointer',
                        border: isSelected ? `1px solid var(--mantine-primary-color-5)` : undefined,
                        background: isSelected ? `var(--mantine-color-default-hover)` : undefined
                      }}
                      onClick={() => setSelectedChain(chain.id)}
                      spotlightColor="var(--glass-bg-hover)"
                    >
                      <Group>
                        <ThemeIcon color={chain.color} variant={isSelected ? 'filled' : 'light'} size="lg" radius="xl">
                          <chain.icon size={20} />
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Text fw={700}>{chain.id}</Text>
                          <Text size="xs" c="dimmed">{chain.name}</Text>
                        </Stack>
                      </Group>
                    </SpotlightCard>
                  )
                })}
              </SimpleGrid>
            </Stack>

            {/* Right: Address & QR */}
            <Stack gap="lg">
              <Text fw={700} size="xl">2. Scan & Send</Text>

              <Paper className="glass-card no-move" radius="lg" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', position: 'relative', overflow: 'hidden' }}>
                {loading ? (
                  <Text c="dimmed" className="animate-pulse">Generating secure address...</Text>
                ) : error ? (
                  <Stack align="center">
                    <Text c="red">{error}</Text>
                    <Button onClick={fetchAddress} variant="light" color="red">Retry</Button>
                  </Stack>
                ) : currentAddress ? (
                  <Stack align="center" gap="xl" w="100%">
                    {/* QR Container with Scanner Effect */}
                    <Box style={{ position: 'relative', padding: '20px', background: 'white', borderRadius: '16px' }}>
                      <QRCode value={currentAddress} size={200} />
                      <Box className="animate-laser" />
                    </Box>

                    <Box w="100%">
                      <Text size="sm" c="dimmed" mb="xs" ta="center">Deposit Address ({selectedChain})</Text>
                      <CopyButton value={currentAddress} timeout={2000}>
                        {({ copied, copy }) => (
                          <SpotlightCard
                            p="md"
                            radius="md"
                            className="glass-card no-move"
                            onClick={copy}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            spotlightColor="var(--glass-bg-hover)"
                          >
                            <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all' }}>{currentAddress}</Text>
                            <ThemeIcon color={copied ? 'green' : 'gray'} variant="light">
                              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                            </ThemeIcon>
                          </SpotlightCard>
                        )}
                      </CopyButton>
                    </Box>

                    <Text size="xs" c="dimmed" ta="center" maw={300}>
                      Only send {selectedChain} to this address. Sending any other asset may result in permanent loss.
                    </Text>
                  </Stack>
                ) : (
                  <Stack align="center" gap="md" style={{ opacity: 0.5 }}>
                    <IconHexagon size={64} />
                    <Text>Select a network to generate address</Text>
                  </Stack>
                )}
              </Paper>
            </Stack>
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  )
}


