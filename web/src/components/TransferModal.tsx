import { useEffect, useState } from 'react'
import { Modal, Button, TextInput, SegmentedControl, Group } from '@mantine/core'
import { API_BASE } from '../config/api'

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
  const other = currentSide === 'spot' ? 'futures' : 'spot'

  useEffect(() => {
    if (opened) { setAmount(''); setDirection('to-other') }
  }, [opened])

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
    <Modal opened={opened} onClose={onClose} title={`Transfer ${asset}`} centered>
      <Group gap="sm" mb="sm">
        <SegmentedControl
          value={direction}
          onChange={(v) => setDirection(v as any)}
          data={[
            { label: `${currentSide} → ${other}`, value: 'to-other' },
            { label: `${other} → ${currentSide}`, value: 'from-other' },
          ]}
        />
      </Group>
      <TextInput
        label="Amount"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.currentTarget.value)}
        mb="md"
      />
      <Group justify="right">
        <Button onClick={submit} loading={submitting}>
          Transfer
        </Button>
      </Group>
    </Modal>
  )
}


