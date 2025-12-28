import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../config/api'


type AuthContextValue = {
  accessToken: string | null
  isReady: boolean
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'))
  const [isReady, setIsReady] = useState(() => {
    const token = localStorage.getItem('accessToken');
    // If we have a token, we optimistically assume we are ready to render
    return !!token;
  })

  const persist = useCallback((token: string | null) => {
    if (token) localStorage.setItem('accessToken', token)
    else localStorage.removeItem('accessToken')

    setAccessToken(current => {
      if (current === token) return current;
      return token;
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        // If refresh is invalid/expired, force logout state
        if (res.status === 401 || res.status === 403) persist(null)
        return
      }
      const j = await res.json()
      if (j?.accessToken) persist(j.accessToken)
    } catch { }
  }, [persist])

  const verify = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      })
      if (!res.ok) {
        // If user deleted or token invalid, clear immediately
        if (res.status === 401 || res.status === 404) persist(null)
      }
    } catch {
      // network errors: do nothing; keep current state
    }
  }, [persist])

  useEffect(() => { // Initial check
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (res.ok) {
          const j = await res.json()
          if (j?.accessToken) {
            persist(j.accessToken)
            // No need to verify if we just got a fresh token from refresh
            setIsReady(true)
            return
          }
        }
      } catch { }

      // If refresh failed or no token, try to verify existing local token
      const existing = localStorage.getItem('accessToken')
      if (existing) {
        try {
          const res = await fetch(`${API_BASE}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${existing}` },
            credentials: 'include',
          })
          if (!res.ok) persist(null)
        } catch { }
      }

      setIsReady(true)
    })()
  }, [persist, refresh, verify])

  // Background silent refresh cadence (every 10 minutes)
  useEffect(() => {
    if (!accessToken) return
    const id = setInterval(() => { refresh().then(verify) }, 10 * 60 * 1000)

    return () => {
      clearInterval(id)
    }
  }, [accessToken, refresh, verify])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
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
    const res = await fetch(`${API_BASE}/api/auth/register`, {
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
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch { }
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


