import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button, TextInput, Paper } from '@mantine/core'

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <Paper shadow="sm" radius="md" withBorder className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold mb-4">Login</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <TextInput {...register('email')} placeholder="Email" />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <TextInput type="password" {...register('password')} placeholder="Password" />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} fullWidth size="md" color="dark">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="text-sm mt-3">No account? <Link to="/register" className="text-blue-600">Register</Link></p>
      </Paper>
    </div>
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <Paper shadow="sm" radius="md" withBorder className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold mb-4">Create account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <TextInput {...register('email')} placeholder="Email" />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <TextInput type="password" {...register('password')} placeholder="Password" />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} fullWidth size="md" color="dark">
            {isSubmitting ? 'Creating...' : 'Create account'}
          </Button>
        </form>
        <p className="text-sm mt-3">Have an account? <Link to="/login" className="text-blue-600">Login</Link></p>
      </Paper>
    </div>
  )
}


