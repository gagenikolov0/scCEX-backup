import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { API_BASE } from '../config/api'
import { PortfolioCalculator } from '../lib/portfolioCalculator' //❌

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
  





  // pollling!!!!
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
      }
    } catch (error) {
      // Silent fail for balance refresh
    }
  }
  
  // polling!!!!
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
  }, [accessToken]) //❓so if accesstoken available refresh balances and orders and if not what????

  // Refresh balances every 30 seconds
  useEffect(() => {
    if (!accessToken) return
    
    const interval = setInterval(refreshBalances, 30000)
    return () => clearInterval(interval)
  }, [accessToken])

  // Refresh orders every 30 seconds to catch new orders
  useEffect(() => {
    if (!accessToken) return
    
    const interval = setInterval(refreshOrders, 30000)
    return () => clearInterval(interval)
  }, [accessToken])

  // Update portfolio whenever positions change
  useEffect(() => {
    if (positions.length > 0) {
      const summary = PortfolioCalculator.updatePortfolio(positions)
      setTotalPortfolioUSD(summary.totalUSD)
    }
  }, [positions])
  
  // Load existing portfolio on mount
  useEffect(() => {
    const existing = PortfolioCalculator.loadPortfolio()
    if (existing) {
      setTotalPortfolioUSD(existing.totalUSD)
    }
  }, [])

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


