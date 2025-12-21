import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { API_BASE } from '../config/api'

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
  positions: Position[]
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
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [totalPortfolioUSD, setTotalPortfolioUSD] = useState<number>(0)






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

        const positionsData = data.balances?.positions || []
        setPositions(positionsData.map((p: any) => ({
          asset: p.asset,
          available: p.available,
          reserved: p.reserved,
          updatedAt: new Date().toISOString()
        })))

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
  useEffect(() => {
    if (accessToken) {
      refreshBalances()
      refreshOrders()
    }
  }, [accessToken])

  // WebSocket Connection
  useEffect(() => {
    if (!accessToken) return

    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout
    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/account?token=' + accessToken

    const connect = () => {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        // Optional: refresh once on connect to ensure sync
        refreshBalances()
        refreshOrders()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type !== 'account') return

          // Handle specific event kinds
          if (msg.kind === 'balance' && msg.spotAvailable) {
            setSpotAvailable(msg.spotAvailable)
          } else if (msg.kind === 'position') {
            setPositions(prev => {
              const idx = prev.findIndex(p => p.asset === msg.asset)
              if (idx === -1) {
                // New position
                return [...prev, {
                  asset: msg.asset,
                  available: msg.available,
                  reserved: msg.reserved || '0',
                  updatedAt: new Date().toISOString()
                }]
              }
              // Update existing
              const copy = [...prev]
              copy[idx] = {
                ...copy[idx],
                available: msg.available,
                reserved: msg.reserved || copy[idx].reserved,
                updatedAt: new Date().toISOString()
              }
              return copy
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

              if (idx === -1) {
                // Prepend new order
                return [newOrder, ...prev]
              }
              // Update existing order status
              const copy = [...prev]
              copy[idx] = newOrder
              return copy
            })
            // If order changed, balance likely changed too, so we might get a balance event soon, 
            // but we can also trigger a fetch to be safe/lazy or just rely on the balance event.
            // (The server is supposed to emit balance events too)
          } else if (msg.kind === 'portfolio' && typeof msg.totalPortfolioUSD === 'number') {
            setTotalPortfolioUSD(msg.totalPortfolioUSD)
          }
        } catch (e) {
          console.error('WS Parse error', e)
        }
      }

      ws.onclose = () => {
        // Simple reconnect logic
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (ws) {
        ws.onclose = null // prevent reconnect loop on unmount
        ws.close()
      }
      clearTimeout(reconnectTimer)
    }
  }, [accessToken])


  return (
    <AccountContext.Provider value={{
      spotAvailable,
      positions,
      orders,
      totalPortfolioUSD,
      refreshBalances,
      refreshOrders
    }}>
      {children}
    </AccountContext.Provider>
  )
}


