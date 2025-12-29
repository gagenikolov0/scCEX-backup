import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { API_BASE } from '../config/api'
import { useLocation } from 'react-router-dom'

interface Position {
  asset: string
  available: string
  reserved: string
  updatedAt: string
}

interface Order {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: string
  price: string
  status: 'filled' | 'rejected' | 'pending'
  createdAt: string
}

interface AccountContextType {
  spotAvailable: { USDT: string; USDC: string }
  futuresAvailable: { USDT: string; USDC: string }
  positions: Position[]
  futuresPositions: any[]
  orders: Order[]
  totalPortfolioUSD: number
  refreshBalances: () => Promise<void>
  refreshOrders: () => Promise<void>
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export const useAccount = () => {
  const context = useContext(AccountContext)
  if (!context) throw new Error('useAccount must be used within AccountProvider')
  return context
}

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken } = useAuth()

  const [spotAvailable, setSpotAvailable] = useState<{ USDT: string; USDC: string }>({
    USDT: '0',
    USDC: '0'
  })
  const [futuresAvailable, setFuturesAvailable] = useState<{ USDT: string; USDC: string }>({
    USDT: '0',
    USDC: '0'
  })
  const [positions, setPositions] = useState<Position[]>([])
  const [futuresPositions, setFuturesPositions] = useState<any[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [totalPortfolioUSD, setTotalPortfolioUSD] = useState<number>(0)

  const location = useLocation()
  const shouldFetch = useMemo(() => {
    const relevant = ['/spot', '/futures', '/wallet', '/deposit', '/settings']
    return relevant.some(r => location.pathname.startsWith(r))
  }, [location.pathname])






  const refreshBalances = async () => {
    if (!accessToken) return

    try {
      const response = await fetch(`${API_BASE}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()

        setSpotAvailable({
          USDT: data.balances?.spotAvailableUSDT || '0',
          USDC: data.balances?.spotAvailableUSDC || '0'
        })

        setFuturesAvailable({
          USDT: data.balances?.futuresAvailableUSDT || '0',
          USDC: data.balances?.futuresAvailableUSDC || '0'
        })

        const positionsData = data.balances?.positions || []
        setPositions(positionsData.map((p: any) => ({
          asset: p.asset,
          available: p.available || '0',
          reserved: p.reserved || '0',
          updatedAt: new Date().toISOString()
        })))

        if (data.balances?.futuresPositions) {
          setFuturesPositions(data.balances.futuresPositions)
        }

        if (typeof data.balances?.totalPortfolioUSD === 'number') {
          setTotalPortfolioUSD(data.balances.totalPortfolioUSD)
        }
      }
    } catch (error) {
      // Silent fail for balance refresh
    }
  }

  const refreshOrders = async () => {
    if (!accessToken) return

    try {
      const response = await fetch(`${API_BASE}/api/spot/orders`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Backend returns orders array directly, not wrapped in { orders: [...] }
        setOrders(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      // Silent fail for orders refresh
    }
  }










  // Load balances immediately when accessToken is available
  // Load balances immediately when accessToken is available and on relevant pages
  useEffect(() => {
    if (accessToken && shouldFetch) {
      refreshBalances()
      refreshOrders()
    }
  }, [accessToken, shouldFetch])

  // WebSocket Connection
  useEffect(() => {
    if (!accessToken || !shouldFetch) return

    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout
    let shouldClose = false // Flag to handle cleanup during CONNECTING state
    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/account?token=' + accessToken

    const connect = () => {
      if (shouldClose) return
      console.log(`[Account WS] Connecting to ${wsUrl}`)
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (shouldClose) {
          console.log('[Account WS] Closure requested during connection, closing now')
          ws?.close()
          return
        }
        console.log('[Account WS] Connection established')
        refreshBalances()
        refreshOrders()
      }

      ws.onmessage = (event) => {
        if (shouldClose) return
        try {
          const msg = JSON.parse(event.data)
          if (msg.type !== 'account') return

          // Handle specific event kinds
          if (msg.kind === 'balance' && msg.spotAvailable) {
            setSpotAvailable(msg.spotAvailable)
          } else if (msg.kind === 'futuresBalance' && msg.futuresAvailable) {
            setFuturesAvailable(msg.futuresAvailable)
          } else if (msg.kind === 'spotPosition') {
            setPositions(prev => {
              const idx = prev.findIndex(p => p.asset === msg.asset)
              if (idx === -1) {
                return [...prev, {
                  asset: msg.asset,
                  available: msg.available,
                  reserved: msg.reserved || '0',
                  updatedAt: new Date().toISOString()
                }]
              }
              const copy = [...prev]
              copy[idx] = {
                ...copy[idx],
                available: msg.available,
                reserved: msg.reserved || copy[idx].reserved,
                updatedAt: new Date().toISOString()
              }
              return copy
            })
          } else if (msg.kind === 'futuresPosition') {
            setFuturesPositions(prev => {
              if (!msg.position) {
                return prev.filter(p => p.symbol !== msg.symbol)
              }
              const idx = prev.findIndex(p => p.symbol === msg.symbol)
              if (idx > -1) {
                const next = [...prev]
                next[idx] = msg.position
                return next
              }
              return [...prev, msg.position]
            })
          } else if (msg.kind === 'order' && msg.order) {
            setOrders(prev => {
              const idx = prev.findIndex(o => o.id === msg.order.id)
              const newOrder = {
                id: msg.order.id,
                symbol: msg.order.symbol,
                side: msg.order.side,
                quantity: msg.order.quantity,
                price: msg.order.price,
                status: msg.order.status,
                createdAt: msg.order.createdAt
              }
              if (idx === -1) return [newOrder, ...prev]
              const copy = [...prev]
              copy[idx] = newOrder
              return copy
            })
          } else if (msg.kind === 'portfolio' && typeof msg.totalPortfolioUSD === 'number') {
            setTotalPortfolioUSD(msg.totalPortfolioUSD)
          }
        } catch (e) {
          console.error('WS Parse error', e)
        }
      }

      ws.onclose = () => {
        if (shouldClose) return
        console.warn('[Account WS] Connection closed')
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      shouldClose = true
      console.log('[Account WS] Cleaning up connection')
      if (ws) {
        ws.onclose = null
        ws.onopen = null
        // Only close immediately if it's already OPEN.
        // If it's CONNECTING, the onopen handler above will catch it once it opens to avoid the browser warning.
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }
      clearTimeout(reconnectTimer)
    }
  }, [accessToken, shouldFetch])


  return (
    <AccountContext.Provider value={{
      spotAvailable,
      futuresAvailable,
      positions,
      futuresPositions,
      orders,
      totalPortfolioUSD,
      refreshBalances,
      refreshOrders
    }}>
      {children}
    </AccountContext.Provider>
  )
}


