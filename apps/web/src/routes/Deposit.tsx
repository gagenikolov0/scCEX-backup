import { useMemo, useState } from 'react'
import { Button } from '@mantine/core'
import QRCode from 'react-qr-code'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export default function Deposit() {
  type AddressGroup = {
    ethAddress?: string | null
    tronAddress?: string | null
    bscAddress?: string | null
    solAddress?: string | null
    xrpAddress?: string | null
  }
  const [group, setGroup] = useState<AddressGroup | null>(null)
  const [chain, setChain] = useState<'ETH'|'TRON'|'BSC'|'SOL'|'XRP'>('ETH')
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
      setGroup(j)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const currentAddress = useMemo(() => {
    if (!group) return null
    switch (chain) {
      case 'ETH': return group.ethAddress ?? null
      case 'TRON': return group.tronAddress ?? null
      case 'BSC': return group.bscAddress ?? null
      case 'SOL': return group.solAddress ?? null
      case 'XRP': return group.xrpAddress ?? null
      default: return null
    }
  }, [group, chain])

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-4">Deposit</h1>
      <div className="mb-3 flex gap-2 items-center">
        <label className="text-sm">Chain</label>
        <select value={chain} onChange={e => setChain(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="ETH">ETH</option>
          <option value="TRON">TRON</option>
          <option value="BSC">BSC</option>
          <option value="SOL">SOL</option>
          <option value="XRP">XRP</option>
        </select>
      </div>
      <Button onClick={fetchAddress} disabled={loading} variant="filled" color="dark">
        {loading ? 'Loading...' : 'Show Deposit Address'}
      </Button>
      {error && <p className="text-red-600 mt-3 text-sm">{error}</p>}
      {group && (
        <div className="mt-4 p-4 border rounded">
          {currentAddress ? (
            <>
              <p className="font-mono break-all">{currentAddress}</p>
              <p className="text-sm text-gray-500">{chain}</p>
              <div className="mt-4 bg-white p-3 inline-block">
                <QRCode value={currentAddress} size={160} />
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">No address set for {chain}</p>
          )}
        </div>
      )}
    </div>
  )
}


