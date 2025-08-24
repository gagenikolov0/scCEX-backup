import { useEffect, useState } from 'react'
import { API_BASE } from '../config/api'

const allIntervals = ['1m','5m','15m','30m','1h','2h','4h','6h','1d','2d','1w'] as const
export type Interval = typeof allIntervals[number]

interface UseIntervalsOptions {
  symbol: string
  market: 'spot' | 'futures'
  defaultInterval?: Interval
}

export function useIntervals({ symbol, market, defaultInterval = '1m' }: UseIntervalsOptions) {
  const [availableIntervals, setAvailableIntervals] = useState<Interval[]>(['1m','5m','1h','1d'])
  const [interval, setInterval] = useState<Interval>(defaultInterval)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    
    ;(async () => {
      try {
        const path = market === 'futures' ? 'futures/intervals' : 'spot/intervals'
        const res = await fetch(`${API_BASE}/api/markets/${path}?symbol=${symbol}`)
        const j = await res.json().catch(() => ({}))
        if (cancelled) return
        
        const ivs = Array.isArray(j?.intervals) 
          ? j.intervals.filter((iv: string) => (allIntervals as readonly string[]).includes(iv)) 
          : ['1m','5m','1h','1d']
        
        setAvailableIntervals(ivs as Interval[])
        
        // Auto-select first available interval if current one isn't available
        if (!ivs.includes(interval)) {
          setInterval((ivs[0] as Interval) ?? '1m')
        }
      } catch {
        if (cancelled) return
        setAvailableIntervals(['1m','5m','1h','1d'])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    
    return () => { cancelled = true }
  }, [symbol, market, interval])

  return {
    availableIntervals,
    interval,
    setInterval,
    loading,
    allIntervals
  }
}
