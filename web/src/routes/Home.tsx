import { Box, Title, Text, Stack, Button, Container, SimpleGrid, ThemeIcon, Flex, Badge, Group, Paper } from '@mantine/core'
import { IconRocket, IconArrowRight, IconCloudComputing, IconFingerprint, IconEye, IconSearch, IconShieldCheck } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useMarket } from '../contexts/MarketContext'
import { useMemo, useEffect } from 'react'
import { SpotlightCard } from '../components/SpotlightCard'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { TradingTerminalPreview } from '../components/TradingTerminalPreview'
import { SocialTradingVisual } from '../components/SocialTradingVisual'

const FEATURES = [
  {
    icon: IconShieldCheck,
    title: 'Verifiable Performance',
    description: 'Every PnL card shared on VirCEX is cryptographically verified against real trade history. No fakes.',
    color: 'blue'
  },
  {
    icon: IconFingerprint,
    title: 'Identity Assurance',
    description: 'Verify the proof of funds and historical consistency of any trader on the platform.',
    color: 'cyan'
  },
  {
    icon: IconRocket,
    title: 'High-Frequency Execution',
    description: 'Trade with the same low-latency infrastructure used by institutional wholesalers.',
    color: 'indigo'
  }
]

export default function Home() {
  const navigate = useNavigate()
  const { spotStats } = useMarket()

  const topAssets = useMemo(() => {
    const targets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
    return targets.map(t => spotStats.find(s => s.symbol.endsWith(t))).filter(Boolean) as any[]
  }, [spotStats])

  // Scroll Entrance Observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, { threshold: 0.1 })

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <Box style={{ overflow: 'hidden', position: 'relative' }}>

      {/* Background Ambience */}
      <ParticlesBackground />
      <Box style={{
        position: 'absolute', top: '-10%', left: '25%', width: '50%', height: '500px',
        background: 'radial-gradient(circle, rgba(50, 100, 255, 0.1) 0%, transparent 60%)',
        zIndex: 0, filter: 'blur(100px)', animation: 'float 10s infinite ease-in-out'
      }} />

      {/* Hero Section */}
      <Box style={{ position: 'relative', zIndex: 1 }} py={120} px="md">
        <Container size="lg">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={80} style={{ alignItems: 'center' }}>

            {/* Left Content */}
            <Stack gap="xl" className="reveal-on-scroll visible">
              <Group>
                <Badge variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} size="lg" radius="md" style={{ textTransform: 'none' }}>
                  Institutional Transparency
                </Badge>
              </Group>

              <Title order={1} size={72} fw={950} style={{ lineHeight: 1.05, letterSpacing: '-2px' }}>
                Trade with <br />
                <Text span inherit className="animate-text-shimmer" style={{ backgroundClip: 'text', WebkitBackgroundClip: 'text' }}>Transparency.</Text>
              </Title>

              <Text c="dimmed" size="xl" maw={500} lh={1.6} fw={500}>
                The era of fake PnL cards is over. Experience the first exchange where every position, every trade, and every profile is <Text span inherit c="blue" fw={700}>verifiably real.</Text>
              </Text>

              <Group pt="md">
                <Button size="xl" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'indigo' }} onClick={() => navigate('/spot')}>
                  Start Trading
                </Button>
                <Button size="xl" radius="md" variant="light" color="gray" onClick={() => navigate('/markets')}>
                  Explore Markets
                </Button>
              </Group>

              {/* Trust Indicators - Non-Hardcoded Labels */}
              <Group gap="xl" mt="xl">
                <Stack gap={4}>
                  <Flex align="center" gap={4}>
                    <IconShieldCheck size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={800} size="lg">Verified</Text>
                  </Flex>
                  <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '1px' }}>PnL Accuracy</Text>
                </Stack>
                <Box w={1} h={40} bg="rgba(255,255,255,0.1)" />
                <Stack gap={4}>
                  <Flex align="center" gap={4}>
                    <IconFingerprint size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={800} size="lg">Public</Text>
                  </Flex>
                  <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '1px' }}>Proof of Funds</Text>
                </Stack>
                <Box w={1} h={40} bg="rgba(255,255,255,0.1)" />
                <Stack gap={4}>
                  <Flex align="center" gap={4}>
                    <IconCloudComputing size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={800} size="lg">High</Text>
                  </Flex>
                  <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '1px' }}>Throughput</Text>
                </Stack>
              </Group>
            </Stack>

            {/* Right Content - Social Transparency Visual */}
            <Box style={{ position: 'relative', height: '400px' }} visibleFrom="md" className="reveal-on-scroll visible">
              <SocialTradingVisual />
            </Box>

          </SimpleGrid>
        </Container>
      </Box>

      {/* Market Ticker Section */}
      <Box style={{ position: 'relative', zIndex: 1 }} py={60}>
        <Container size="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {topAssets.length > 0 ? topAssets.map(asset => {
              const change = parseFloat(asset.change24h || '0')
              return (
                <SpotlightCard
                  key={asset.symbol}
                  className="glass-card reveal-on-scroll"
                  p="lg" radius="lg"
                  onClick={() => navigate(`/spot?base=${asset.symbol.replace('USDT', '')}&quote=USDT`)}
                  style={{ cursor: 'pointer', height: '100%' }}
                >
                  <Flex justify="space-between" align="start" mb="sm" style={{ overflow: 'hidden' }}>
                    <Text fw={800} size="lg" truncate style={{ flex: 1 }}>{asset.symbol.replace('USDT', '')}/USDT</Text>
                    <Badge variant="light" color={change >= 0 ? 'green' : 'red'} style={{ flexShrink: 0 }}>
                      {change > 0 ? '+' : ''}{change.toFixed(2)}%
                    </Badge>
                  </Flex>
                  <Text size="28px" fw={950} mb={4} truncate style={{ letterSpacing: '-1px' }}>
                    {parseFloat(asset.lastPrice) < 0.01
                      ? parseFloat(asset.lastPrice).toFixed(8)
                      : parseFloat(asset.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </Text>
                  <Text size="xs" c="dimmed" truncate tt="uppercase" fw={700} style={{ letterSpacing: '0.5px' }}>Vol: {parseFloat(asset.volume24h).toLocaleString()}</Text>
                </SpotlightCard>
              )
            }) : (
              // Skeletons
              Array(4).fill(0).map((_, i) => (
                <SpotlightCard key={i} className="glass-card reveal-on-scroll" radius="lg" p="lg">
                  <Text c="dimmed">Syncing market infrastructure...</Text>
                </SpotlightCard>
              ))
            )}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box style={{ position: 'relative', zIndex: 1 }} py={100}>
        <Container size="lg">
          <Stack align="center" mb={60} className="reveal-on-scroll">
            <Badge size="xl" variant="light" color="indigo" radius="md">Security Core</Badge>
            <Title order={2} size={48} fw={950} style={{ letterSpacing: '-1px' }}>Built for the <Text span inherit c="indigo">Elite.</Text></Title>
          </Stack>
          <Paper radius="xl" p={0} style={{ background: 'transparent' }}>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={40}>
              {FEATURES.map((feature, i) => (
                <Stack key={i} p="xl" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }} className="reveal-on-scroll">
                  <ThemeIcon
                    variant="gradient"
                    gradient={{ from: feature.color, to: 'cyan' }}
                    size={60}
                    radius="md"
                    mb="md"
                    style={{ transition: 'none' }}
                  >
                    <feature.icon size={30} />
                  </ThemeIcon>
                  <Title order={3} size="h3" mb="xs" fw={800}>{feature.title}</Title>
                  <Text c="dimmed" lh={1.6}>
                    {feature.description}
                  </Text>
                </Stack>
              ))}
            </SimpleGrid>
          </Paper>
        </Container>
      </Box>

      {/* Social Transparency & Trader Insights Section */}
      <Box style={{ position: 'relative', zIndex: 1 }} py={100} bg="rgba(0,0,0,0.2)">
        <Container size="lg">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={80} style={{ alignItems: 'center' }}>

            {/* Visual Showcase - Live Terminal Preview instead of mocks */}
            <Box style={{ position: 'relative' }} className="reveal-on-scroll">
              <SpotlightCard className="glass-card" p={0} radius="xl" style={{ overflow: 'hidden' }}>
                <TradingTerminalPreview />
              </SpotlightCard>
            </Box>

            {/* Content */}
            <Stack gap="xl" className="reveal-on-scroll">
              <Badge variant="light" color="blue" size="lg" radius="md">Social Insight</Badge>
              <Title order={2} size={48} fw={950} style={{ lineHeight: 1.1, letterSpacing: '-1.5px' }}>
                No more fake <br />
                <Text span inherit c="blue">PnL Cards.</Text>
              </Title>
              <Text c="dimmed" size="lg" lh={1.6}>
                Trust is earned, not claimed. Every shared PnL link on VirCEX leads to a cryptographically signed trader profile where you can verify their history, open positions, and current ranking.
              </Text>

              <SimpleGrid cols={2} spacing="md">
                <Box>
                  <Flex align="center" gap="xs" mb={4}>
                    <IconShieldCheck size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={800} size="sm">Proof of Performance</Text>
                  </Flex>
                  <Text size="xs" c="dimmed">100% verified historical trade data directly from the matching engine.</Text>
                </Box>
                <Box>
                  <Flex align="center" gap="xs" mb={4}>
                    <IconEye size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={800} size="sm">Real-time Visibility</Text>
                  </Flex>
                  <Text size="xs" c="dimmed">Monitor institutional whales and top alpha traders in real-time.</Text>
                </Box>
              </SimpleGrid>

              <Button
                variant="filled"
                size="lg"
                radius="md"
                color="blue"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setTimeout(() => {
                    (document.querySelector('input[placeholder*="Search"]') as any)?.focus();
                  }, 500);
                }}
                leftSection={<IconSearch size={18} />}
              >
                Find Top Traders
              </Button>
            </Stack>

          </SimpleGrid>
        </Container>
      </Box>

      {/* Extreme Leverage Section */}
      <Box style={{ position: 'relative', zIndex: 1 }} py={120}>
        <Container size="lg">
          <Paper
            className="glass-card reveal-on-scroll"
            p={60}
            radius="32px"
            style={{
              overflow: 'hidden',
              background: 'radial-gradient(circle at 100% 0%, rgba(50, 150, 255, 0.1) 0%, transparent 50%), var(--glass-bg)'
            }}
          >
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={60} style={{ alignItems: 'center' }}>
              <Stack gap="xl">
                <Badge variant="light" color="red" size="lg" radius="md">High-Performance Core</Badge>
                <Title order={2} size={56} fw={950} style={{ lineHeight: 1, letterSpacing: '-2px' }}>
                  Maximum Power. <br />
                  <Text span inherit className="animate-text-shimmer">Zero Compromise.</Text>
                </Title>
                <Text c="dimmed" size="xl" fw={500} lh={1.6}>
                  Experience the raw speed of our matching engine with leverage options built for professional alpha hunters.
                </Text>
                <Group gap="xl">
                  <Stack gap={4}>
                    <Text fw={950} size="42px" c="var(--mantine-color-red-6)" style={{ letterSpacing: '-2px', lineHeight: 1 }}>1000x</Text>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>Max Leverage</Text>
                  </Stack>
                  <Box w={1} h={50} bg="rgba(255,255,255,0.1)" />
                  <Stack gap={4}>
                    <Text fw={950} size="42px" style={{ letterSpacing: '-2px', lineHeight: 1 }}>&lt; 1ms</Text>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={800}>Engine Latency</Text>
                  </Stack>
                </Group>
                <Button
                  size="xl"
                  radius="md"
                  variant="gradient"
                  gradient={{ from: 'red', to: 'orange' }}
                  onClick={() => navigate('/futures')}
                  maw={240}
                  rightSection={<IconRocket size={20} />}
                >
                  Trade Futures
                </Button>
              </Stack>

              <Box style={{ position: 'relative' }} visibleFrom="md">
                <Box style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  width: '300px', height: '300px', borderRadius: '50%',
                  background: 'conic-gradient(from 180deg at 50% 50%, var(--mantine-color-red-6) 0deg, transparent 270deg)',
                  opacity: 0.1, filter: 'blur(40px)', animation: 'rotate 10s linear infinite'
                }} />
                <Stack align="center" gap={0}>
                  <Text
                    fw={950}
                    style={{
                      fontSize: '180px',
                      lineHeight: 1,
                      letterSpacing: '-10px',
                      background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.2))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      opacity: 0.8
                    }}
                  >
                    1000x
                  </Text>
                  <Badge
                    variant="filled"
                    color="red"
                    size="xl"
                    radius="sm"
                    style={{ marginTop: '-40px', transform: 'rotate(-2deg)', boxShadow: '0 10px 30px rgba(255,0,0,0.3)' }}
                  >
                    INSTITUTIONAL GRADE
                  </Badge>
                </Stack>
              </Box>
            </SimpleGrid>
          </Paper>
        </Container>
      </Box>

      {/* CTA Footer */}
      <Box py={100} px="md" style={{ position: 'relative', zIndex: 1 }}>
        <Container size="lg">
          <SpotlightCard
            className="glass-card reveal-on-scroll"
            radius="30px"
            p={80}
            style={{ overflow: 'hidden', position: 'relative', textAlign: 'center' }}
          >
            <Box style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(50, 200, 255, 0.2) 0%, transparent 70%)',
              zIndex: 0, filter: 'blur(60px)'
            }} />

            <Stack align="center" gap="xl" style={{ position: 'relative', zIndex: 1 }}>
              <Title order={2} size={50} fw={950} style={{ letterSpacing: '-2px' }}>Join the Transparency Era</Title>
              <Text c="dimmed" size="xl" maw={600} fw={500}>
                The world's first verifiably transparent exchange is here.
              </Text>
              <Button
                size="xl"
                radius="md"
                rightSection={<IconArrowRight />}
                variant="white"
                color="dark"
                px={40}
                fw={800}
                onClick={() => navigate('/register')}
              >
                Create Diamond Account
              </Button>
            </Stack>
          </SpotlightCard>
        </Container>
      </Box>
    </Box>
  )
}

