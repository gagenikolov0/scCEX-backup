// 🚀 PORTFOLIO CALCULATOR - COMPLETELY ISOLATED FROM TRADING LOGIC
// This only reads existing balances and calculates USD values - no MongoDB writes!

interface PortfolioPosition {
  asset: string
  available: string
}

interface PortfolioSummary {
  totalUSD: number
  positions: { [asset: string]: number }
  lastUpdated: string
}

// Mock prices (in real app, fetch from market data)
const MOCK_PRICES: { [asset: string]: number } = {
  BTC: 50000,
  ETH: 3000,
  USDT: 1,
  USDC: 1,
  // Add more assets as needed
}

export class PortfolioCalculator {
  private static STORAGE_KEY = 'portfolio_summary'
  
  // Calculate total portfolio value in USD
  static calculatePortfolio(positions: PortfolioPosition[]): PortfolioSummary {
    let totalUSD = 0
    const positionValues: { [asset: string]: number } = {}
    
    positions.forEach(pos => {
      const price = MOCK_PRICES[pos.asset] || 0
      const value = parseFloat(pos.available) * price
      positionValues[pos.asset] = value
      totalUSD += value
    })
    
    return {
      totalUSD: Math.round(totalUSD * 100) / 100, // Round to 2 decimals
      positions: positionValues,
      lastUpdated: new Date().toISOString()
    }
  }
  
  // Save to localStorage
  static savePortfolio(summary: PortfolioSummary): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(summary))
    } catch {
      // Silent fail for localStorage save
    }
  }
  
  // Load from localStorage
  static loadPortfolio(): PortfolioSummary | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }
  
  // Update portfolio when balances change
  static updatePortfolio(positions: PortfolioPosition[]): PortfolioSummary {
    const summary = this.calculatePortfolio(positions)
    this.savePortfolio(summary)
    return summary
  }
}
