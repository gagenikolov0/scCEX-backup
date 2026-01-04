import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, TextInput, Box, Stack, Title, Text, Center, Anchor, Group, ThemeIcon, Container, SimpleGrid, Progress } from '@mantine/core'
import { IconMail, IconLock, IconShieldLock, IconArrowBackUp, IconFingerprint, IconUserPlus, IconLogin, IconActivity, IconLockAccess } from '@tabler/icons-react'
import { ParticlesBackground } from '../components/ParticlesBackground'
import { SpotlightCard } from '../components/SpotlightCard'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormValues = z.infer<typeof schema>

const SecurityStat = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
  <Group gap="md">
    <ThemeIcon variant="light" color="cyan" size="lg" radius="md">
      <Icon size={20} />
    </ThemeIcon>
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: '0.5px' }}>{label}</Text>
      <Text fw={700} size="sm">{value}</Text>
    </Box>
  </Group>
)

export default function AuthHub() {
  const location = useLocation()
  const initialMode = location.pathname.includes('register') ? 'register' : 'login'
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  const navigate = useNavigate()
  const { login, register: registerApi } = useAuth()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  })
  const [serverError, setServerError] = useState<string | null>(null)

  const passwordValue = watch('password', '')
  const passwordStrength = useMemo(() => {
    if (!passwordValue) return 0
    let strength = 0
    if (passwordValue.length >= 8) strength += 25
    if (/[A-Z]/.test(passwordValue)) strength += 25
    if (/[0-9]/.test(passwordValue)) strength += 25
    if (/[!@#$%^&*]/.test(passwordValue)) strength += 25
    return strength
  }, [passwordValue])

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    try {
      if (mode === 'login') {
        await login(data.email, data.password)
      } else {
        await registerApi(data.email, data.password)
      }
      navigate('/')
    } catch (e: any) {
      setServerError(e.message ?? `${mode === 'login' ? 'Login' : 'Registration'} failed`)
    }
  }

  return (
    <Box style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', background: 'var(--mantine-color-body)' }}>
      <ParticlesBackground />

      <Center mih="100vh" style={{ position: 'relative', zIndex: 1 }}>
        <Container size="xl" w="100%">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0} style={{ borderRadius: '32px', overflow: 'hidden', boxShadow: '0 0 100px rgba(0,0,0,0.5)' }}>

            {/* Left Panel: Security Core (Visual) */}
            <Box style={{
              background: 'var(--mantine-color-default-hover)',
              backdropFilter: 'blur(20px)',
              padding: '60px',
              borderRight: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }} visibleFrom="md">


              <Stack gap="xl">
                <Group gap="xs">
                  <ThemeIcon variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} size="xl" radius="lg">
                    <IconShieldLock size={24} />
                  </ThemeIcon>
                  <Title order={2} size={24} ff="monospace" style={{ letterSpacing: '2px' }}>scCEX SECURE</Title>
                </Group>

                <Box py={40}>
                  <Title order={1} size={48} fw={900} style={{ lineHeight: 1.1 }}>
                    Access the <br />
                    <Text span inherit>Institutional</Text> <br />
                    Portal
                  </Title>
                  <Text c="dimmed" size="lg" mt="md" maw={400}>
                    Enter the world's most secure trading perimeter. Encrypted, audited, and ultra-fast.
                  </Text>
                </Box>

                <Stack gap="lg">
                  <SecurityStat icon={IconActivity} label="System Status" value="Operational 99.99%" />
                  <SecurityStat icon={IconFingerprint} label="Security Protocol" value="AES-256 Multi-Layer" />
                  <SecurityStat icon={IconLockAccess} label="Session Audit" value="ISO/IEC 27001 Certified" />
                </Stack>
              </Stack>
              <Text size="xs" c="dimmed">v3.4.0 High-Sec Build</Text>
            </Box>

            {/* Right Panel: Auth Action Center */}
            <Box style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(40px)',
              padding: '60px',
              position: 'relative'
            }}>
              <Stack gap="xl">
                {/* Mode Toggle */}
                <Group justify="space-between" align="center">
                  <Anchor component={Link} to="/" c="dimmed" size="sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconArrowBackUp size={18} />
                    Exit
                  </Anchor>

                  <Box style={{
                    background: 'var(--mantine-color-default-hover)',
                    padding: '4px',
                    borderRadius: '12px',
                    display: 'flex',
                    border: '1px solid var(--glass-border)'
                  }}>
                    <Button
                      variant={mode === 'login' ? 'filled' : 'transparent'}
                      color={mode === 'login' ? 'blue' : 'gray'}
                      size="xs"
                      radius="md"
                      onClick={() => { setMode('login'); setServerError(null); }}
                      style={{ transition: 'all 0.3s' }}
                    >
                      Login
                    </Button>
                    <Button
                      variant={mode === 'register' ? 'filled' : 'transparent'}
                      color={mode === 'register' ? 'blue' : 'gray'}
                      size="xs"
                      radius="md"
                      onClick={() => { setMode('register'); setServerError(null); }}
                      style={{ transition: 'all 0.3s' }}
                    >
                      Register
                    </Button>
                  </Box>
                </Group>

                <Box>
                  <Title order={2} size={32}>
                    {mode === 'login' ? 'Authorize Access' : 'Create Identity'}
                  </Title>
                  <Text c="dimmed" size="sm">
                    {mode === 'login' ? 'Enter your credentials to breach the perimeter' : 'Establish your secure trading credentials'}
                  </Text>
                </Box>

                <SpotlightCard p={0} radius="24px" className="glass-card no-move" style={{ border: 'none' }}>
                  <Box p={30}>
                    <form onSubmit={handleSubmit(onSubmit)}>
                      <Stack gap="md">
                        <TextInput
                          {...register('email')}
                          placeholder="operator@scccex.com"
                          label="Institutional Email"
                          error={errors.email?.message}
                          leftSection={<IconMail size={18} />}
                          classNames={{ input: 'glass-input' }}
                          radius="md"
                          size="lg"
                        />

                        <Stack gap={4}>
                          <TextInput
                            type="password"
                            {...register('password')}
                            placeholder="••••••••"
                            label="Security Key"
                            error={errors.password?.message}
                            leftSection={<IconLock size={18} />}
                            classNames={{ input: 'glass-input' }}
                            radius="md"
                            size="lg"
                          />
                          {mode === 'register' && passwordValue && (
                            <Box mt={4}>
                              <Group justify="space-between" mb={4}>
                                <Text size="xs" fw={700} c="dimmed">Entropy Level</Text>
                                <Text size="xs" fw={700} c={passwordStrength > 75 ? 'green' : passwordStrength > 50 ? 'yellow' : 'red'}>
                                  {passwordStrength}%
                                </Text>
                              </Group>
                              <Progress
                                value={passwordStrength}
                                size="xs"
                                color={passwordStrength > 75 ? 'green' : passwordStrength > 50 ? 'yellow' : 'red'}
                                radius="xl"
                                style={{ background: 'var(--mantine-color-default-hover)', border: '1px solid var(--glass-border)' }}
                              />
                            </Box>
                          )}
                        </Stack>

                        {serverError && (
                          <Text size="sm" c="red" fw={600} ta="center" mt="xs">
                            {serverError}
                          </Text>
                        )}

                        <Button
                          type="submit"
                          loading={isSubmitting}
                          fullWidth
                          size="xl"
                          radius="md"
                          variant="gradient"
                          gradient={mode === 'login' ? { from: 'blue', to: 'cyan' } : { from: 'indigo', to: 'violet' }}
                          mt="md"
                          rightSection={mode === 'login' ? <IconLogin size={20} /> : <IconUserPlus size={20} />}
                        >
                          {mode === 'login' ? 'Request Login' : 'Initialize Account'}
                        </Button>
                      </Stack>
                    </form>
                  </Box>
                </SpotlightCard>

                <Group justify="center" gap="xs">
                  <IconShieldLock size={14} color="gray" />
                  <Text size="xs" c="dimmed">Quantum-Resistant Encryption Active</Text>
                </Group>
              </Stack>
            </Box>
          </SimpleGrid>
        </Container>
      </Center>
    </Box>
  )
}

