import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})
type FormValues = z.infer<typeof schema>

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export function Login() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  })
  const [serverError, setServerError] = useState<string | null>(null)

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setServerError(j.error ?? 'Login failed')
      return
    }
    const j = await res.json()
    localStorage.setItem('accessToken', j.accessToken)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-lg border">
        <h1 className="text-xl font-semibold mb-4">Login</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <input {...register('email')} placeholder="Email" className="w-full border rounded px-3 py-2" />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <input type="password" {...register('password')} placeholder="Password" className="w-full border rounded px-3 py-2" />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <button disabled={isSubmitting} className="w-full bg-black text-white rounded px-3 py-2">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-sm mt-3">No account? <Link to="/register" className="text-blue-600">Register</Link></p>
      </div>
    </div>
  )
}

export function Register() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  })
  const [serverError, setServerError] = useState<string | null>(null)

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setServerError(j.error ?? 'Register failed')
      return
    }
    const j = await res.json()
    localStorage.setItem('accessToken', j.accessToken)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-lg border">
        <h1 className="text-xl font-semibold mb-4">Create account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <input {...register('email')} placeholder="Email" className="w-full border rounded px-3 py-2" />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <input type="password" {...register('password')} placeholder="Password" className="w-full border rounded px-3 py-2" />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <button disabled={isSubmitting} className="w-full bg-black text-white rounded px-3 py-2">
            {isSubmitting ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <p className="text-sm mt-3">Have an account? <Link to="/login" className="text-blue-600">Login</Link></p>
      </div>
    </div>
  )
}


