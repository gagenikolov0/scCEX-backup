import { Button, Card, Group, Text } from '@mantine/core'
import { Link } from 'react-router-dom'

export default function Wallet() {
  return (
    <div className="min-h-screen p-6">
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={600}>Wallet</Text>
        <Button component={Link} to="/deposit" color="dark">Deposit</Button>
      </Group>
      <Card withBorder radius="md" p="md">
        <Text c="dimmed" size="sm">Balances (coming soon)</Text>
      </Card>
    </div>
  )
}


