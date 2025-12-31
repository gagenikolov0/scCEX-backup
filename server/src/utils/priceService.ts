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
        const key = symbol.toUpperCase(); // Keep underscore for futures
        const update: PriceUpdate = {
            symbol: key,
            price,
            timestamp: Date.now()
        };
        this.prices.set(key, update);
        this.emit('price', update);
    }

    // Call this to use the bucket
    async getPrice(symbol: string): Promise<number> {
        const key = symbol.toUpperCase();
        const cached = this.prices.get(key);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < 1000) {
            return cached.price;
        }

        try {
            const isFutures = key.includes('_');
            const freshPrice = isFutures ? await this.fetchFuturesPrice(key) : await this.fetchSpotPrice(key);
            this.updatePrice(key, freshPrice);
            return freshPrice;
        } catch (error) {
            // If fetch fails and we have a cached price (even if old), use it
            if (cached && (now - cached.timestamp) < this.MAX_AGE) {
                console.warn(`Using stale price for ${key}: ${cached.price}`);
                return cached.price;
            }
            throw error;
        }
    }

    private async fetchSpotPrice(symbol: string): Promise<number> {
        const normalized = symbol.replace('_', '').toUpperCase();
        const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${normalized}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Upstream spot price error for ${symbol}`);
        const j = (await res.json()) as any;
        const p = parseFloat(j?.price ?? j?.data?.price ?? "NaN");
        if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid price");
        return p;
    }

    private async fetchFuturesPrice(symbol: string): Promise<number> {
        const sym = symbol.includes('_') ? symbol : symbol.replace(/(USDT|USDC)$/i, '_$1');
        const url = `https://contract.mexc.com/api/v1/contract/ticker?symbol=${sym}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Upstream futures price error for ${symbol}`);
        const j = (await res.json()) as any;
        const p = parseFloat(j?.data?.lastPrice ?? j?.lastPrice ?? "NaN");
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