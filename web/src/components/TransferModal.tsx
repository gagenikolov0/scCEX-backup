import { useEffect, useState } from 'react'
import { Modal, Button, TextInput, Tabs, Group, Text } from '@mantine/core'
import { API_BASE } from '../config/api'
import { useAccount } from '../contexts/AccountContext'
import TradeSlider from './TradeSlider'

type Props = {
  opened: boolean
  onClose: () => void
  currentSide: 'spot' | 'futures'
  asset: 'USDT' | 'USDC'
  onTransferred?: () => void
}

export default function TransferModal({ opened, onClose, currentSide, asset, onTransferred }: Props) {
  const [direction, setDirection] = useState<'to-other' | 'from-other'>('to-other')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [percent, setPercent] = useState(0)
  const other = currentSide === 'spot' ? 'futures' : 'spot'

  const { spotAvailable, futuresAvailable } = useAccount()

  const getMax = () => {
    const from = direction === 'to-other' ? currentSide : other
    if (from === 'spot') {
      return parseFloat((spotAvailable as any)?.[asset] || '0')
    } else {
      return parseFloat((futuresAvailable as any)?.[asset] || '0')
    }
  }

  const maxAmount = getMax()

  useEffect(() => {
    if (opened) {
      setAmount('')
      setDirection('to-other')
      setPercent(0)
    }
  }, [opened])

  const handleSliderChange = (val: number) => {
    setPercent(val)
    if (val === 100) {
      setAmount(maxAmount.toString())
    } else {
      setAmount(((maxAmount * val) / 100).toFixed(6).replace(/\.?0+$/, ''))
    }
  }

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      const from = direction === 'to-other' ? currentSide : other
      const to = direction === 'to-other' ? other : currentSide
      const res = await fetch(`${API_BASE}/api/user/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ asset, from, to, amount })
      })
      if (!res.ok) {
        // Optional: surface error
        return
      }
      onTransferred && onTransferred()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Transfer ${asset}`} centered lockScroll={false}>
      <Tabs
        value={direction}
        onChange={(v) => {
          setDirection(v as any)
          setAmount('')
          setPercent(0)
        }}
        variant="pills"
        radius="md"
        mb="sm"
      >
        <Tabs.List grow>
          <Tabs.Tab value="to-other" style={{ textTransform: 'capitalize' }}>{currentSide} → {other}</Tabs.Tab>
          <Tabs.Tab value="from-other" style={{ textTransform: 'capitalize' }}>{other} → {currentSide}</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Text size="xs" c="dimmed" ta="right" mb={4}>
        Available: <Text component="span" fw={600} style={{ color: 'var(--foreground)' }}>{Number(maxAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset}</Text>
      </Text>

      <TextInput
        label="Amount"
        placeholder="0.00"
        value={amount}
        onChange={(e) => {
          setAmount(e.currentTarget.value)
          setPercent(0) // Reset slider if manually typing
        }}
        mb="xs"
      />

      <TradeSlider value={percent} onChange={handleSliderChange} />

      <Group justify="right" mt="md">
        <Button onClick={submit} loading={submitting} disabled={!amount || Number(amount) <= 0}>
          Transfer
        </Button>
      </Group>
    </Modal>
  )
}
