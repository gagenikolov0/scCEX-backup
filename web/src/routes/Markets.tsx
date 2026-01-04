import { useMemo, useState, useEffect, memo } from 'react'
import { Card, TextInput, Anchor, Box, Flex, Group, Text, Stack, Tabs, Pagination } from '@mantine/core'
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
      <Flex direction="column" px="xl" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', transition: 'background-color 0.1s ease' }} className="market-row-hover">
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

const MarketTable = memo(({ data, type }: { data: any[], type: 'spot' | 'futures' }) => {
  const [page, setPage] = useState(1)
  const pageSize = 20
  const totalPages = Math.ceil(data.length / pageSize)

  // Reset page when data type changes significantly (optional, but good UX if switching logical views)
  useEffect(() => setPage(1), [type])

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page])

  return (
    <Card padding={0} radius="md" withBorder shadow="xs">
      <Flex px="xl" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }} bg="var(--mantine-color-default-border)" justify="space-between" align="center">
        <Text size="sm" fw={600}>Market Pairs</Text>
        <Text size="xs" c="dimmed">24h Change</Text>
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
      {totalPages > 1 && (
        <Flex justify="center" p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Flex>
      )}
    </Card>
  )
})

export default function Markets() {
  const { spotStats, futuresStats, listen, unlisten } = useMarket()
  const [q, setQ] = useState('')
  const [activeTab, setActiveTab] = useState<string | null>('spot-usdt')

  // Optimize Listeners based on Active Tab
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
  }, [activeTab])

  const filterFn = (t: any) => !q || t.symbol.toLowerCase().includes(q.toLowerCase())

  // Memoize filtered lists
  const spotUSDT = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDT')).filter(filterFn), [spotStats, q])
  const spotUSDC = useMemo(() => spotStats.filter(t => t.symbol.endsWith('USDC')).filter(filterFn), [spotStats, q])
  const futuresUSDT = useMemo(() => futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDT')).filter(filterFn), [futuresStats, q])
  const futuresUSDC = useMemo(() => futuresStats.filter((f: any) => typeof f.symbol === 'string' && f.symbol.endsWith('_USDC')).filter(filterFn), [futuresStats, q])

  return (
    <Stack gap="md" maw={1280} mx="auto" w="100%">
      <Flex align="center" justify="space-between" gap="md">
        <Text size="xl" fw={700}>Markets</Text>
        <TextInput placeholder="Search..." value={q} onChange={e => setQ(e.currentTarget.value)} maw={300} w="100%" />
      </Flex>

      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
        <Tabs.List grow mb="md">
          <Tabs.Tab value="spot-usdt">Spot USDT</Tabs.Tab>
          <Tabs.Tab value="spot-usdc">Spot USDC</Tabs.Tab>
          <Tabs.Tab value="futures-usdt">Futures USDT</Tabs.Tab>
          <Tabs.Tab value="futures-usdc">Futures USDC</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="spot-usdt">
          <MarketTable data={spotUSDT} type="spot" />
        </Tabs.Panel>
        <Tabs.Panel value="spot-usdc">
          <MarketTable data={spotUSDC} type="spot" />
        </Tabs.Panel>
        <Tabs.Panel value="futures-usdt">
          <MarketTable data={futuresUSDT} type="futures" />
        </Tabs.Panel>
        <Tabs.Panel value="futures-usdc">
          <MarketTable data={futuresUSDC} type="futures" />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}


