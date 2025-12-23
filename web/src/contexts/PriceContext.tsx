import React, { createContext, useContext, useEffect, useRef } from 'react'
import { API_BASE } from '../config/api'

type TickData = {
    price: number
    open: number
    t: number
}

type Listener = (data: TickData) => void

interface PriceContextValue {
    /**
     * Subscribe to real-time ticks for a symbol.
     * Returns an unsubscribe function.
     */
    subscribe: (market: 'spot' | 'futures', symbol: string, callback: Listener) => () => void
}

const PriceContext = createContext<PriceContextValue | undefined>(undefined)

export function PriceProvider({ children }: { children: React.ReactNode }) {
    const spotWs = useRef<WebSocket | null>(null)
    const futuresWs = useRef<WebSocket | null>(null)

    // Track listeners per "market:symbol"
    const listeners = useRef<Map<string, Set<Listener>>>(new Map())
    // Track total active subs for each market:symbol so we know when to send sub/unsub to server
    const activeSubs = useRef<Map<string, number>>(new Map())

    const getWs = (market: 'spot' | 'futures'): WebSocket | null => {
        const wsRef = market === 'spot' ? spotWs : futuresWs
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return wsRef.current
        }

        const wsBase = API_BASE.replace(/^http/, 'ws').replace('localhost', '127.0.0.1')
        const path = market === 'spot' ? '/ws/spot-ticks' : '/ws/futures-ticks'
        const ws = new WebSocket(`${wsBase}${path}`)

        ws.onopen = () => {
            console.log(`[PriceContext] ${market} WS connected`)
            // Re-subscribe to all active symbols for this market
            for (const [key, count] of activeSubs.current.entries()) {
                if (key.startsWith(`${market}:`) && count > 0) {
                    const sym = key.split(':')[1]
                    ws.send(JSON.stringify({ type: 'sub', symbol: sym }))
                }
            }
        }

        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data)
                if (msg.type === 'tick' && msg.symbol) {
                    const key = `${market}:${msg.symbol}`
                    const set = listeners.current.get(key)
                    if (set) {
                        const data: TickData = {
                            price: parseFloat(msg.price),
                            open: parseFloat(msg.open),
                            t: msg.t || Date.now()
                        }
                        set.forEach(cb => cb(data))
                    }
                }
            } catch (e) {
                console.error('[PriceContext] Message error', e)
            }
        }

        ws.onclose = () => {
            console.log(`[PriceContext] ${market} WS closed`)
            wsRef.current = null
            // Reconnect after delay if there are still active listeners
            setTimeout(() => {
                const hasListeners = Array.from(activeSubs.current.keys()).some(k => k.startsWith(`${market}:`))
                if (hasListeners) getWs(market)
            }, 3000)
        }

        wsRef.current = ws
        return ws
    }

    const normalize = (market: 'spot' | 'futures', symbol: string) => {
        const s = symbol.toUpperCase()
        if (market === 'futures') {
            return s.includes('_') ? s : s.replace(/(USDT|USDC)$/i, '_$1')
        }
        return s.replace('_', '')
    }

    const subscribe = (market: 'spot' | 'futures', symbol: string, callback: Listener) => {
        const sym = normalize(market, symbol)
        const key = `${market}:${sym}`

        // Add to listeners
        let set = listeners.current.get(key)
        if (!set) {
            set = new Set()
            listeners.current.set(key, set)
        }
        set.add(callback)

        // Track active sub count
        const count = (activeSubs.current.get(key) || 0) + 1
        activeSubs.current.set(key, count)

        // If first listener for this symbol, tell the server
        if (count === 1) {
            const ws = getWs(market)
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'sub', symbol: sym }))
            }
        }

        return () => {
            set?.delete(callback)
            const newCount = (activeSubs.current.get(key) || 1) - 1
            if (newCount <= 0) {
                activeSubs.current.delete(key)
                listeners.current.delete(key)
                // Note: Our current server 'unsub' wipes ALL symbols for the connection.
                // For now, we'll skip sending unsub to avoid breaking other symbols, 
                // or we'll eventually improve the server to handle per-symbol unsub.
                // Since it's only 1 tick per second per symbol, it's not a huge waste for now.
            } else {
                activeSubs.current.set(key, newCount)
            }
        }
    }

    return (
        <PriceContext.Provider value={{ subscribe }}>
            {children}
        </PriceContext.Provider>
    )
}

export function usePrice(market: 'spot' | 'futures', symbol: string) {
    const context = useContext(PriceContext)
    if (!context) throw new Error('usePrice must be used within PriceProvider')

    const [tick, setTick] = React.useState<TickData | null>(null)

    useEffect(() => {
        if (!symbol) return

        const unsub = context.subscribe(market, symbol, (data) => {
            setTick(data)
        })
        return unsub
    }, [market, symbol, context])

    return tick
}
