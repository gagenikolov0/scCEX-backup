import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../config/api'

type SpotStats = {
  symbol: string;
  lastPrice: string;
  change24h?: string;
  high24h?: string;
  low24h?: string;
  volume24h?: string
}

type FuturesStats = {
  symbol: string;
  lastPrice?: string;
  change24h?: number | string;
  high24h?: string;
  low24h?: string;
  volume24h?: string;
  [k: string]: any
}

type MarketContextValue = {
  spotStats: SpotStats[]
  futuresStats: FuturesStats[]
  listen: () => void
  unlisten: () => void
}

const MarketContext = createContext<MarketContextValue | undefined>(undefined)

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [spotStats, setSpotStats] = useState<SpotStats[]>([])
  const [futuresStats, setFuturesStats] = useState<FuturesStats[]>([])
  const [listenerCount, setListenerCount] = useState(0)

  const listen = () => setListenerCount(c => c + 1)
  const unlisten = () => setListenerCount(c => Math.max(0, c - 1))

  // initial load (REST) - The Snapshot for the list in asset selector
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/markets/spot/24h`) //without symbol calls the expensive all symbols
          const data = await res.json().catch(() => [])
          if (!cancelled && Array.isArray(data)) setSpotStats(data)
        } catch { }
      })()
      ; (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/markets/futures/24h`) //without symbol calls the expensive all symbols
          const j = await res.json().catch(() => ({}))
          const arr = Array.isArray(j?.data) ? j.data : []
          if (!cancelled) setFuturesStats(arr)
        } catch { }
      })()
    return () => { cancelled = true }
  }, [])

  // Connect to spot stats WebSocket (bulk) 
  useEffect(() => {
    if (listenerCount === 0) return

    const wsBase = API_BASE.replace(/^http/, 'ws')
    let ws: WebSocket | null = null
    let stopped = false
    let connected = false

    const connect = () => {
      if (stopped || connected) return

      try {
        ws = new WebSocket(`${wsBase}/ws/spot-24h`)
        ws.onopen = () => {
          connected = true
          ws?.send(JSON.stringify({ type: 'sub_all' }))
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'stats_all' && Array.isArray(msg?.data)) {
              setSpotStats(msg.data)
            }
          } catch { }
        }
        ws.onclose = () => {
          connected = false
          if (!stopped) {
            setTimeout(connect, 2000)
          }
        }
        ws.onerror = () => { /* no-op */ }
      } catch { }
    }

    connect()

    return () => {
      stopped = true
      try { ws?.close() } catch { }
    }
  }, [listenerCount])

  // Connect to futures stats WebSocket (bulk)
  useEffect(() => {
    if (listenerCount === 0) return

    const wsBase = API_BASE.replace(/^http/, 'ws')
    let ws: WebSocket | null = null
    let stopped = false
    let connected = false

    const connect = () => {
      if (stopped || connected) return

      try {
        ws = new WebSocket(`${wsBase}/ws/futures-24h`)
        ws.onopen = () => {
          connected = true
          ws?.send(JSON.stringify({ type: 'sub_all' }))
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'stats_all' && Array.isArray(msg?.data)) {
              setFuturesStats(msg.data)
            }
          } catch { }
        }
        ws.onclose = () => {
          connected = false
          if (!stopped) {
            setTimeout(connect, 2000)
          }
        }
        ws.onerror = () => { /* no-op */ }
      } catch { }
    }

    connect()

    return () => {
      stopped = true
      try { ws?.close() } catch { }
    }
  }, [listenerCount])

  const value = useMemo(() => ({ spotStats, futuresStats, listen, unlisten }), [spotStats, futuresStats])

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}


