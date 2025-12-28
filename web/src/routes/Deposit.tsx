import { useMemo, useState } from 'react'
import { Button, Box, Title, Select, Text, Stack, Paper } from '@mantine/core'
import QRCode from 'react-qr-code'
import { API_BASE } from '../config/api'

const CHAINS = ['ETH', 'TRON', 'BSC', 'SOL', 'XRP'] as const
type Chain = typeof CHAINS[number]

export default function Deposit() {
  type AddressGroup = {
    ethAddress?: string | null
    tronAddress?: string | null
    bscAddress?: string | null
    solAddress?: string | null
    xrpAddress?: string | null
  }

  const [group, setGroup] = useState<AddressGroup | null>(null)
  const [chain, setChain] = useState<Chain>('ETH')
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

  const currentAddress = useMemo(() => {
    if (!group) return null
    const addressKey = `${chain.toLowerCase()}Address` as keyof AddressGroup
    return group[addressKey] ?? null
  }, [group, chain])

  return (
    <Box p="xl" mih="calc(100vh - 100px)">
      <Title order={1} size="h2" mb="lg">Deposit</Title>

      <Stack gap="md" maw={400}>
        <Select
          label="Chain"
          value={chain}
          onChange={(val) => setChain(val as Chain)}
          data={CHAINS as unknown as string[]}
          size="sm"
        />

        <Button onClick={fetchAddress} loading={loading} variant="filled" color="dark">
          Show Deposit Address
        </Button>

        {error && <Text color="red" size="sm">{error}</Text>}

        {group && (
          <Paper withBorder p="md" radius="md">
            {currentAddress ? (
              <Stack gap="xs" align="center">
                <Text fw={500} ff="monospace" ta="center" style={{ wordBreak: 'break-all' }}>
                  {currentAddress}
                </Text>
                <Text size="xs" c="dimmed">{chain}</Text>
                <Box p="md" mt="sm" style={{ background: 'var(--qr-bg)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <QRCode value={currentAddress} size={160} />
                </Box>
              </Stack>
            ) : (
              <Text color="red" size="sm">No address set for {chain}</Text>
            )}
          </Paper>
        )}
      </Stack>
    </Box>
  )
}


