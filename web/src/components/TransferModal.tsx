import { useEffect, useState } from 'react'
import { Modal, Button, TextInput, Group, Text, Stack, Box, ActionIcon, UnstyledButton, Menu } from '@mantine/core'
import { API_BASE } from '../config/api'
import { useAccount } from '../contexts/AccountContext'
import TradeSlider from './TradeSlider'
import { IconArrowDown, IconChevronDown, IconWallet } from '@tabler/icons-react'

type Props = {
  opened: boolean
  onClose: () => void
  currentSide: 'spot' | 'futures'
  initialAsset?: 'USDT' | 'USDC'
  onTransferred?: () => void
}

export default function TransferModal({ opened, onClose, currentSide, initialAsset, onTransferred }: Props) {
  // 'spot' means from Spot to Futures
  // 'futures' means from Futures to Spot
  // We simplify direction state to just tracking the "From" wallet type
  const [fromWallet, setFromWallet] = useState<'spot' | 'futures'>(currentSide)
  const [asset, setAsset] = useState<'USDT' | 'USDC'>(initialAsset || 'USDT')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [percent, setPercent] = useState(0)

  const toWallet = fromWallet === 'spot' ? 'futures' : 'spot'

  const { spotAvailable, futuresAvailable } = useAccount()

  useEffect(() => {
    if (initialAsset) setAsset(initialAsset)
  }, [initialAsset, opened])

  // Reset state when opening
  useEffect(() => {
    if (opened) {
      setFromWallet(currentSide)
      setAmount('')
      setPercent(0)
    }
  }, [opened, currentSide])

  const getMax = (wallet: 'spot' | 'futures') => {
    if (wallet === 'spot') {
      return parseFloat((spotAvailable as any)?.[asset] || '0')
    } else {
      return parseFloat((futuresAvailable as any)?.[asset] || '0')
    }
  }

  const maxAmount = getMax(fromWallet)
  const toBalance = getMax(toWallet)

  const handleSwap = () => {
    setFromWallet(toWallet)
    setAmount('')
    setPercent(0)
  }

  const handleSliderChange = (val: number) => {
    setPercent(val)
    if (val === 100) {
      setAmount(maxAmount.toFixed(8).replace(/\.?0+$/, ''))
    } else {
      setAmount(((maxAmount * val) / 100).toFixed(8).replace(/\.?0+$/, ''))
    }
  }

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${API_BASE}/api/user/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ asset, from: fromWallet, to: toWallet, amount })
      })
      if (!res.ok) return
      onTransferred && onTransferred()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // Asset Icon
  const AssetIcon = ({ coin }: { coin: string }) => (
    <Box w={20} h={20} style={{ borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src={coin === 'USDT' ? '/usdt.png' : '/usdc.png'}
        alt={coin}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Box>
  )

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg">Transfer</Text>}
      centered
      lockScroll={false}
      radius="lg"
      overlayProps={{ blur: 4, backgroundOpacity: 0.4 }}
    >
      <Stack gap={0}>

        {/* FROM CARD */}
        <Box
          bg="var(--bg-2)"
          p="md"
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            border: '1px solid var(--mantine-color-default-border)'
          }}
        >
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed" fw={600}>From</Text>
            <Text size="xs" c="dimmed">Balance: <Text span c="var(--mantine-color-text)">{maxAmount.toFixed(4)} {asset}</Text></Text>
          </Group>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Box p={6} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '8px' }}>
                <IconWallet size={18} />
              </Box>
              <Text fw={700} tt="capitalize">{fromWallet} Account</Text>
            </Group>
          </Group>
        </Box>

        {/* SWAP BUTTON (Overlay) */}
        <Box h={10} style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <ActionIcon
            variant="filled"
            color="var(--bg-2)"
            size="lg"
            radius="xl"
            onClick={handleSwap}
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              color: 'var(--mantine-color-text)'
            }}
          >
            <IconArrowDown size={18} />
          </ActionIcon>
        </Box>

        {/* TO CARD */}
        <Box
          bg="var(--bg-2)"
          p="md"
          pt="lg" // Extra padding top to account for overlap
          mt={-10}
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            border: '1px solid var(--mantine-color-default-border)'
          }}
        >
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed" fw={600}>To</Text>
            <Text size="xs" c="dimmed">Balance: <Text span c="var(--mantine-color-text)">{toBalance.toFixed(4)} {asset}</Text></Text>
          </Group>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Box p={6} bg="rgba(255,255,255,0.05)" style={{ borderRadius: '8px' }}>
                <IconWallet size={18} />
              </Box>
              <Text fw={700} tt="capitalize">{toWallet} Account</Text>
            </Group>
          </Group>
        </Box>

        {/* AMOUNT & ASSET */}
        <Box mt="lg">
          <Text size="sm" fw={600} mb="xs">Amount</Text>
          <Box
            bg="transparent"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-md)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px 12px',
              overflow: 'hidden'
            }}
          >
            <TextInput
              value={amount}
              onChange={(e) => {
                setAmount(e.currentTarget.value)
                setPercent(0)
              }}
              placeholder="0.00"
              variant="unstyled"
              size="md"
              styles={{ input: { fontSize: '20px', fontWeight: 600 } }}
              style={{ flex: 1, minWidth: 0 }}
            />

            <Group gap="xs">
              <Button
                variant="light"
                size="compact-xs"
                radius="sm"
                tt="uppercase"
                fw={700}
                onClick={() => handleSliderChange(100)}
              >
                Max
              </Button>

              <Box w={1} h={20} bg="var(--mantine-color-default-border)" mx={4} />

              {/* Asset Select */}
              <Menu shadow="md" width={120} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton>
                    <Group gap={6}>
                      <AssetIcon coin={asset} />
                      <Text fw={700} size="sm">{asset}</Text>
                      <IconChevronDown size={14} style={{ opacity: 0.5 }} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  {['USDT', 'USDC'].map(coin => (
                    <Menu.Item
                      key={coin}
                      leftSection={<AssetIcon coin={coin} />}
                      onClick={() => setAsset(coin as any)}
                      bg={asset === coin ? 'var(--mantine-color-default-hover)' : undefined}
                    >
                      {coin}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Box>
        </Box>

        <Box mt="xs" mb="lg">
          <TradeSlider value={percent} onChange={handleSliderChange} />
        </Box>

        <Button
          size="lg"
          radius="md"
          fullWidth
          onClick={submit}
          loading={submitting}
          disabled={!amount || Number(amount) <= 0}
          color="blue"
          style={{ fontSize: '1rem' }}
        >
          Confirm Transfer
        </Button>

      </Stack>
    </Modal>
  )
}
