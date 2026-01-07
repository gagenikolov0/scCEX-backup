import { Group, Text, Stack, Badge, Paper, Box, Flex, SimpleGrid, Progress, RingProgress, Center, Table, Container, Loader, Divider, Button, Menu, SegmentedControl } from '@mantine/core'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE } from '../config/api'
import { PNLCalendar } from '../components/PNLCalendar'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { formatBalance } from '../lib/utils'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { IconWallet, IconChartPie, IconActivity, IconArrowUpRight, IconArrowsLeftRight, IconChevronDown } from '@tabler/icons-react'
import { CryptoIcon } from '../components/CryptoIcon'
import TransferModal from '../components/TransferModal'
import { useEffect, useState } from 'react'
import { useMarket } from '../contexts/MarketContext'

// Wallet assets display

export default function Wallet() {
  const { spotAvailable, futuresAvailable, positions, username, pnl24h, roi24h, spotEquity, futuresEquity, totalPortfolioUSD: contextTotalPortfolioUSD } = useAccount()
  const { accessToken } = useAuth()
  const { listen, unlisten } = useMarket()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pnlHistory, setPnlHistory] = useState<any[]>([])
  const [pnlLoading, setPnlLoading] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferSide, setTransferSide] = useState<'spot' | 'futures'>('spot')

  // Default to overview, but respect URL param
  const activeTab = searchParams.get('tab') || 'overview'

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab })
  }


  // Listen for spot price updates to keep balance fresh for asset list
  useEffect(() => {
    if (activeTab === 'spot') {
      listen('spot')
      return () => unlisten('spot')
    }
  }, [listen, unlisten, activeTab])

  useEffect(() => {
    const fetchPNL = async () => {
      if (!accessToken || !username) return
      setPnlLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/user/futures-pnl/${username}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          setPnlHistory(data.history || [])
        }
      } catch (e) {
        console.error('PNL Fetch error:', e)
      } finally {
        setPnlLoading(false)
      }
    }
    fetchPNL()
  }, [accessToken, username])


  const totalFuturesValue = futuresEquity
  const totalSpotValue = spotEquity

  const totalPortfolioUSD = contextTotalPortfolioUSD

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
            <Paper className="glass-card no-move" style={{ padding: '40px', position: 'relative', overflow: 'hidden' }} radius="lg">
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
                      size="32px"
                      fw={900}
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
                    <Text size="sm" fw={600}>Spot Wallet</Text>
                  </Group>
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase" mt="sm" mb={4}>Total Balance</Text>
                  <Text size="xl" fw={700}>${formatBalance(totalSpotValue)}</Text>
                  <Progress value={spotPercent} color="cyan" size="sm" mt="xs" />
                </Box>
                <Box>
                  <Group gap="xs" mb={4}>
                    <Box w={8} h={8} bg="blue" style={{ borderRadius: '50%' }} />
                    <Text size="sm" fw={600}>Futures Wallet</Text>
                  </Group>
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase" mt="sm" mb={4}>Total Balance</Text>
                  <Text size="xl" fw={700}>${formatBalance(totalFuturesValue)}</Text>
                  <Progress value={futuresPercent} color="blue" size="sm" mt="xs" />
                </Box>
              </SimpleGrid>

              <Divider mt="md" />

              <Group justify="space-between" align="center">
                <Box>
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">24h Futures PNL</Text>
                  <Group gap={6}>
                    <Text size="lg" fw={800} color={pnl24h >= 0 ? 'green' : 'red'}>
                      {pnl24h >= 0 ? '+' : ''}{pnl24h.toFixed(2)} USDT
                    </Text>
                    <Badge color={roi24h >= 0 ? 'green' : 'red'} variant="light">
                      {roi24h >= 0 ? '+' : ''}{roi24h.toFixed(2)}%
                    </Badge>
                  </Group>
                </Box>
                <Button variant="subtle" size="xs" component={Link} to={`/trader/${username}`} rightSection={<IconArrowUpRight size={14} />}>
                  View Full Analytics
                </Button>
              </Group>
            </Paper>

            {/* PNL Calendar Integrated directly into Wallet */}
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={700} size="sm">Performance Calendar (6 Months)</Text>
                {pnlLoading && <Loader size="xs" />}
              </Group>
              <PNLCalendar data={pnlHistory} livePNL={pnl24h} liveROI={roi24h} fullWidth />
            </Stack>

            {/* Quick Actions / Recent (Placeholder for now, visually nice) */}
            {/* Quick Actions Removed */}
          </Stack>
        )

      case 'spot':
      case 'futures':
        const isSpot = activeTab === 'spot'
        const tabTotal = isSpot ? totalSpotValue : totalFuturesValue

        // Prepare table data: Always show USDT/USDC, plus any asset user actually holds
        const displayAssets = isSpot
          ? Array.from(new Set([
            'USDT',
            'USDC',
            ...positions.filter(p => (parseFloat(p.available || '0') + parseFloat(p.reserved || '0')) > 0).map(p => p.asset)
          ]))
          : Array.from(new Set([
            'USDT',
            'USDC',
            ...Object.keys(futuresAvailable).filter(asset => parseFloat((futuresAvailable as any)[asset] || '0') > 0)
          ]))

        return (
          <Stack gap="xl">
            {/* Tab Hero Balance */}
            <Paper className="glass-card no-move" p="40px" radius="lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <Group justify="space-between" align="center">
                <Stack gap="xs">
                  <Text size="lg" c="dimmed" fw={500}>Total Balance</Text>
                  <Group gap="xs" align="flex-baseline">
                    <Text size="32px" fw={900} className="text-glow" style={{ letterSpacing: '-0.02em', lineHeight: 1 }}>
                      ${tabTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text size="sm" c="dimmed" fw={600}>USDT</Text>
                  </Group>
                  {!isSpot && (
                    <Group gap="xs" mt={4}>
                      <Text size="xs" c="dimmed" fw={700} tt="uppercase">24h PNL: </Text>
                      <Text size="sm" fw={800} color={pnl24h >= 0 ? 'green' : 'red'}>
                        {pnl24h >= 0 ? '+' : ''}{pnl24h.toFixed(2)} USDT
                      </Text>
                      <Badge color={roi24h >= 0 ? 'green' : 'red'} variant="light" size="xs">
                        {roi24h >= 0 ? '+' : ''}{roi24h.toFixed(2)}%
                      </Badge>
                    </Group>
                  )}
                </Stack>
                <Group gap="sm">
                  {isSpot ? (
                    <>
                      <Button variant="light" color="green" radius="md" onClick={() => navigate('/deposit')}>Deposit</Button>
                      <Button variant="light" color="gray" radius="md" onClick={() => navigate('/withdraw')}>Withdraw</Button>
                      <Button variant="light" color="blue" radius="md" leftSection={<IconArrowsLeftRight size={16} />} onClick={() => { setTransferSide('spot'); setTransferOpen(true); }}>Transfer</Button>
                    </>
                  ) : (
                    <Button variant="light" color="blue" radius="md" leftSection={<IconArrowsLeftRight size={16} />} onClick={() => { setTransferSide('futures'); setTransferOpen(true); }}>Transfer Funds</Button>
                  )}
                </Group>
              </Group>
            </Paper>

            <Box style={{ overflowX: 'auto' }}>
              <Table verticalSpacing="md" horizontalSpacing="md" className="no-move" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <Table.Thead>
                  <Table.Tr style={{ border: 'none' }}>
                    <Table.Th c="dimmed" fw={600} style={{ border: 'none' }}>Asset</Table.Th>
                    <Table.Th c="dimmed" fw={600} style={{ border: 'none' }}>Total Balance</Table.Th>
                    <Table.Th c="dimmed" fw={600} style={{ border: 'none' }}>Available</Table.Th>
                    <Table.Th c="dimmed" fw={600} style={{ border: 'none' }}>Reserved</Table.Th>
                    <Table.Th style={{ border: 'none' }}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {displayAssets.map(asset => {
                    const posData = isSpot ? positions.find(p => p.asset === asset) : null
                    const available = isSpot
                      ? (['USDT', 'USDC'].includes(asset) ? spotAvailable[asset as keyof typeof spotAvailable] : posData?.available)
                      : (futuresAvailable as any)[asset]
                    const reserved = isSpot
                      ? (['USDT', 'USDC'].includes(asset) ? posData?.reserved : posData?.reserved)
                      : '0'

                    const total = parseFloat(available || '0') + parseFloat(reserved || '0')
                    const isStable = ['USDT', 'USDC'].includes(asset)

                    return (
                      <Table.Tr key={asset} className="glass-card-hover" style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
                        <Table.Td style={{ border: 'none', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}>
                          <Group gap="sm">
                            <CryptoIcon symbol={asset} size={32} />
                            <Box>
                              <Text fw={700} size="sm">{asset}</Text>
                              <Text size="xs" c="dimmed">{isStable ? 'Stablecoin' : 'Digital Asset'}</Text>
                            </Box>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ border: 'none' }}>
                          <Text fw={700} size="sm">{formatBalance(total)}</Text>
                        </Table.Td>
                        <Table.Td style={{ border: 'none' }}>
                          <Text size="sm">{formatBalance(available || '0')}</Text>
                        </Table.Td>
                        <Table.Td style={{ border: 'none' }}>
                          <Text size="sm" c={parseFloat(reserved || '0') > 0 ? 'orange' : 'dimmed'}>
                            {formatBalance(reserved || '0')}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ border: 'none', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }} ta="right">
                          {!isSpot ? (
                            <Button
                              variant="subtle"
                              color="blue"
                              size="compact-xs"
                              fw={700}
                              onClick={() => {
                                // Futures: Always go to BTC/[Quote] for now, or if it's a base asset, to that asset.
                                // Assuming wallet mostly shows Quotes (USDT/USDC).
                                const quote = asset === 'USDC' ? 'USDC' : 'USDT'
                                const base = (asset !== 'USDT' && asset !== 'USDC') ? asset : 'BTC'
                                navigate(`/futures?base=${base}&quote=${quote}`)
                              }}
                            >
                              Trade
                            </Button>
                          ) : asset === 'USDT' ? (
                            <Button
                              variant="subtle"
                              color="gray"
                              size="compact-xs"
                              fw={700}
                              component={Link}
                              to="/deposit"
                            >
                              Deposit
                            </Button>
                          ) : asset === 'USDC' ? (
                            <Button
                              variant="subtle"
                              color="blue"
                              size="compact-xs"
                              fw={700}
                              onClick={() => navigate(`/spot?base=USDC&quote=USDT`)}
                            >
                              Trade
                            </Button>
                          ) : (
                            <Menu shadow="md" width={140} position="bottom-end">
                              <Menu.Target>
                                <Button
                                  variant="subtle"
                                  color="blue"
                                  size="compact-xs"
                                  fw={700}
                                  rightSection={<IconChevronDown size={12} />}
                                >
                                  Trade
                                </Button>
                              </Menu.Target>

                              <Menu.Dropdown>
                                <Menu.Label>Select Market</Menu.Label>
                                <Menu.Item
                                  onClick={() => navigate(`/spot?base=${asset}&quote=USDT`)}
                                >
                                  {asset} / USDT
                                </Menu.Item>
                                <Menu.Item
                                  onClick={() => navigate(`/spot?base=${asset}&quote=USDC`)}
                                >
                                  {asset} / USDC
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          </Stack>
        )
    }
  }

  return (
    <Box style={{ position: 'relative', zIndex: 1 }}>
      <ParticlesBackground />
      <Flex direction={{ base: 'column', sm: 'row' }}>
        {/* Floating Sidebar */}
        <Box w={240} p="md" visibleFrom="sm" style={{ position: 'sticky', top: 0, height: 'fit-content' }}>
          <Paper className="glass-card no-move" radius="lg" p="md" style={{ background: 'var(--mantine-color-default-hover)' }}>
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

        {/* Main Content */}
        <Box flex={1} p={{ base: 'md', md: 'xl' }}>
          <Container size="xl" px={{ base: 0, md: 'md' }}>
            <Box hiddenFrom="sm" mb="md">
              <SegmentedControl
                fullWidth
                value={activeTab}
                onChange={setActiveTab}
                data={[
                  { label: 'Overview', value: 'overview' },
                  { label: 'Spot', value: 'spot' },
                  { label: 'Futures', value: 'futures' }
                ]}
              />
            </Box>
            {renderContent()}
          </Container>
        </Box>
      </Flex>
      <TransferModal
        opened={transferOpen}
        onClose={() => setTransferOpen(false)}
        currentSide={transferSide}
        initialAsset="USDT"
        onTransferred={() => {
          // forcing a re-render or re-fetch might be handled by context updates, 
          // but we can rely on AccountContext socket updates for balances.
        }}
      />
    </Box>
  )
}
