import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type AuthContextValue = {
  accessToken: string | null
  isReady: boolean
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'))
  const [isReady, setIsReady] = useState(false)

  const persist = useCallback((token: string | null) => {
    if (token) localStorage.setItem('accessToken', token)
    else localStorage.removeItem('accessToken')
    setAccessToken(token)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return
      const j = await res.json()
      if (j?.accessToken) persist(j.accessToken)
    } catch {}
  }, [persist])

  useEffect(() => {
    (async () => {
      if (!accessToken) await refresh()
      setIsReady(true)
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Login failed')
    const j = await res.json()
    persist(j.accessToken)
  }, [persist])

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Register failed')
    const j = await res.json()
    persist(j.accessToken)
  }, [persist])

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch {}
    persist(null)
  }, [persist])

  const value: AuthContextValue = useMemo(() => ({
    accessToken,
    isReady,
    isAuthed: !!accessToken,
    login,
    register,
    logout,
  }), [accessToken, isReady, login, register, logout])

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


