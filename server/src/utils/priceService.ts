import { EventEmitter } from 'events';

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

class PriceService extends EventEmitter {
  private prices = new Map<string, PriceUpdate>();
  private readonly MAX_AGE = 2000; // 2 seconds max age

  // Called by streams to fill the bucket
  updatePrice(symbol: string, price: number) {
    const update: PriceUpdate = {
      symbol,
      price,
      timestamp: Date.now()
    };
    this.prices.set(symbol, update);
    this.emit('price', update);
  }

  // Call this to use the bucket
  async getPrice(symbol: string): Promise<number> {
    const cached = this.prices.get(symbol);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < 1000) {
      return cached.price;
    }

    try {
      const freshPrice = await this.fetchSpotPrice(symbol);
      this.updatePrice(symbol, freshPrice);
      return freshPrice;
    } catch (error) {
      // If fetch fails and we have a cached price (even if old), use it
      if (cached && (now - cached.timestamp) < this.MAX_AGE) {
        console.warn(`Using stale price for ${symbol}: ${cached.price}`);
        return cached.price;
      }
      throw error;
    }
  }

  /**
   * Why the api.mexc link exists (The "Safety Net")
   * If the Liquidation Engine needs to check the price of ETH_USDT, but no user is currently watching the ETH chart, 
   * then spotTicks.ts is asleep!!! It's not feeding the bucket.
   * This prevents escape so now the only escape of liquidation is if server crashes and fetchSpotPrice() can't call MEXC API.
  */
  private async fetchSpotPrice(symbol: string): Promise<number> {
    const normalized = symbol.replace('_', '').toUpperCase();
    const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${normalized}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Upstream price error for ${symbol}`);
    const j = (await res.json()) as any;
    const p = parseFloat(j?.price ?? j?.data?.price ?? "NaN");
    if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid price");
    return p;
  }

  // Get all current prices
  getAllPrices(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [symbol, update] of this.prices) {
      result.set(symbol, update.price);
    }
    return result;
  }
}

export const priceService = new PriceService();
// If you didn't do new PriceService(), you'd have to do "export const priceService = new PriceService();"
// which will create new instance of PriceService. Basically we created Context in backend.