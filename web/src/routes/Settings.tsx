import { Button, Card, Group, Text } from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const toggleTheme = () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
  const { logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen p-6">
      <Text size="xl" fw={600} mb="md">Settings</Text>
      <Card withBorder radius="md" p="md" mb="md">
        <Group justify="space-between">
          <div>
            <Text fw={500}>Theme</Text>
            <Text size="sm" c="dimmed">Current: {colorScheme}</Text>
          </div>
          <Button variant="default" onClick={toggleTheme}>Toggle theme</Button>
        </Group>
      </Card>
      <Card withBorder radius="md" p="md">
        <Group justify="space-between">
          <div>
            <Text fw={500}>Logout</Text>
            <Text size="sm" c="dimmed">Sign out of your account</Text>
          </div>
          <Button color="red" onClick={onLogout}>Logout</Button>
        </Group>
      </Card>
    </div>
  )
}


