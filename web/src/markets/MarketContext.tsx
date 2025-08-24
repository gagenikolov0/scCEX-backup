import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE } from '../config/api'

type SpotTicker = { symbol: string; price: string }
type FuturesTicker = { symbol: string; lastPrice?: string; [k: string]: any }

type MarketContextValue = {
  spotTickers: SpotTicker[]
  futuresTickers: FuturesTicker[]
}

const MarketContext = createContext<MarketContextValue | undefined>(undefined)

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [spotTickers, setSpotTickers] = useState<SpotTicker[]>([])
  const [futuresTickers, setFuturesTickers] = useState<FuturesTicker[]>([])

  // initial load (REST) then WS takeover
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/spot/tickers`)
        const data = await res.json().catch(() => [])
        if (!cancelled && Array.isArray(data)) setSpotTickers(data)
      } catch {}
    })()
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/markets/futures/tickers`)
        const j = await res.json().catch(() => ({}))
        const arr = Array.isArray(j?.data) ? j.data : []
        if (!cancelled) setFuturesTickers(arr)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // Connect to spot tickers WebSocket
  useEffect(() => {
    const wsBase = API_BASE.replace(/^http/, 'ws')
    let ws: WebSocket | null = null
    let stopped = false
    let connected = false
    
    const connect = () => {
      if (stopped || connected) return
      
      try {
        ws = new WebSocket(`${wsBase}/ws/tickers`)
        ws.onopen = () => { 
          connected = true
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'tickers' && Array.isArray(msg?.data)) {
              setSpotTickers(msg.data)
            }
          } catch {}
        }
        ws.onclose = () => { 
          connected = false
          if (!stopped) {
            // Reconnect after a delay if not stopped
            setTimeout(connect, 2000)
          }
        }
        ws.onerror = () => { /* no-op */ }
      } catch {}
    }
    
    // Delay connection to avoid React dev mode double-rendering
    const timeoutId = setTimeout(connect, 100)
    
    return () => { 
      stopped = true
      clearTimeout(timeoutId)
      try { ws?.close() } catch {} 
    }
  }, [])

  // Connect to futures tickers WebSocket
  useEffect(() => {
    const wsBase = API_BASE.replace(/^http/, 'ws')
    let ws: WebSocket | null = null
    let stopped = false
    let connected = false
    
    const connect = () => {
      if (stopped || connected) return
      
      try {
        ws = new WebSocket(`${wsBase}/ws/futures-tickers`)
        ws.onopen = () => { 
          connected = true
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (msg?.type === 'tickers' && Array.isArray(msg?.data)) {
              setFuturesTickers(msg.data)
            }
          } catch {}
        }
        ws.onclose = () => { 
          connected = false
          if (!stopped) {
            // Reconnect after a delay if not stopped
            setTimeout(connect, 2000)
          }
        }
        ws.onerror = () => { /* no-op */ }
      } catch {}
    }
    
    // Delay connection to avoid React dev mode double-rendering
    const timeoutId = setTimeout(connect, 100)
    
    return () => { 
      stopped = true
      clearTimeout(timeoutId)
      try { ws?.close() } catch {} 
    }
  }, [])

  const value = useMemo(() => ({ spotTickers, futuresTickers }), [spotTickers, futuresTickers])
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}


