import { Button, Card, Group, Text, Box, Title, Stack } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box p="xl" mih="calc(100vh - 100px)">
      <Stack gap="md">
        <Title order={1} size="h2" fw={600}>Settings</Title>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between">
            <Box>
              <Text fw={600}>Logout</Text>
              <Text size="sm" c="dimmed">Sign out of your account</Text>
            </Box>
            <Button color="red" onClick={onLogout}>Logout</Button>
          </Group>
        </Card>
      </Stack>
    </Box>
  )
}


