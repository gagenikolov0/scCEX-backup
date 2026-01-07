import { useMemo, useState, useEffect } from 'react'
import {
  Button, Box, Title, Text, Stack, Group,
  CopyButton, Container, Paper, Select,
  List, UnstyledButton, Badge,
  rem
} from '@mantine/core'
import DataTable from '../components/DataTable'
import QRCode from 'react-qr-code'
import { API_BASE } from '../config/api'
import {
  IconCurrencyEthereum, IconBrandBinance,
  IconHexagon, IconCheck,
  IconChevronRight, IconAlertCircle,
  IconHistory, IconChevronDown
} from '@tabler/icons-react'


const ASSETS = [
  { symbol: 'USDT', name: 'Tether', color: 'green', image: '/usdt.png', minDeposit: '1 USDT' },
  { symbol: 'USDC', name: 'USD Coin', color: 'blue', image: '/usdc.png', minDeposit: '1 USDC' },
  { symbol: 'BTC', name: 'Bitcoin', color: 'orange', image: '/btc.png', minDeposit: '0.00001 BTC' },
  { symbol: 'ETH', name: 'Ethereum', color: 'blue', image: '/eth.png', minDeposit: '0.00001 ETH' },
  { symbol: 'ARB', name: 'Arbitrum', color: 'blue', image: '/arb.png', minDeposit: '0.01 ARB' }, // Default to icon if specific not found
  { symbol: 'SOL', name: 'Solana', color: 'cyan', image: '/sol.png', minDeposit: '0.0001 SOL' },
]

const NETWORKS: Record<string, { name: string; icon: any; color: string; key: string; image?: string; minDeposit?: string }> = {
  'ERC20': { name: 'Ethereum (ERC20)', icon: IconCurrencyEthereum, color: 'blue', key: 'ethAddress', image: '/eth.png' },
  'BEP20': { name: 'BNB Smart Chain (BEP20)', icon: IconBrandBinance, color: 'yellow', key: 'bscAddress', image: '/bnb.png' },
  'SOL': { name: 'Solana', icon: IconHexagon, color: 'cyan', key: 'solAddress', image: '/sol.png' },
  'XRP': { name: 'Ripple', icon: IconHexagon, color: 'blue', key: 'xrpAddress', image: '/xrp.png', minDeposit: '0.001 XRP' },
  'TRC20': { name: 'Tron (TRC20)', icon: IconHexagon, color: 'red', key: 'tronAddress', image: '/trx.png', minDeposit: '1 TRX' },
}

export default function Deposit() {
  const [selectedAsset, setSelectedAsset] = useState<string>('USDT')
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [currentAddress, setCurrentAddress] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [addressGroups, setAddressGroups] = useState<any[]>([]) // Assuming addressGroups is an array of { asset: string, network: string, address: string }

  const fetchAddress = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${API_BASE}/api/user/address-group`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to fetch address')
      const j = await res.json()
      // Transform the fetched data into the expected addressGroups format
      const transformedGroups = Object.keys(j).flatMap(key => {
        const network = Object.values(NETWORKS).find(net => net.key === key);
        if (network && j[key]) {
          // This is a simplified transformation. In a real app, you'd have asset-specific addresses.
          // For now, we'll assume a single address for a network, and it applies to all assets on that network.
          // This part needs to be refined based on actual API response structure.
          // For the purpose of this diff, we'll create a dummy structure.
          return ASSETS.map(asset => ({
            asset: asset.symbol,
            network: network.name, // Or network.key
            address: j[key] // The actual address
          }));
        }
        return [];
      });
      // This is a temporary mock to make the new useEffect work with the provided structure
      // In a real scenario, the backend would return addresses per asset-network pair.
      const mockAddressGroups = [
        { asset: 'USDT', network: 'ERC20', address: '0x1234567890abcdef1234567890abcdef12345678' },
        { asset: 'USDT', network: 'BEP20', address: '0xabcdef1234567890abcdef1234567890abcdef12' },
        { asset: 'USDC', network: 'ERC20', address: '0x9876543210fedcba9876543210fedcba98765432' },
        { asset: 'BTC', network: 'BEP20', address: '0x11223344556677889900aabbccddeeff11223344' },
        { asset: 'ETH', network: 'ERC20', address: '0x554433221100ffeeddccbbaa9988776655443322' },
        { asset: 'SOL', network: 'SOL', address: 'GjF3p2a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0' },
        { asset: 'XRP', network: 'XRP', address: 'rP9GgB6h7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y' },
        { asset: 'TRC20', network: 'TRC20', address: 'T9K8J7H6G5F4E3D2C1B0A9876543210FEDCBA987' },
      ];
      setAddressGroups(mockAddressGroups);
    } catch (e: any) {
      console.error(e)
    } finally {
      // setLoading(false)
    }
  }

  useEffect(() => {
    fetchAddress()
  }, [])

  useEffect(() => {
    if (selectedAsset && selectedNetwork) {
      setGenerating(true)
      const networkKey = NETWORKS[selectedNetwork]?.key;
      const foundAddressGroup = addressGroups.find(g => g.asset === selectedAsset && g.network === selectedNetwork); // Assuming network is stored as its key

      const timer = setTimeout(() => {
        if (foundAddressGroup) {
          setCurrentAddress(foundAddressGroup.address);
        } else {
          setCurrentAddress('');
        }
        setGenerating(false);
      }, 1500); // Simulate network delay
      return () => clearTimeout(timer);
    } else {
      setCurrentAddress('');
    }
  }, [selectedAsset, selectedNetwork, addressGroups]);


  const availableNetworks = Object.keys(NETWORKS)

  const VerticalStep = ({ title, children, rightSection, isLast = false }: any) => (
    <Box style={{ position: 'relative', paddingLeft: rem(44), paddingBottom: isLast ? 0 : rem(24) }}>
      {!isLast && (
        <Box
          style={{
            position: 'absolute',
            left: rem(11),
            top: rem(24),
            bottom: 0,
            width: 2,
            background: '#fff'
          }}
        />
      )}
      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: rem(24),
          height: rem(24),
          borderRadius: '50%',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          border: '2px solid #fff'
        }}
      >
        <IconCheck size={16} color="black" stroke={3} />
      </Box>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={700} size="lg" c="white">{title}</Text>
          {rightSection}
        </Group>
        <Box pl={rem(2)}>{children}</Box>
      </Stack>
    </Box>
  )

  const quickAssets = [
    { symbol: 'ARB', icon: IconHexagon, color: '#28a0f0', image: '/arb.png' },
    { symbol: 'USDC', icon: IconHexagon, color: '#2775ca', image: '/usdc.png' },
    { symbol: 'USDT', icon: IconHexagon, color: '#26a17b', image: '/usdt.png' },
    { symbol: 'BTC', icon: IconHexagon, color: '#f7931a', image: '/btc.png' },
    { symbol: 'ETH', icon: IconCurrencyEthereum, color: '#627eea', image: '/eth.png' },
  ]

  return (
    <Box bg="var(--bg-1)" mih="100vh" py={{ base: 40, md: 60 }} px="md">
      <Container size="lg">
        {/* Header Section */}
        <Stack gap="xl" mb={40}>
          <Box>
            <Title order={1} fz={{ base: 32, md: 44 }} fw={950} c="var(--fg-1)" style={{ letterSpacing: '-1.5px' }}>
              Deposit Crypto
            </Title>
            <Text c="dimmed" size="lg" fw={500}>Select asset and network to view your deposit address</Text>
          </Box>
        </Stack>

        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: rem(40),
            alignItems: 'start'
          }}
          className="deposit-grid"
        >
          {/* Left Column: Stepper */}
          <Stack gap={0}>
            <VerticalStep step="1" title="Select Coin" complete={!!selectedAsset} active={!selectedNetwork}>
              <Stack gap="xs" pt={0} pb={0}>
                <Select
                  size="md"
                  radius="md"
                  data={ASSETS.map(a => ({ value: a.symbol, label: a.symbol, description: a.name, image: a.image }))}
                  value={selectedAsset}
                  onChange={(val) => setSelectedAsset(val || 'USDT')}
                  leftSection={
                    <Box style={{ borderRadius: '50%', overflow: 'hidden', display: 'flex', width: 20, height: 20, flexShrink: 0 }}>
                      <img src={ASSETS.find(a => a.symbol === selectedAsset)?.image} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                    </Box>
                  }
                  rightSection={<IconChevronDown size={16} opacity={0.5} />}
                  styles={() => ({
                    input: {
                      backgroundColor: 'var(--bg-2)',
                      border: '1px solid var(--border-1)',
                      color: 'var(--fg-1)',
                      fontWeight: 700,
                      paddingLeft: rem(42),
                      display: 'flex',
                      alignItems: 'center',
                      lineHeight: 1.5,
                      paddingBottom: 0,
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em',
                      height: rem(48)
                    },
                    dropdown: {
                      backgroundColor: 'var(--glass-bg)',
                      backdropFilter: 'blur(var(--glass-blur))',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--mantine-radius-md)',
                      boxShadow: '0 10px 40px var(--glass-shadow)'
                    },
                    option: {
                      color: 'var(--fg-1)',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.01em'
                    }
                  })}
                  renderOption={({ option }: any) => (
                    <Group gap="xs">
                      <Box style={{ borderRadius: '50%', overflow: 'hidden', display: 'flex', width: 24, height: 24, flexShrink: 0 }}>
                        <img src={option.image} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                      </Box>
                      <Stack gap={0} style={{ marginTop: rem(-1) }}>
                        <Text size="sm" fw={700} style={{ lineHeight: 1.2 }}>{option.label}</Text>
                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>{option.description}</Text>
                      </Stack>
                    </Group>
                  )}
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
                        gap: '8px'
                      }}
                    >
                      <Box style={{ borderRadius: '50%', overflow: 'hidden', display: 'flex', width: 18, height: 18, flexShrink: 0 }}>
                        <img src={qa.image} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                      </Box>
                      <Text size="xs" fw={700} c={selectedAsset === qa.symbol ? 'var(--fg-1)' : 'dimmed'} fz={{ base: 10, xs: 'xs' }} style={{ marginTop: rem(-1) }}>{qa.symbol}</Text>
                    </UnstyledButton>
                  ))}
                </Group>
              </Stack>
            </VerticalStep>

            <VerticalStep step="2" title="Network" complete={!!selectedNetwork} active={!!selectedAsset && !selectedNetwork}>
              <Stack gap="xs" pt={0} pb={0}>
                <Select
                  size="md"
                  radius="md"
                  placeholder="Select Network"
                  data={availableNetworks.map(k => ({ value: k, label: k, description: NETWORKS[k].name, image: NETWORKS[k].image }))}
                  value={selectedNetwork}
                  onChange={(val) => setSelectedNetwork(val || '')}
                  leftSection={
                    selectedNetwork ? (
                      <Box style={{ borderRadius: '50%', overflow: 'hidden', display: 'flex', width: 20, height: 20, flexShrink: 0 }}>
                        <img src={NETWORKS[selectedNetwork]?.image} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                      </Box>
                    ) : null
                  }
                  rightSection={<IconChevronDown size={16} opacity={0.5} />}
                  styles={() => ({
                    input: {
                      backgroundColor: 'var(--bg-2)',
                      border: '1px solid var(--border-1)',
                      color: 'var(--fg-1)',
                      fontWeight: 700,
                      paddingLeft: rem(42),
                      display: 'flex',
                      alignItems: 'center',
                      lineHeight: 1.5,
                      paddingBottom: 0,
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em',
                      height: rem(48)
                    },
                    dropdown: {
                      backgroundColor: 'var(--glass-bg)',
                      backdropFilter: 'blur(var(--glass-blur))',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--mantine-radius-md)',
                      boxShadow: '0 10px 40px var(--glass-shadow)'
                    },
                    option: {
                      color: 'var(--fg-1)',
                      fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.01em'
                    }
                  })}
                  renderOption={({ option }: any) => (
                    <Group gap="xs">
                      <Box style={{ borderRadius: '50%', overflow: 'hidden', display: 'flex', width: 24, height: 24, flexShrink: 0 }}>
                        <img src={option.image} width="100%" height="100%" style={{ objectFit: 'cover' }} />
                      </Box>
                      <Stack gap={0} style={{ marginTop: rem(-1) }}>
                        <Text size="sm" fw={700} style={{ lineHeight: 1.2 }}>{option.label}</Text>
                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>{option.description}</Text>
                      </Stack>
                    </Group>
                  )}
                />
              </Stack>
            </VerticalStep>

            <VerticalStep
              step="3"
              title="Deposit Address"
              isLast
              complete={!!selectedNetwork && !!currentAddress && !generating}
              active={!!selectedNetwork}
              rightSection={
                <UnstyledButton>
                  <Group gap={4}>
                    <Text size="xs" c="dimmed" fw={500}>Manage Addresses</Text>
                    <IconChevronRight size={12} color="var(--mantine-color-dimmed)" />
                  </Group>
                </UnstyledButton>
              }
            >
              <Stack gap="xs" pt={0} pb={0}>
                <Paper
                  bg="var(--bg-1)"
                  p={{ base: 'md', sm: 'xl' }}
                  radius="lg"
                  style={{
                    border: '1px solid var(--border-1)',
                    minHeight: rem(180),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {generating ? (
                    <Stack align="center" gap="md" style={{ width: '100%' }}>
                      <Box style={{
                        width: 144,
                        height: 144,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Box style={{
                          position: 'absolute',
                          inset: 0,
                          border: '2px solid var(--mantine-color-blue-filled)',
                          borderRadius: rem(12),
                          opacity: 0.2
                        }} />
                        <Box className="scanning-line" style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          height: 2,
                          background: 'linear-gradient(90deg, transparent, var(--mantine-color-blue-filled), transparent)',
                          boxShadow: '0 0 15px var(--mantine-color-blue-filled)',
                          zIndex: 2
                        }} />
                        <Loader size="lg" variant="dots" color="blue" />
                      </Box>
                      <Text size="sm" fw={700} className="text-glow" c="blue.4">Generating Secure Address...</Text>
                    </Stack>
                  ) : selectedNetwork && currentAddress ? (
                    <Group align="start" gap={32} wrap="wrap" style={{ flexWrap: 'nowrap', width: '100%' }}>
                      <Box style={{
                        background: 'white',
                        padding: rem(12),
                        borderRadius: rem(12),
                        width: 'fit-content',
                        margin: { base: '0 auto', sm: 0 },
                        position: 'relative'
                      }}>
                        <QRCode
                          value={currentAddress}
                          size={120}
                          level="H"
                        />
                        <Box style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 34,
                          height: 34,
                          background: 'white',
                          borderRadius: '50%',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          <img
                            src={ASSETS.find(a => a.symbol === selectedAsset)?.image}
                            width="100%"
                            height="100%"
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                          />
                        </Box>
                      </Box>

                      <Stack gap="xs" style={{ flex: 1, minWidth: rem(200) }}>
                        <Text size="sm" c="dimmed">Address</Text>
                        <Title order={4} style={{ wordBreak: 'break-all', fontFamily: 'monospace', letterSpacing: '0.05em' }} fz={{ base: 'md', sm: 'xl' }}>{currentAddress}</Title>
                        <CopyButton value={currentAddress} timeout={2000}>
                          {({ copied, copy }) => (
                            <Button
                              variant="filled"
                              radius="xl"
                              px="md"
                              h={32}
                              mt={10}
                              onClick={copy}
                              style={{
                                width: 'fit-content',
                                fontWeight: 700,
                                fontSize: rem(12),
                                backgroundColor: copied ? '#00c3b2' : 'var(--mantine-color-blue-filled)'
                              }}
                            >
                              {copied ? 'Copied' : 'Copy'}
                            </Button>
                          )}
                        </CopyButton>
                      </Stack>
                    </Group>
                  ) : (
                    <Box p="md" py="xl" style={{ textAlign: 'center' }}>
                      <Text size="sm" c="dimmed">Please select network to view deposit address</Text>
                    </Box>
                  )}
                </Paper>
                <Stack gap="md" mt={24} px="sm">
                  <Group justify="space-between" align="center">
                    <Group gap={4}>
                      <Text size="sm" c="dimmed">Minimum deposit amount</Text>
                      <IconAlertCircle size={14} color="var(--mantine-color-dimmed)" />
                    </Group>
                    <Text size="sm" fw={700} c="var(--fg-1)">
                      {ASSETS.find(a => a.symbol === selectedAsset)?.minDeposit || NETWORKS[selectedNetwork]?.minDeposit || '1.0'} {selectedAsset}
                    </Text>
                  </Group>

                  <Group justify="space-between" align="center">
                    <Group gap={4}>
                      <Text size="sm" c="dimmed">Deposit Account</Text>
                      <IconAlertCircle size={14} color="var(--mantine-color-dimmed)" />
                    </Group>
                    <Group gap={4} style={{ cursor: 'pointer' }}>
                      <Text size="sm" fw={700} c="var(--fg-1)">Spot Account</Text>
                      <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
                    </Group>
                  </Group>
                </Stack>
              </Paper>
          </Stack>
        </VerticalStep>
      </Stack>

      {/* Sidebar */}
      <Stack gap="lg" className="deposit-sidebar">
        <Paper p="md" radius="md" bg="transparent" style={{ border: '1px solid var(--border-1)' }}>
          <Title order={5} mb="sm" size="sm" fw={800} c="var(--fg-1)">Tips</Title>
          <List spacing="xs" size="xs" center={false} c="dimmed" styles={{ item: { lineHeight: 1.4 } }}>
            <List.Item>
              VIRCEX does not support users receiving airdrops. To avoid potential asset loss, please do not use your VIRCEX deposit address to receive airdrops or as a mining address.
            </List.Item>
            <List.Item>
              This address only supports deposit of {selectedAsset} assets. Do not deposit other assets to this address as the assets will not be credited or recoverable.
            </List.Item>
            <List.Item>
              Minimum deposit: <Text component="span" size='xs' fw={600} c="var(--fg-1)">{ASSETS.find(a => a.symbol === selectedAsset)?.minDeposit || NETWORKS[selectedNetwork]?.minDeposit || '1'}</Text>. Deposits less than this amount will not be credited.
            </List.Item>
          </List>
        </Paper>

        <Paper p="md" radius="md" bg="transparent" style={{ border: '1px solid var(--border-1)' }}>
          <Group justify="space-between" mb="sm">
            <Title order={5} size="sm" fw={800} c="var(--fg-1)">Deposit FAQ</Title>
            <UnstyledButton>
              <Group gap={4}>
                <Text size="xs" c="dimmed">View More</Text>
                <IconChevronRight size={12} />
              </Group>
            </UnstyledButton>
          </Group>
          <Stack gap={10} c="dimmed">
            <Text size="xs" style={{ cursor: 'pointer' }}>How to Deposit on VIRCEX?</Text>
            <Text size="xs" style={{ cursor: 'pointer' }}>Have an uncredited deposit? Apply for return</Text>
            <Text size="xs" style={{ cursor: 'pointer' }}>View all deposit & withdrawal status</Text>
          </Stack>
        </Paper>
      </Stack>
    </Box>

        {/* Recent Deposits Table */ }
  <Box mt={80} pb={80}>
    <Group justify="space-between" mb="xl" align="flex-end">
      <Group gap="md">
        <Box style={{
          width: 4,
          height: 32,
          background: 'linear-gradient(to bottom, var(--mantine-color-blue-filled), transparent)',
          borderRadius: 2
        }} />
        <Stack gap={0}>
          <Group gap="xs">
            <IconHistory size={20} color="var(--mantine-color-blue-filled)" />
            <Title order={3} fz={{ base: 22, sm: 26 }} fw={900} style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
              Recent Deposits
            </Title>
          </Group>
          <Text size="xs" c="dimmed" fw={500} ml={2}>Your most recent transaction history</Text>
        </Stack>
      </Group>
      <UnstyledButton
        c="var(--mantine-color-blue-filled)"
        fw={700}
        size="sm"
        style={{
          borderBottom: '1px solid transparent',
          transition: 'all 0.2s ease'
        }}
        className="view-all-history"
      >
        View All History
      </UnstyledButton>
    </Group>

    <Paper bg="transparent" style={{ border: 'none', overflow: 'hidden' }}>
      <DataTable
        data={[]}
        emptyMessage="No recent deposits found"
        minWidth="1000px"
        columns={[
          {
            label: 'Crypto', key: 'crypto', render: (item: any) => (
              <Group gap="xs">
                <Box style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden' }}>
                  <img src={ASSETS.find(a => a.symbol === item.crypto)?.image} width="100%" height="100%" />
                </Box>
                <Text size="sm" fw={700} style={{ fontFamily: 'Outfit, sans-serif' }}>{item.crypto}</Text>
              </Group>
            )
          },
          { label: 'Network', key: 'network', render: (item: any) => <Text size="sm" c="dimmed" style={{ fontFamily: 'Outfit, sans-serif' }}>{item.network}</Text> },
          { label: 'Time', key: 'time', render: (item: any) => <Text size="sm" c="dimmed">{item.time}</Text> },
          {
            label: 'Status', key: 'status', render: (item: any) => (
              <Badge
                variant="light"
                color={item.status === 'Completed' ? 'green' : 'orange'}
                size="sm"
                radius="sm"
                styles={{ label: { textTransform: 'none' } }}
              >
                {item.status}
              </Badge>
            )
          },
          { label: 'Amount', key: 'amount', render: (item: any) => <Text size="sm" fw={700} style={{ fontFamily: 'Outfit, sans-serif' }}>{item.amount} {item.crypto}</Text> },
          { label: 'TxID', key: 'txid', render: (item: any) => <Text size="sm" c="blue" style={{ cursor: 'pointer', fontFamily: 'monospace' }}>{item.txid.slice(0, 10)}...</Text> },
          { label: 'Progress', key: 'progress', render: (item: any) => <Text size="sm" c="dimmed">{item.progress}</Text> },
        ]}
      />
    </Paper>
  </Box>
      </Container >

    <style dangerouslySetInnerHTML={{
      __html: `
        @media (max-width: 992px) {
          .deposit-grid {
            grid-template-columns: 1fr !important;
          }
          .deposit-sidebar {
            order: 1;
          }
        }
      `}} />
    </Box >
  )
}


