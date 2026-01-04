
import { Box, Title, Text, Stack, Button, Container, SimpleGrid, ThemeIcon, Flex, Badge, Group, Paper } from '@mantine/core'
import { IconRocket, IconShieldLock, IconHeadset, IconArrowRight, IconCurrencyBitcoin, IconTrendingUp, IconUsers, IconCloudComputing } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useMarket } from '../contexts/MarketContext'
import { useMemo, useEffect } from 'react'
import { SpotlightCard } from '../components/SpotlightCard'
import { CountUp } from '../components/CountUp'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { TradingTerminalPreview } from '../components/TradingTerminalPreview'

const FEATURES = [
  {
    icon: IconShieldLock,
    title: 'Bank-Grade Security',
    description: 'Your assets are protected by industry-leading cold storage and encryption protocols.',
    color: 'blue'
  },
  {
    icon: IconRocket,
    title: 'Lightning Fast Engine',
    description: 'Execute trades in microseconds with our ultra-low latency matching engine.',
    color: 'grape'
  },
  {
    icon: IconHeadset,
    title: '24/7 Global Support',
    description: 'Our dedicated team is always available to help you succeed in your trading journey.',
    color: 'cyan'
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
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={60} style={{ alignItems: 'center' }}>

            {/* Left Content */}
            <Stack gap="xl" className="reveal-on-scroll visible">
              <Group>
                <Badge variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }} size="lg" radius="md" style={{ textTransform: 'none' }}>
                  Next Generation Exchange
                </Badge>
              </Group>

              <Title order={1} size={72} fw={900} style={{ lineHeight: 1.1, letterSpacing: '-1px' }}>
                Trade with <br />
                <Text span inherit className="animate-text-shimmer">Confidence</Text>
              </Title>

              <Text c="dimmed" size="xl" maw={500} lh={1.6}>
                Experience the world's most advanced crypto exchange. Fast execution, liquid markets, and pro-level tools.
              </Text>

              <Group pt="md">
                <Button size="xl" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} onClick={() => navigate('/spot')}>
                  Start Trading Now
                </Button>
                <Button size="xl" radius="md" variant="light" color="gray" onClick={() => navigate('/markets')}>
                  Explore Markets
                </Button>
              </Group>

              {/* Trust Indicators */}
              <Group gap="xl" mt="xl">
                <Stack gap={4}>
                  <Flex align="center" gap={4}>
                    <IconTrendingUp size={24} />
                    <CountUp end={10} prefix="$" suffix="B+" fw={700} size="xl" />
                  </Flex>
                  <Text size="sm" c="dimmed">Quarterly Volume</Text>
                </Stack>
                <Box w={1} h={40} bg="var(--mantine-color-default-border)" />
                <Stack gap={4}>
                  <Flex align="center" gap={4}>
                    <IconUsers size={24} />
                    <CountUp end={2} suffix="M+" fw={700} size="xl" decimals={0} />
                  </Flex>
                  <Text size="sm" c="dimmed">Verified Users</Text>
                </Stack>
                <Box w={1} h={40} bg="var(--mantine-color-default-border)" />
                <Stack gap={4}>
                  <Flex align="center" gap={4}>
                    <IconCloudComputing size={24} />
                    <CountUp end={50} prefix="< " suffix="ms" fw={700} size="xl" decimals={0} />
                  </Flex>
                  <Text size="sm" c="dimmed">Latency</Text>
                </Stack>
              </Group>
            </Stack>

            {/* Right Content - 3D Visuals */}
            <Box style={{ position: 'relative', height: '500px' }} visibleFrom="md" className="reveal-on-scroll visible">
              <SpotlightCard
                style={{ position: 'absolute', top: '50px', right: '0', width: '100%', zIndex: 10, borderRadius: '32px' }}
              >
                <TradingTerminalPreview />
              </SpotlightCard>

              {/* Floating elements behind */}
              <SpotlightCard className="glass-card" style={{ position: 'absolute', bottom: '0%', left: '-5%', padding: '20px', borderRadius: '24px', width: '220px', zIndex: 11 }}>
                <Flex align="center" justify="space-between" mb="xs">
                  <Group gap="xs">
                    <ThemeIcon color="orange" variant="light" size="sm" radius="lg"><IconCurrencyBitcoin size={16} /></ThemeIcon>
                    <Text fw={700} size="sm">Bitcoin</Text>
                  </Group>
                  <Text fw={700} c="green" size="sm">+5.2%</Text>
                </Flex>
                <Text size="xl" fw={700}>$96,420</Text>
              </SpotlightCard>
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
                    <Text fw={700} size="lg" truncate style={{ flex: 1 }}>{asset.symbol.replace('USDT', '')}/USDT</Text>
                    <Badge variant="light" color={change >= 0 ? 'green' : 'red'} style={{ flexShrink: 0 }}>
                      {change > 0 ? '+' : ''}{change.toFixed(2)}%
                    </Badge>
                  </Flex>
                  <Text size="28px" fw={700} mb={4} truncate>
                    {parseFloat(asset.lastPrice) < 0.01
                      ? parseFloat(asset.lastPrice).toFixed(8)
                      : parseFloat(asset.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>Vol: {parseFloat(asset.volume24h).toLocaleString()}</Text>
                </SpotlightCard>
              )
            }) : (
              // Skeletons
              Array(4).fill(0).map((_, i) => (
                <SpotlightCard key={i} className="glass-card reveal-on-scroll" radius="lg" p="lg">
                  <Text c="dimmed">Loading market data...</Text>
                </SpotlightCard>
              ))
            )}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box style={{ position: 'relative', zIndex: 1 }} py={100}>
        <Container size="lg">
          <Paper radius="xl" p={0} style={{ background: 'transparent' }}>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing={40}>
              {FEATURES.map((feature, i) => (
                <Stack key={i} p="xl" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }} className="reveal-on-scroll">
                  <ThemeIcon
                    variant="gradient"
                    gradient={{ from: feature.color, to: 'cyan' }}
                    size={60}
                    radius="xl"
                    mb="md"
                    style={{ transition: 'none' }}
                  >
                    <feature.icon size={30} />
                  </ThemeIcon>
                  <Title order={3} size="h3" mb="xs">{feature.title}</Title>
                  <Text c="dimmed" lh={1.6}>
                    {feature.description}
                  </Text>
                </Stack>
              ))}
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
              <Title order={2} size={50} fw={800}>Ready to start trading?</Title>
              <Text c="dimmed" size="xl" maw={600}>
                Join the fastest growing exchange today.
              </Text>
              <Button
                size="xl"
                radius="full"
                rightSection={<IconArrowRight />}
                variant="white"
                color="dark"
                px={40}
                onClick={() => navigate('/auth')}
              >
                Create Free Account
              </Button>
            </Stack>
          </SpotlightCard>
        </Container>
      </Box>
    </Box>
  )
}

