import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, TextInput, Paper, Box, Stack, Title, Text, Center, Anchor } from '@mantine/core'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})
type FormValues = z.infer<typeof schema>

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const [serverError, setServerError] = useState<string | null>(null)

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    try {
      await login(data.email, data.password)
      navigate('/')
    } catch (e: any) {
      setServerError(e.message ?? 'Login failed')
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Paper shadow="sm" radius="md" withBorder p="xl" w="100%" maw={400}>
        <Title order={1} size="h3" mb="lg">Login</Title>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            <Box>
              <TextInput {...register('email')} placeholder="Email" label="Email" error={errors.email?.message} />
            </Box>
            <Box>
              <TextInput type="password" {...register('password')} placeholder="Password" label="Password" error={errors.password?.message} />
            </Box>
            {serverError && <Text size="sm" color="red">{serverError}</Text>}
            <Button type="submit" loading={isSubmitting} fullWidth size="md" color="dark">
              Sign in
            </Button>
          </Stack>
        </form>
        <Text size="sm" mt="md" ta="center">
          No account? <Anchor component={Link} to="/register" color="blue">Register</Anchor>
        </Text>
      </Paper>
    </Center>
  )
}

export function Register() {
  const navigate = useNavigate()
  const { register: registerApi } = useAuth()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const [serverError, setServerError] = useState<string | null>(null)

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    try {
      await registerApi(data.email, data.password)
      navigate('/')
    } catch (e: any) {
      setServerError(e.message ?? 'Register failed')
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Paper shadow="sm" radius="md" withBorder p="xl" w="100%" maw={400}>
        <Title order={1} size="h3" mb="lg">Create account</Title>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap="md">
            <Box>
              <TextInput {...register('email')} placeholder="Email" label="Email" error={errors.email?.message} />
            </Box>
            <Box>
              <TextInput type="password" {...register('password')} placeholder="Password" label="Password" error={errors.password?.message} />
            </Box>
            {serverError && <Text size="sm" color="red">{serverError}</Text>}
            <Button type="submit" loading={isSubmitting} fullWidth size="md" color="dark">
              Create account
            </Button>
          </Stack>
        </form>
        <Text size="sm" mt="md" ta="center">
          Have an account? <Anchor component={Link} to="/login" color="blue">Login</Anchor>
        </Text>
      </Paper>
    </Center>
  )
}


