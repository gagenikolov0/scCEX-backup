import { Group, Text, Stack, Badge, Grid, Paper, NavLink, Box, Flex } from '@mantine/core'
import { useAccount } from '../contexts/AccountContext'
import { useState } from 'react'

export default function Wallet() {
  const { spotAvailable, futuresAvailable, positions, totalPortfolioUSD } = useAccount()
  const [activeTab, setActiveTab] = useState('overview')

  const formatUSD = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const formatBalance = (amount: string) => parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'spot', label: 'Spot' },
    { id: 'futures', label: 'Futures' }
  ]

  const totalFuturesValue = parseFloat(futuresAvailable.USDT) + parseFloat(futuresAvailable.USDC)

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">Spot Balance</Text>
                  <Text size="xl" fw={600}>{formatUSD(totalPortfolioUSD - totalFuturesValue)}</Text>
                </Stack>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">Futures Balance</Text>
                  <Text size="xl" fw={600}>{formatUSD(totalFuturesValue)}</Text>
                </Stack>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">Total Balance</Text>
                  <Text size="xl" fw={600}>{formatUSD(totalPortfolioUSD)}</Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        )

      case 'futures':
        return (
          <>
            <Paper withBorder p="lg" radius="md" mb="md">
              <Text size="sm" c="dimmed">Total Futures Value</Text>
              <Text size="2xl" fw={700} c="blue">{formatUSD(totalFuturesValue)}</Text>
            </Paper>
            <Grid gutter="md">
              {['USDT', 'USDC'].map(asset => {
                const available = (futuresAvailable as any)[asset] || '0'
                return (
                  <Grid.Col key={asset} span={{ base: 12, sm: 6, md: 4 }}>
                    <Paper withBorder p="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">{asset} Futures</Text>
                          <Badge color="blue" variant="light">Isolated</Badge>
                        </Group>
                        <Text size="xl" fw={600}>{formatBalance(available)}</Text>
                      </Stack>
                    </Paper>
                  </Grid.Col>
                )
              })}
            </Grid>
          </>
        )

      case 'spot':
        return (
          <>
            <Paper withBorder p="lg" radius="md" mb="md">
              <Text size="sm" c="dimmed">Total Spot Value</Text>
              <Text size="2xl" fw={700} c="green">{formatUSD(totalPortfolioUSD - totalFuturesValue)}</Text>
            </Paper>
            <Grid gutter="md">
              {['USDT', 'USDC'].map(asset => {
                const position = positions.find(p => p.asset === asset)
                const reserved = position?.reserved || '0'
                return (
                  <Grid.Col key={asset} span={{ base: 12, sm: 6, md: 4 }}>
                    <Paper withBorder p="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">{asset} Balance</Text>
                          <Badge color={asset === 'USDT' ? 'green' : 'blue'} variant="light">Stable</Badge>
                        </Group>
                        <Text size="xl" fw={600}>{formatBalance(spotAvailable[asset as keyof typeof spotAvailable])}</Text>
                        {parseFloat(reserved) > 0 && (
                          <Text size="sm" c="dimmed">Reserved: {formatBalance(reserved)}</Text>
                        )}
                      </Stack>
                    </Paper>
                  </Grid.Col>
                )
              })}
              {positions.filter(p => !['USDT', 'USDC'].includes(p.asset)).map(position => (
                <Grid.Col key={position.asset} span={{ base: 12, sm: 6, md: 4 }}>
                  <Paper withBorder p="md" radius="md">
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">{position.asset} Balance</Text>
                      <Text size="xl" fw={600}>{formatBalance(position.available)}</Text>
                      {parseFloat(position.reserved || '0') > 0 && (
                        <Text size="sm" c="dimmed">Reserved: {formatBalance(position.reserved)}</Text>
                      )}
                    </Stack>
                  </Paper>
                </Grid.Col>
              ))}
            </Grid>
          </>
        )
    }
  }

  return (
    <Flex mih="calc(100vh - 100px)">
      <Box w={200} style={{ borderRight: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-default-border)' }}>
        <Stack gap={4} p="md">
          {tabs.map(tab => (
            <NavLink
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant="filled"
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            />
          ))}
        </Stack>
      </Box>
      <Box p="xl" flex={1}>
        {renderContent()}
      </Box>
    </Flex>
  )
}
