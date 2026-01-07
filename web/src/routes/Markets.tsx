import { useMemo, useState, useEffect, memo, useRef } from 'react'
import { ActionIcon, TextInput, Anchor, Box, Flex, Group, Text, Stack, Tabs, Pagination, Container, Title, ThemeIcon, Badge, Paper, SimpleGrid, rem } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useMarket } from '../contexts/MarketContext'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { SpotlightCard } from '../components/SpotlightCard'
import { CountUp } from '../components/CountUp'
import { IconSearch, IconTrendingUp, IconTrendingDown, IconFlame, IconBolt, IconActivity, IconX } from '@tabler/icons-react'
import { CryptoIcon } from '../components/CryptoIcon'

function splitSymbol(sym: string): { base: string; quote: string } {
  const clean = sym.replace('_', '')
  if (clean.endsWith('USDT')) return { base: clean.slice(0, -4), quote: 'USDT' }
  if (clean.endsWith('USDC')) return { base: clean.slice(0, -4), quote: 'USDC' }
  return { base: clean, quote: '' }
}

const FeaturedMarket = memo(({ item, type }: { item: any; type: 'spot' | 'futures' }) => {
  const baseInfo = splitSymbol(item.symbol)
  const change = parseFloat(String(item.change24h || '0'))
  const isUp = change >= 0

  return (
    <Anchor component={Link} to={`/${type}?base=${baseInfo.base}&quote=${baseInfo.quote}`} underline="never" c="inherit">
      <SpotlightCard p="md" radius="md" className="glass-card no-move" style={{ height: '100%' }}>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap={8} wrap="nowrap" style={{ overflow: 'hidden', flex: 1 }}>
              <CryptoIcon symbol={baseInfo.base} size={24} />
              <Text size="sm" fw={700} truncate>{baseInfo.base}</Text>
              <Badge size="xs" variant="light" color="cyan" style={{ flexShrink: 0 }}>{baseInfo.quote}</Badge>
            </Group>
            <ThemeIcon variant="light" color={isUp ? 'green' : 'red'} size="sm" style={{ flexShrink: 0 }}>
              {isUp ? <IconTrendingUp size={14} /> : <IconTrendingDown size={14} />}
            </ThemeIcon>
          </Group>

          <Box style={{ overflow: 'hidden' }}>
            <Title order={3} fz={{ base: 'xl', sm: '24px' }} ff="monospace" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <CountUp
                end={parseFloat(String(item.lastPrice || '0'))}
                decimals={parseFloat(String(item.lastPrice || '0')) < 0.01 ? 8 : 4}
              />
            </Title>
            <Text size="xs" c={isUp ? 'green' : 'red'} fw={900}>
              {isUp ? '+' : ''}{change.toFixed(2)}%
            </Text>
          </Box>
        </Stack>
      </SpotlightCard>
    </Anchor>
  )
})

const MarketRow = memo(({ item, type, base, quote }: { item: any, type: 'spot' | 'futures', base: string, quote: string }) => {
  const price = item.lastPrice ?? ''
  const change = item.change24h ?? 0
  const high = item.high24h ?? ''
  const low = item.low24h ?? ''
  const vol = item.volume24h ? parseFloat(String(item.volume24h)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : ''

  const changeNum = parseFloat(String(change)) || 0
  const isUp = changeNum > 0
  const isDown = changeNum < 0
  const changeColor = isUp ? 'green' : isDown ? 'red' : 'dimmed'

  return (
    <Anchor component={Link} to={`/${type}?base=${base}&quote=${quote}`} underline="never" c="inherit">
      <Flex
        px={{ base: 'md', md: 'xl' }}
        py="md"
        align="center"
        justify="space-between"
        className="market-row-hover no-move"
        style={{
          borderBottom: '1px solid var(--border-1)',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
      >
        <Group gap="xs" grow flex={1} wrap="nowrap">
          <Group gap="sm" style={{ flex: '0 0 35%', minWidth: 0 }}>
            <CryptoIcon symbol={base} size={32} />
            <Group gap={4} wrap="nowrap">
              <Text fw={800} size="sm" truncate>{base}</Text>
              <Text size="10px" c="dimmed" fw={700}>{quote}</Text>
            </Group>
          </Group>

          <Box style={{ flex: 1, textAlign: 'right' }}>
            <Text ff="monospace" fw={700} size="sm">
              {price}
            </Text>
          </Box>

          <Box style={{ flex: '0 0 90px', textAlign: 'right' }}>
            <Badge
              variant="light"
              color={changeColor}
              radius="sm"
              size="sm"
              style={{ width: '80px', fontVariantNumeric: 'tabular-nums' }}
            >
              {isUp ? '+' : ''}{changeNum.toFixed(2)}%
            </Badge>
          </Box>

          <Stack gap={0} ta="right" style={{ flex: '0 0 120px' }}>
            <Text size="xs" c="dimmed" ff="monospace">H: {high}</Text>
            <Text size="xs" c="dimmed" ff="monospace">L: {low}</Text>
          </Stack>

          <Box ta="right" style={{ flex: '0 0 120px' }}>
            <Text size="sm" ff="monospace" c="dimmed">{vol}</Text>
          </Box>
        </Group>
      </Flex>
    </Anchor>
  )
})

const MarketTable = memo(({ data, type }: { data: any[], type: 'spot' | 'futures' }) => {
  const [page, setPage] = useState(1)
  const pageSize = 15
  const totalPages = Math.ceil(data.length / pageSize)

  useEffect(() => setPage(1), [type])

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page])

  return (
    <Box>
      <Paper radius="lg" style={{ overflow: 'hidden', background: 'var(--bg-1)', border: '1px solid var(--border-1)' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Box style={{ minWidth: '800px' }}>
            {/* Table Header */}
            <Flex px={{ base: 'md', md: 'xl' }} py="md" bg="var(--bg-2)" style={{ borderBottom: '1px solid var(--border-1)' }}>
              <Group gap="xs" grow flex={1} wrap="nowrap">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ flex: '0 0 35%' }}>Market</Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" ta="right" style={{ flex: 1 }}>Price</Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" ta="right" style={{ flex: '0 0 90px' }}>Change</Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" ta="right" style={{ flex: '0 0 120px' }}>High / Low</Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" ta="right" style={{ flex: '0 0 120px' }}>Volume</Text>
              </Group>
            </Flex>

            <Box style={{ minHeight: '400px' }}>
              {pageData.length > 0 ? (
                pageData.map(item => {
                  const baseInfo = splitSymbol(item.symbol)
                  return <MarketRow key={`${type}-${item.symbol}`} item={item} type={type} base={baseInfo.base} quote={baseInfo.quote} />
                })
              ) : (
                <Flex justify="center" align="center" h={200}>
                  <Text c="dimmed" size="sm">No assets found</Text>
                </Flex>
              )}
            </Box>
          </Box>
        </Box>

        {totalPages > 1 && (
          <Flex justify="center" p="xl" bg="var(--bg-2)" style={{ borderTop: '1px solid var(--border-1)' }}>
            <Pagination total={totalPages} value={page} onChange={setPage} color="blue" radius="xl" />
          </Flex>
        )}
      </Paper>
    </Box>
  )
})

export default function Markets() {
  const { spotStats, futuresStats, listen, unlisten } = useMarket()
  const [q, setQ] = useState('')
  const [activeTab, setActiveTab] = useState<string | null>('spot-usdt')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!activeTab) return
    if (activeTab.startsWith('spot')) {
      listen('spot')
      unlisten('futures')
    } else if (activeTab.startsWith('futures')) {
      listen('futures')
      unlisten('spot')
    }
    return () => {
      unlisten('spot')
      unlisten('futures')
    }
  }, [activeTab, listen, unlisten])

  const filterFn = (t: any) => !q || t.symbol.toLowerCase().includes(q.toLowerCase())

  const spotUSDT = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDT')).filter(filterFn), [spotStats, q])
  const spotUSDC = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDC')).filter(filterFn), [spotStats, q])
  const futuresUSDT = useMemo(() => futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDT')).filter(filterFn), [futuresStats, q])
  const futuresUSDC = useMemo(() => futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDC')).filter(filterFn), [futuresStats, q])

  const hotMarkets = useMemo(() => {
    const all = [...spotStats, ...futuresStats]
    return all
      .sort((a, b) => {
        const changeA = parseFloat(String(a.change24h || '0'))
        const changeB = parseFloat(String(b.change24h || '0'))
        return Math.abs(changeB) - Math.abs(changeA)
      })
      .slice(0, 4)
  }, [spotStats, futuresStats])

  return (
    <Box style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 60px)' }}>
      <ParticlesBackground />

      <Container size="xl" py={{ base: 'md', md: 'xl' }} px={{ base: 'xs', sm: 'md' }} style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap="xl">
          {/* Header & Search */}
          <Box
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: rem(20),
              flexWrap: 'wrap'
            }}
          >
            <Stack gap={4} style={{ flex: 1, minWidth: rem(300) }}>
              <Title order={1} fz={{ base: 32, md: 42 }} lh={1.1} fw={900}>Market Explorer</Title>
              <Text c="dimmed" size="lg" fz={{ base: 'md', md: 'lg' }}>Real-time data for over 1000+ trading pairs</Text>
            </Stack>
            <TextInput
              ref={searchRef}
              placeholder="Search assets..."
              leftSection={<IconSearch size={22} stroke={1.5} color="var(--mantine-color-blue-4)" />}
              rightSection={
                <Group gap={6} px="xs">
                  {q && (
                    <ActionIcon
                      variant="transparent"
                      color="dimmed"
                      onClick={() => setQ('')}
                      size="sm"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  )}
                  <Box
                    visibleFrom="sm"
                    style={{
                      background: 'var(--mantine-color-default-hover)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '6px',
                      padding: '2px 6px'
                    }}
                  >
                    <Text size="10px" fw={700} c="dimmed">Ctrl + K</Text>
                  </Box>
                </Group>
              }
              rightSectionWidth={110}
              value={q}
              onChange={e => setQ(e.currentTarget.value)}
              maw={{ base: '100%', md: 450 }}
              w="100%"
              radius="md"
              size="lg"
              classNames={{
                input: 'glass-input'
              }}
              styles={{
                input: {
                  height: '54px',
                  fontSize: '18px',
                  background: 'var(--mantine-color-default-hover)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--mantine-color-text)',
                  letterSpacing: '0.5px'
                }
              }}
            />
          </Box>

          {/* Featured Row */}
          <Box>
            <Group gap="xs" mb="lg">
              <IconFlame color="#ff8c00" size={20} />
              <Text fw={700} tt="uppercase" size="sm" c="dimmed">Featured Markets</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {hotMarkets.length > 0 ? (
                hotMarkets.map(item => (
                  <FeaturedMarket key={item.symbol} item={item} type={spotStats.some(s => s.symbol === item.symbol) ? 'spot' : 'futures'} />
                ))
              ) : (
                Array(4).fill(0).map((_, i) => (
                  <Paper key={i} radius="md" p="md" style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', height: rem(100) }}>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Box h={14} w={60} bg="var(--bg-2)" style={{ borderRadius: 4 }} />
                        <Box h={18} w={18} bg="var(--bg-2)" style={{ borderRadius: 4 }} />
                      </Group>
                      <Box h={24} w="80%" bg="var(--bg-2)" style={{ borderRadius: 4 }} />
                      <Box h={12} w="30%" bg="var(--bg-2)" style={{ borderRadius: 4 }} />
                    </Stack>
                  </Paper>
                ))
              )}
            </SimpleGrid>
          </Box>

          {/* Market Tabs & Table */}
          <Box>
            <Tabs value={activeTab} onChange={setActiveTab} variant="unstyled">
              <Box
                className="market-tabs-container"
                mb="lg"
                style={{
                  maxWidth: '100vw',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  padding: '4px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-1)',
                  background: 'var(--bg-1)',
                  marginRight: rem(-16),
                  marginLeft: rem(-16),
                  paddingRight: rem(16),
                  paddingLeft: rem(16),
                }}
              >
                <Tabs.List style={{ gap: '4px', border: 'none', flexWrap: 'nowrap', width: 'max-content' }}>
                  {[
                    { val: 'spot-usdt', label: 'Spot', quote: 'USDT', icon: IconBolt, count: spotUSDT.length },
                    { val: 'spot-usdc', label: 'Spot', quote: 'USDC', icon: IconBolt, count: spotUSDC.length },
                    { val: 'futures-usdt', label: 'Futures', quote: 'USDT', icon: IconActivity, count: futuresUSDT.length },
                    { val: 'futures-usdc', label: 'Futures', quote: 'USDC', icon: IconActivity, count: futuresUSDC.length },
                  ].map((t) => {
                    const isActive = activeTab === t.val;
                    return (
                      <Tabs.Tab
                        key={t.val}
                        value={t.val}
                        style={{
                          transition: 'all 0.3s ease',
                          background: isActive ? 'rgba(0, 150, 255, 0.1)' : 'transparent',
                          border: '1px solid',
                          borderColor: isActive ? 'rgba(0, 150, 255, 0.3)' : 'transparent',
                          borderRadius: '12px',
                          padding: '8px 16px',
                        }}
                      >
                        <Group gap={10} wrap="nowrap">
                          <ThemeIcon
                            variant={isActive ? 'filled' : 'light'}
                            color={isActive ? 'blue' : 'gray'}
                            size="sm"
                            radius="md"
                          >
                            <t.icon size={14} />
                          </ThemeIcon>
                          <Box>
                            <Group gap={6} wrap="nowrap">
                              <Text size="sm" fw={700} c={isActive ? 'var(--mantine-color-text)' : 'dimmed'}>{t.label}</Text>
                              <Badge
                                size="xs"
                                variant={isActive ? 'filled' : 'light'}
                                color={isActive ? 'blue' : 'gray'}
                                radius="sm"
                                style={{ fontSize: '9px', height: '14px' }}
                              >
                                {t.quote}
                              </Badge>
                            </Group>
                          </Box>
                          <Text size="xs" c="dimmed" fw={500} style={{ opacity: isActive ? 1 : 0.6 }}>
                            {t.count}
                          </Text>
                        </Group>
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>
              </Box>

              <Tabs.Panel value="spot-usdt"><MarketTable data={spotUSDT} type="spot" /></Tabs.Panel>
              <Tabs.Panel value="spot-usdc"><MarketTable data={spotUSDC} type="spot" /></Tabs.Panel>
              <Tabs.Panel value="futures-usdt"><MarketTable data={futuresUSDT} type="futures" /></Tabs.Panel>
              <Tabs.Panel value="futures-usdc"><MarketTable data={futuresUSDC} type="futures" /></Tabs.Panel>
            </Tabs>
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}



