import { useMemo, useState, useEffect, memo } from 'react'
import { Card, TextInput, Anchor, Box, Flex, Group, Text, Stack, Grid } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useMarket } from '../contexts/MarketContext'

function splitSymbol(sym: string): { base: string; quote: string } {
  const clean = sym.replace('_', '')
  if (clean.endsWith('USDT')) return { base: clean.slice(0, -4), quote: 'USDT' }
  if (clean.endsWith('USDC')) return { base: clean.slice(0, -4), quote: 'USDC' }
  return { base: clean, quote: '' }
}

const MarketRow = memo(({ item, type, base, quote }: { item: any, type: 'spot' | 'futures', base: string, quote: string }) => {
  const price = item.lastPrice ?? ''
  const change = item.change24h ?? 0
  const high = item.high24h ?? ''
  const low = item.low24h ?? ''
  const vol = item.volume24h ? parseFloat(item.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 }) : ''

  const changeNum = parseFloat(String(change)) || 0
  const changeColor = changeNum > 0 ? '--green' : changeNum < 0 ? '--red' : 'dimmed'

  return (
    <Anchor key={`${type}-${quote.toLowerCase()}-${item.symbol}`} component={Link} to={`/${type}?base=${base}&quote=${quote}`} underline="never" c="inherit">
      <Flex direction="column" px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', transition: 'background-color 0.1s ease' }} className="market-row-hover">
        <Flex justify="space-between" align="center" mb={4}>
          <Group gap={8}>
            <Text size="sm" fw={700}>{base}</Text>
            <Text size="xs" fw={500} c="dimmed" px={4} bg="var(--mantine-color-default-border)" style={{ borderRadius: 'var(--mantine-radius-xs)' }}>{quote}</Text>
          </Group>
          <Text size="sm" fw={700} c={changeColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {changeNum > 0 ? '+' : ''}{changeNum.toFixed(2)}%
          </Text>
        </Flex>
        <Flex justify="space-between" align="flex-end">
          <Text size="lg" fw={600} ff="monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>{price}</Text>
          <Flex direction="column" align="flex-end" gap={2}>
            <Flex gap={4} ff="monospace" tt="uppercase" style={{ letterSpacing: '-0.02em' }}>
              <Text size="xxs" component="span" c="green" opacity={0.7}>H </Text><Text size="xxs" component="span">{high}</Text>
              <Text size="xxs" component="span" c="red" opacity={0.7} ml={4}>L </Text><Text size="xxs" component="span">{low}</Text>
            </Flex>
            <Flex gap={4} align="center" style={{ fontFamily: 'monospace' }} c="dimmed">
              <Text size="xxs" component="span" opacity={0.7}>VOL</Text> <Text size="xxs" component="span">{vol}</Text>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Anchor>
  )
})

const RenderMarketCard = memo(({ title, data, type }: { title: string, data: any[], type: 'spot' | 'futures' }) => (
  <Card padding={0} radius="md" withBorder shadow="xs">
    <Flex p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }} bg="var(--mantine-color-default-border)" justify="space-between" align="center">
      <Text size="sm" fw={600}>{title}</Text>
      <Text size="xs" c="dimmed">24h Change</Text>
    </Flex>
    <Box style={{ maxHeight: '440px', overflow: 'auto' }}>
      {data.map(item => {
        const baseInfo = splitSymbol(item.symbol)
        return <MarketRow key={`${type}-${item.symbol}`} item={item} type={type} base={baseInfo.base} quote={baseInfo.quote} />
      })}
    </Box>
  </Card>
))

export default function Markets() {
  const { spotStats, futuresStats, listen, unlisten } = useMarket()
  const [q, setQ] = useState('')

  useEffect(() => {
    listen('spot')
    listen('futures')
    return () => {
      unlisten('spot')
      unlisten('futures')
    }
  }, [])

  const filterFn = (t: any) => !q || t.symbol.toLowerCase().includes(q.toLowerCase())

  const spotUSDT = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDT')).filter(filterFn), [spotStats, q])
  const spotUSDC = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDC')).filter(filterFn), [spotStats, q])
  const futuresUSDT = useMemo(() => futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDT')).filter(filterFn), [futuresStats, q])
  const futuresUSDC = useMemo(() => futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDC')).filter(filterFn), [futuresStats, q])

  return (
    <Stack gap="md">
      <Flex align="center" gap="md">
        <TextInput placeholder="Search (e.g. BTC, SOL)" value={q} onChange={e => setQ(e.currentTarget.value)} maw={320} w="100%" />
      </Flex>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <RenderMarketCard title="Spot · USDT" data={spotUSDT} type="spot" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <RenderMarketCard title="Spot · USDC" data={spotUSDC} type="spot" />
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <RenderMarketCard title="Futures · USDT Perpetuals" data={futuresUSDT} type="futures" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <RenderMarketCard title="Futures · USDC Perpetuals" data={futuresUSDC} type="futures" />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}


