import { Group, Text, Stack, Badge, Paper, Box, Flex, SimpleGrid, ThemeIcon, Progress, RingProgress, Center, Title, Container } from '@mantine/core'
import { useAccount } from '../contexts/AccountContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatBalance } from '../lib/utils'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { SpotlightCard } from '../components/SpotlightCard'
import { IconWallet, IconChartPie, IconActivity, IconCpu, IconBrandTether, IconCurrencyBitcoin, IconCurrencyEthereum, IconCurrencySolana, IconCircle, IconArrowUpRight, IconArrowUp } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useMarket } from '../contexts/MarketContext'

// Helper to map assets to icons
const getAssetIcon = (asset: string) => {
  if (asset === 'USDT' || asset === 'USDC') return IconBrandTether;
  if (asset === 'BTC') return IconCurrencyBitcoin;
  if (asset === 'ETH') return IconCurrencyEthereum;
  if (asset === 'SOL') return IconCurrencySolana;
  return IconCircle; // Generic
}

const getAssetColor = (asset: string) => {
  if (asset === 'USDT') return 'green';
  if (asset === 'USDC') return 'blue';
  if (asset === 'BTC') return 'orange';
  if (asset === 'ETH') return 'grape';
  if (asset === 'SOL') return 'cyan';
  return 'gray';
}

export default function Wallet() {
  const { spotAvailable, futuresAvailable, positions } = useAccount()
  const { spotStats, listen, unlisten } = useMarket()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Default to overview, but respect URL param
  const activeTab = searchParams.get('tab') || 'overview'

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab })
  }


  // Listen for spot price updates to keep balance fresh
  useEffect(() => {
    listen('spot')
    return () => unlisten('spot')
  }, [listen, unlisten])

  // Efficient Map for O(1) lookups
  const priceMap = useMemo(() => {
    const map = new Map<string, number>()
    spotStats.forEach(s => {
      map.set(s.symbol, parseFloat(s.lastPrice || '0'))
      // handle potential format diffs if needed, usually symbols are like BTCUSDT
      if (s.symbol.endsWith('USDT')) map.set(s.symbol.replace('USDT', ''), parseFloat(s.lastPrice || '0'))
    })
    return map
  }, [spotStats])

  const totalFuturesValue = useMemo(() => {
    return parseFloat(futuresAvailable.USDT || '0') + parseFloat(futuresAvailable.USDC || '0')
  }, [futuresAvailable])

  const totalSpotValue = useMemo(() => {
    let total = parseFloat(spotAvailable.USDT || '0') + parseFloat(spotAvailable.USDC || '0')

    positions.forEach(pos => {
      // If allow other quotes later, might need adjustment. Assume USDT based for now or derived from priceMap keys
      // symbol usually e.g. BTCUSDT. Asset is BTC.
      const price = priceMap.get(pos.asset + 'USDT') || priceMap.get(pos.asset + 'USDC') || 0
      total += parseFloat(pos.available) * price
      // We can add reserved too if we want 'Total Equity' not just 'Available'
      // usually wallet balance includes reserved (in orders)
      total += parseFloat(pos.reserved) * price
    })

    return total
  }, [spotAvailable, positions, priceMap])

  const totalPortfolioUSD = totalSpotValue + totalFuturesValue

  // Calculate percentages for the ring chart
  const spotPercent = totalPortfolioUSD > 0 ? (totalSpotValue / totalPortfolioUSD) * 100 : 0
  const futuresPercent = totalPortfolioUSD > 0 ? (totalFuturesValue / totalPortfolioUSD) * 100 : 0

  const tabs = [
    { id: 'overview', label: 'Overview', icon: IconChartPie },
    { id: 'spot', label: 'Spot Assets', icon: IconWallet },
    { id: 'futures', label: 'Futures Assets', icon: IconActivity }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Stack gap="xl">
            {/* Hero Balance Card */}
            <Paper className="glass-card no-move" style={{ padding: 'var(--wallet-hero-p)', position: 'relative', overflow: 'hidden' }} radius="lg">
              <Box style={{
                position: 'absolute', top: '-20%', right: '-10%', width: '300px', height: '300px',
                background: 'radial-gradient(circle, rgba(50, 255, 100, 0.15) 0%, transparent 70%)',
                filter: 'blur(50px)', zIndex: 0
              }} />

              <Group justify="space-between" align="flex-start" style={{ position: 'relative', zIndex: 1 }}>
                <Stack gap="xs">
                  <Text c="dimmed" size="lg" fw={500}>Estimated Total Value</Text>
                  <Flex align="center" gap="sm">
                    <Text
                      fz={56}
                      fw={950}
                      lh={1}
                      className="text-glow"
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      ${totalPortfolioUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </Flex>
                  <Text c="dimmed" size="sm">Real-time estimate</Text>
                </Stack>

                <RingProgress
                  size={140}
                  thickness={12}
                  roundCaps
                  sections={[
                    { value: spotPercent, color: 'cyan', tooltip: 'Spot' },
                    { value: futuresPercent, color: 'blue', tooltip: 'Futures' },
                  ]}
                  label={
                    <Center>
                      <IconWallet size={30} style={{ opacity: 0.5 }} />
                    </Center>
                  }
                />
              </Group>

              <SimpleGrid cols={2} mt="xl" spacing="xl">
                <Box>
                  <Group gap="xs" mb={4}>
                    <Box w={8} h={8} bg="cyan" style={{ borderRadius: '50%' }} />
                    <Text size="sm" c="dimmed">Spot Wallet</Text>
                  </Group>
                  <Text size="xl" fw={700}>${formatBalance(totalSpotValue)}</Text>
                  <Progress value={spotPercent} color="cyan" size="sm" mt="xs" />
                </Box>
                <Box>
                  <Group gap="xs" mb={4}>
                    <Box w={8} h={8} bg="blue" style={{ borderRadius: '50%' }} />
                    <Text size="sm" c="dimmed">Futures Wallet</Text>
                  </Group>
                  <Text size="xl" fw={700}>${formatBalance(totalFuturesValue)}</Text>
                  <Progress value={futuresPercent} color="blue" size="sm" mt="xs" />
                </Box>
              </SimpleGrid>
            </Paper>

            {/* Quick Actions / Recent (Placeholder for now, visually nice) */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
              <SpotlightCard p="lg" radius="md" className="glass-card no-move" style={{ cursor: 'pointer' }} onClick={() => navigate('/deposit')}>
                <Group>
                  <ThemeIcon size="xl" radius="md" variant="light" color="green"><IconArrowUpRight /></ThemeIcon>
                  <Box>
                    <Text fw={700}>Deposit</Text>
                    <Text size="xs" c="dimmed">Add funds</Text>
                  </Box>
                </Group>
              </SpotlightCard>
              <SpotlightCard p="lg" radius="md" className="glass-card no-move" style={{ cursor: 'pointer' }} onClick={() => navigate('/withdraw')}>
                <Group>
                  <ThemeIcon size="xl" radius="md" variant="light" color="red"><IconArrowUp /></ThemeIcon>
                  <Box>
                    <Text fw={700}>Withdraw</Text>
                    <Text size="xs" c="dimmed">Send funds</Text>
                  </Box>
                </Group>
              </SpotlightCard>
              <SpotlightCard p="lg" radius="md" className="glass-card no-move" style={{ cursor: 'pointer' }}>
                <Group>
                  <ThemeIcon size="xl" radius="md" variant="light" color="blue"><IconCpu /></ThemeIcon>
                  <Box>
                    <Text fw={700}>Transfer</Text>
                    <Text size="xs" c="dimmed">Spot ↔ Futures</Text>
                  </Box>
                </Group>
              </SpotlightCard>
              <SpotlightCard p="lg" radius="md" className="glass-card no-move" style={{ cursor: 'pointer' }}>
                <Group>
                  <ThemeIcon size="xl" radius="md" variant="light" color="orange"><IconActivity /></ThemeIcon>
                  <Box>
                    <Text fw={700}>Analyze</Text>
                    <Text size="xs" c="dimmed">PnL Analysis</Text>
                  </Box>
                </Group>
              </SpotlightCard>
            </SimpleGrid>
          </Stack>
        )

      case 'spot':
      case 'futures':
        const isSpot = activeTab === 'spot'
        // Merge USDT/USDC into list for Uniform mapping
        const assetList = isSpot ?
          [...['USDT', 'USDC'], ...positions.filter(p => !['USDT', 'USDC'].includes(p.asset)).map(p => p.asset)]
          : ['USDT', 'USDC']

        return (
          <Stack gap="lg">
            <Title order={2} size="h2">{isSpot ? 'Spot Assets' : 'Futures Collateral'}</Title>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {assetList.map(asset => {
                const available = isSpot
                  ? (['USDT', 'USDC'].includes(asset) ? spotAvailable[asset as keyof typeof spotAvailable] : positions.find(p => p.asset === asset)?.available)
                  : (futuresAvailable as any)[asset]
                const reserved = isSpot
                  ? (['USDT', 'USDC'].includes(asset) ? '0' : positions.find(p => p.asset === asset)?.reserved)
                  : '0' // Futures doesn't show reserved logic simply here yet

                const AssetIcon = getAssetIcon(asset)
                const color = getAssetColor(asset)

                return (
                  <SpotlightCard
                    p="xl"
                    radius="md"
                    className="glass-card no-move"
                    spotlightColor={`var(--mantine-color-${color}-5)`}
                  >
                    <Flex justify="space-between" align="flex-start" mb="lg">
                      <Group>
                        <ThemeIcon size={42} radius="xl" variant="light" color={color}>
                          <AssetIcon size={24} />
                        </ThemeIcon>
                        <Box>
                          <Text fw={700} size="lg">{asset}</Text>
                          <Badge variant="dot" color={color} size="xs">{isSpot ? 'Spot' : 'Margined'}</Badge>
                        </Box>
                      </Group>
                      <Text fw={700} size="xl">${['USDT', 'USDC'].includes(asset) ? '1.00' : '---'}</Text>
                    </Flex>

                    <Stack gap={4}>
                      <Text size="sm" c="dimmed">Available Balance</Text>
                      <Text size="2xl" fw={700} className="text-glow">
                        {parseFloat(available || '0').toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                      </Text>
                      {parseFloat(reserved || '0') > 0 && (
                        <Text size="xs" c="orange">Locked: {formatBalance(reserved || '0')}</Text>
                      )}
                    </Stack>
                  </SpotlightCard>
                )
              })}
            </SimpleGrid>
          </Stack>
        )
    }
  }

  return (
    <Box style={{ minHeight: 'calc(100vh - 60px)', position: 'relative', overflow: 'hidden' }}>
      <ParticlesBackground />

      <Box style={{ position: 'relative', zIndex: 1, height: '100%' }}>
        <Flex style={{ height: 'calc(100vh - 60px)' }}>
          {/* Floating Sidebar */}
          <Box w={240} p="md" visibleFrom="sm">
            <Paper h="100%" className="glass-card no-move" radius="lg" p="md" style={{ background: 'var(--mantine-color-default-hover)' }}>
              <Stack gap="sm">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb="xs">Menu</Text>
                {tabs.map(tab => (
                  <Box
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      cursor: 'pointer',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: activeTab === tab.id ? 'var(--mantine-color-default-hover)' : 'transparent',
                      border: activeTab === tab.id ? '1px solid var(--glass-border)' : '1px solid transparent',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Active Indicator Line */}
                    {activeTab === tab.id && (
                      <Box style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', background: 'var(--mantine-primary-color-5)', borderRadius: '0 4px 4px 0' }} />
                    )}

                    <Group>
                      <tab.icon size={20} color={activeTab === tab.id ? 'var(--mantine-color-blue-6)' : 'gray'} />
                      <Text fw={500} c={activeTab === tab.id ? 'var(--mantine-color-text)' : 'dimmed'}>{tab.label}</Text>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>

          {/* Mobile Tab Fallback (Simple) - could be improved but focusing on desktop polish as requested usually */}

          {/* Main Content */}
          <Box flex={1} p={{ base: 'md', md: 'xl' }} style={{ overflowY: 'auto' }}>
            <Container size="xl" px={{ base: 0, md: 'md' }}>
              {renderContent()}
            </Container>
          </Box>
        </Flex>
      </Box>
    </Box>
  )
}
