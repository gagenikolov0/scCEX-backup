import { useState } from 'react'
import { Button, Card, Group, Text, Box, Title, Stack, PasswordInput } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { IconLock, IconCheck, IconShieldLock } from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE } from '../config/api'

export default function Settings() {
  const { logout, accessToken } = useAuth()
  const navigate = useNavigate()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const onChangePassword = async () => {
    if (!oldPassword || !newPassword) return
    if (newPassword !== confirmPassword) {
      notifications.show({ title: 'Error', message: 'New passwords do not match', color: 'red' })
      return
    }
    if (newPassword.length < 8) {
      notifications.show({ title: 'Error', message: 'Password must be at least 8 characters', color: 'red' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to update password')

      notifications.show({ title: 'Success', message: 'Password updated successfully', color: 'green', icon: <IconCheck size={18} /> })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box p="xl" mih="calc(100vh - 100px)">
      <Stack gap="lg" maw={800}>
        <Title order={1} size="h2" fw={600}>Settings</Title>

        <Card withBorder radius="md" p="xl" className="glass-card">
          <Group mb="md">
            <IconShieldLock size={24} color="var(--mantine-color-blue-5)" />
            <Text fw={600} size="lg">Security</Text>
          </Group>

          <Stack gap="md" maw={400}>
            <PasswordInput
              label="Current Password"
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              leftSection={<IconLock size={16} />}
              classNames={{ input: 'glass-input' }}
            />
            <PasswordInput
              label="New Password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              leftSection={<IconLock size={16} />}
              classNames={{ input: 'glass-input' }}
            />
            <PasswordInput
              label="Confirm New Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftSection={<IconLock size={16} />}
              classNames={{ input: 'glass-input' }}
            />
            <Group justify="flex-end" mt="xs">
              <Button
                loading={loading}
                onClick={onChangePassword}
                disabled={!oldPassword || !newPassword || !confirmPassword}
              >
                Change Password
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md" className="glass-card">
          <Group justify="space-between">
            <Box>
              <Text fw={600} c="red">Danger Zone</Text>
              <Text size="sm" c="dimmed">Sign out of your account on this device</Text>
            </Box>
            <Button color="red" variant="light" onClick={onLogout}>Logout</Button>
          </Group>
        </Card>
      </Stack>
    </Box>
  )
}


