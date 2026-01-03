import { useEffect, useState } from 'react'
import { API_BASE } from '../config/api'

export function useSymbolStats(market: 'spot' | 'futures', token: string, quote: string) {
    const [stats, setStats] = useState<any | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!token || !quote) return

        setStats(null)
        setLoading(true)

        const wsBase = API_BASE.replace(/^http/, 'ws')
        const path = market === 'spot' ? '/ws/spot-24h' : '/ws/futures-24h'
        const ws = new WebSocket(`${wsBase}${path}`)

        const sym = market === 'spot' ? `${token}${quote}` : `${token}_${quote}`
        let stopped = false

        ws.onopen = () => {
            if (!stopped) {
                ws.send(JSON.stringify({ type: 'sub', symbol: sym }))
            }
        }

        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data as string)
                if (!stopped && msg?.type === 'stats' && msg?.symbol === sym) {
                    setStats(msg.data)
                    setLoading(false)
                }
            } catch {
                // ignore parse errors
            }
        }

        ws.onclose = () => {
            if (!stopped) setLoading(false)
        }

        ws.onerror = () => {
            if (!stopped) setLoading(false)
        }

        return () => {
            stopped = true
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close()
            }
        }
    }, [market, token, quote])

    return { stats, loading }
}
