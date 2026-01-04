import { useState, useEffect, useRef } from 'react'
import { Button, Group, Text, Box, Title, Stack, PasswordInput, TextInput, NavLink, Paper, Grid, Divider, ActionIcon, CopyButton, Tooltip, Avatar } from '@mantine/core'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { IconLock, IconCheck, IconShieldLock, IconUser, IconSettings, IconCopy, IconCheck as IconCheckSmall, IconLogout, IconCamera, IconTrash } from '@tabler/icons-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { API_BASE } from '../config/api'

export default function Settings() {
  const { logout, accessToken } = useAuth()
  const { email, username: currentUsername, referralCode, profilePicture: currentPfp, refreshBalances } = useAccount()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'profile'

  // Profile State
  const [newUsername, setNewUsername] = useState(currentUsername || '')
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password State
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    if (currentUsername) setNewUsername(currentUsername)
  }, [currentUsername])

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const updateProfile = async (updates: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(updates)
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to update profile')

      notifications.show({
        title: 'Success',
        message: 'Profile updated successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 2000
      })
      refreshBalances()
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' })
    }
  }

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Square crop & resize (PFP style)
          const size = Math.min(width, height);
          canvas.width = maxWidth;
          canvas.height = maxHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Failed to get canvas context');

          // Draw square crop
          ctx.drawImage(
            img,
            (width - size) / 2, (height - size) / 2, size, size,
            0, 0, maxWidth, maxHeight
          );

          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onPfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const resizedBase64 = await resizeImage(file, 512, 512);
      updateProfile({ profilePicture: resizedBase64 });
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to process image', color: 'red' });
    }
  }

  const onChangeUsername = async () => {
    if (!newUsername || newUsername === currentUsername) return
    setUpdatingUsername(true)
    await updateProfile({ username: newUsername })
    setUpdatingUsername(false)
  }

  const removePfp = () => {
    updateProfile({ profilePicture: null })
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

    setPasswordLoading(true)
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
      setPasswordLoading(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
  }

  return (
    <Box p={{ base: 'md', md: 'xl' }} mih="calc(100vh - 100px)">
      <Stack gap="xl" maw={1200} mx="auto">
        <Box>
          <Title order={1} size="h2" fw={700} style={{ letterSpacing: '-0.02em' }}>Settings</Title>
          <Text c="dimmed" size="sm">Manage your account preferences and security settings</Text>
        </Box>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Stack gap={4}>
              <NavLink
                label="Profile"
                description="Public identity and referrals"
                leftSection={<IconUser size={20} stroke={1.5} />}
                active={activeTab === 'profile'}
                onClick={() => handleTabChange('profile')}
                variant="light"
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
              />
              <NavLink
                label="Security"
                description="Password and authentication"
                leftSection={<IconShieldLock size={20} stroke={1.5} />}
                active={activeTab === 'security'}
                onClick={() => handleTabChange('security')}
                variant="light"
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
              />
              <NavLink
                label="Account"
                description="Session and account status"
                leftSection={<IconSettings size={20} stroke={1.5} />}
                active={activeTab === 'account'}
                onClick={() => handleTabChange('account')}
                variant="light"
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
              />
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 9 }}>
            <Paper withBorder radius="lg" p={{ base: 'md', md: 'xl' }} className="glass-card" style={{ minHeight: 400 }}>
              {activeTab === 'profile' && (
                <Stack gap="xl">
                  <Box>
                    <Text fw={700} size="lg">Profile Settings</Text>
                    <Text size="sm" c="dimmed">Your identity on VirCEX</Text>
                  </Box>

                  <Divider opacity={0.1} />

                  <Group gap="xl" align="flex-start">
                    <Stack align="center" gap="xs">
                      <Box style={{ position: 'relative' }}>
                        <Avatar
                          src={currentPfp || undefined} // Use undefined to ensure IconUser fallback
                          size={100}
                          radius={100}
                        >
                          <IconUser size={40} />
                        </Avatar>
                        <ActionIcon
                          variant="filled"
                          size="md"
                          radius="xl"
                          style={{ position: 'absolute', bottom: 0, right: 0 }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <IconCamera size={16} />
                        </ActionIcon>
                      </Box>
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={onPfpUpload}
                      />
                      {currentPfp && (
                        <Button variant="subtle" color="red" size="compact-xs" leftSection={<IconTrash size={12} />} onClick={removePfp}>
                          Remove
                        </Button>
                      )}
                    </Stack>

                    <Stack gap="lg" style={{ flex: 1 }} maw={500}>
                      <Box>
                        <Text size="sm" fw={600} mb={4}>Email Address</Text>
                        <TextInput
                          value={email || ''}
                          readOnly
                          disabled
                          classNames={{ input: 'glass-input' }}
                          styles={{ input: { opacity: 0.6, cursor: 'not-allowed' } }}
                        />
                        <Text size="xs" c="dimmed" mt={4}>Your email is used for login and notifications</Text>
                      </Box>

                      <Box>
                        <Text size="sm" fw={600} mb={4}>Username</Text>
                        <Group gap="xs" align="flex-start" wrap="nowrap">
                          <TextInput
                            placeholder="institutional_trader"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            flex={1}
                            maxLength={20}
                            classNames={{ input: 'glass-input' }}
                            rightSection={<Text size="xs" c="dimmed" pr="xs">{newUsername.length}/20</Text>}
                            rightSectionWidth={60}
                            error={newUsername.length > 0 && newUsername.length < 3 ? "Minimum 3 characters" : null}
                          />
                          <Button
                            loading={updatingUsername}
                            onClick={onChangeUsername}
                            disabled={!newUsername || newUsername === currentUsername || newUsername.length < 3}
                          >
                            Save
                          </Button>
                        </Group>
                        <Text size="xs" c="dimmed" mt={4}>This name will be displayed on your Share PNL cards</Text>
                      </Box>

                      <Box>
                        <Text size="sm" fw={600} mb={4}>Referral Code</Text>
                        <Paper withBorder p="xs" radius="md" style={{ background: 'rgba(0,0,0,0.05)', borderStyle: 'dashed' }}>
                          <Group justify="space-between">
                            <Text fw={700} ff="monospace" size="md" c="var(--mantine-primary-color-filled)">{referralCode || 'NOT_ASSIGNED'}</Text>
                            <CopyButton value={referralCode || ''} timeout={2000}>
                              {({ copied, copy }) => (
                                <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
                                  <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                                    {copied ? <IconCheckSmall size={16} /> : <IconCopy size={16} />}
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </CopyButton>
                          </Group>
                        </Paper>
                        <Text size="xs" c="dimmed" mt={4}>Share this code to earn referral rewards</Text>
                      </Box>
                    </Stack>
                  </Group>
                </Stack>
              )}

              {activeTab === 'security' && (
                <Stack gap="xl">
                  <Box>
                    <Text fw={700} size="lg">Security</Text>
                    <Text size="sm" c="dimmed">Protect your account with a strong password</Text>
                  </Box>

                  <Divider opacity={0.1} />

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
                        loading={passwordLoading}
                        onClick={onChangePassword}
                        disabled={!oldPassword || !newPassword || !confirmPassword}
                      >
                        Update Password
                      </Button>
                    </Group>
                  </Stack>
                </Stack>
              )}

              {activeTab === 'account' && (
                <Stack gap="xl">
                  <Box>
                    <Text fw={700} size="lg">Account Management</Text>
                    <Text size="sm" c="dimmed">Manage your current session</Text>
                  </Box>

                  <Divider opacity={0.1} />

                  <Box>
                    <Text fw={600} size="md" mb="xs">Danger Zone</Text>
                    <Paper withBorder p="xl" radius="md" style={{ borderColor: 'rgba(255,0,0,0.2)', background: 'rgba(255,0,0,0.02)' }}>
                      <Group justify="space-between">
                        <Box>
                          <Text fw={600}>Sign Out</Text>
                          <Text size="sm" c="dimmed">End your current session on this device</Text>
                        </Box>
                        <Button color="red" variant="light" onClick={onLogout} leftSection={<IconLogout size={16} />}>Logout</Button>
                      </Group>
                    </Paper>
                  </Box>
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Box>
  )
}


