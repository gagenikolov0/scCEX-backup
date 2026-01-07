import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
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
  listen: (type: 'spot' | 'futures') => void
  unlisten: (type: 'spot' | 'futures') => void
}

const MarketContext = createContext<MarketContextValue | undefined>(undefined)

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [spotStats, setSpotStats] = useState<SpotStats[]>([])
  const [futuresStats, setFuturesStats] = useState<FuturesStats[]>([])
  const [spotListenerCount, setSpotListenerCount] = useState(0)
  const [futuresListenerCount, setFuturesListenerCount] = useState(0)

  const listen = useCallback((type: 'spot' | 'futures') => {
    if (type === 'spot') setSpotListenerCount(c => c + 1)
    else setFuturesListenerCount(c => c + 1)
  }, [])
  const unlisten = useCallback((type: 'spot' | 'futures') => {
    if (type === 'spot') setSpotListenerCount(c => Math.max(0, c - 1))
    else setFuturesListenerCount(c => Math.max(0, c - 1))
  }, [])

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
          // Normalize symbols to ensure they have underscore
          const normalized = arr.map((item: any) => ({
            ...item,
            symbol: item.symbol.includes('_') ? item.symbol : item.symbol.replace(/(USDT|USDC)$/i, '_$1')
          }))
          if (!cancelled) setFuturesStats(normalized)
        } catch { }
      })()
    return () => { cancelled = true }
  }, [])

  // Connect to spot stats WebSocket (bulk) 
  useEffect(() => {
    if (spotListenerCount === 0) return

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

        let pendingData: SpotStats[] | null = null
        const throttleInterval = setInterval(() => {
          if (pendingData) {
            // Only update if data actually changed
            setSpotStats(prev => {
              if (JSON.stringify(prev) === JSON.stringify(pendingData)) {
                return prev // Same reference = no re-render
              }
              return pendingData!
            })
            pendingData = null
          }
        }, 1000)

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'stats_all' && Array.isArray(msg?.data)) {
              pendingData = msg.data
            }
          } catch { }
        }
        ws.onclose = () => {
          connected = false
          clearInterval(throttleInterval)
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
  }, [spotListenerCount])

  // Connect to futures stats WebSocket (bulk)
  useEffect(() => {
    if (futuresListenerCount === 0) return

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

        let pendingData: FuturesStats[] | null = null
        const throttleInterval = setInterval(() => {
          if (pendingData) {
            // Normalize symbols
            const normalized = pendingData.map((item: any) => ({
              ...item,
              symbol: item.symbol.includes('_') ? item.symbol : item.symbol.replace(/(USDT|USDC)$/i, '_$1')
            }))
            // Only update if data actually changed
            setFuturesStats(prev => {
              if (JSON.stringify(prev) === JSON.stringify(normalized)) {
                return prev // Same reference = no re-render
              }
              return normalized
            })
            pendingData = null
          }
        }, 1000)

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'stats_all' && Array.isArray(msg?.data)) {
              // Normalize symbols
              const normalized = msg.data.map((item: any) => ({
                ...item,
                symbol: item.symbol.includes('_') ? item.symbol : item.symbol.replace(/(USDT|USDC)$/i, '_$1')
              }))
              pendingData = normalized
            }
          } catch { }
        }
        ws.onclose = () => {
          connected = false
          clearInterval(throttleInterval)
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
  }, [futuresListenerCount])

  const value = useMemo(() => ({ spotStats, futuresStats, listen, unlisten }), [spotStats, futuresStats])

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
