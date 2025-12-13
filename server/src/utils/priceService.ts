import { EventEmitter } from 'events';

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

class PriceService extends EventEmitter {
  private prices = new Map<string, PriceUpdate>();
  private readonly MAX_AGE = 2000; // 2 seconds max age

  // Update price from external source (like spotTicks)
  updatePrice(symbol: string, price: number) {
    const update: PriceUpdate = {
      symbol,
      price,
      timestamp: Date.now()
    };
    this.prices.set(symbol, update);
    this.emit('price', update);
  }

  // Get current price - uses cache if fresh, otherwise fetches fresh
  async getPrice(symbol: string): Promise<number> {
    const cached = this.prices.get(symbol);
    const now = Date.now();

    // Use cached price if it's less than 1 second old
    if (cached && (now - cached.timestamp) < 1000) {
      return cached.price;
    }

    // Fetch fresh price
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

  private async fetchSpotPrice(symbol: string): Promise<number> {
    const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Upstream price error");
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

// Global instance
export const priceService = new PriceService();
