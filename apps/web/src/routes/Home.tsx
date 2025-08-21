import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export default function Home() {
  const navigate = useNavigate()
  const [addr, setAddr] = useState<null | { address: string; asset: string; chain: string }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAddress = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${API_URL}/api/user/deposit-address`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to fetch address')
      }
      const j = await res.json()
      setAddr(j)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {}
    localStorage.removeItem('accessToken')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Home</h1>
        <button onClick={logout} className="rounded border px-3 py-2">Logout</button>
      </div>
      <button onClick={fetchAddress} disabled={loading} className="rounded bg-black text-white px-4 py-2">
        {loading ? 'Loading...' : 'Show Deposit Address'}
      </button>
      {error && <p className="text-red-600 mt-3 text-sm">{error}</p>}
      {addr && (
        <div className="mt-4 p-4 border rounded">
          <p className="font-mono">{addr.address}</p>
          <p className="text-sm text-gray-500">{addr.asset} on {addr.chain}</p>
        </div>
      )}
    </div>
  )
}


