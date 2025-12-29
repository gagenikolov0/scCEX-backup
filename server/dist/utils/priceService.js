"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceService = void 0;
const events_1 = require("events");
class PriceService extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.prices = new Map();
        this.MAX_AGE = 2000; // 2 seconds max age
    }
    // Called by streams to fill the bucket
    updatePrice(symbol, price) {
        const normalized = symbol.replace('_', '').toUpperCase();
        const update = {
            symbol: normalized,
            price,
            timestamp: Date.now()
        };
        this.prices.set(normalized, update);
        this.emit('price', update);
    }
    // Call this to use the bucket
    async getPrice(symbol) {
        const normalized = symbol.replace('_', '').toUpperCase();
        const cached = this.prices.get(normalized);
        const now = Date.now();
        if (cached && (now - cached.timestamp) < 1000) {
            return cached.price;
        }
        try {
            const freshPrice = await this.fetchSpotPrice(normalized);
            this.updatePrice(normalized, freshPrice);
            return freshPrice;
        }
        catch (error) {
            // If fetch fails and we have a cached price (even if old), use it
            if (cached && (now - cached.timestamp) < this.MAX_AGE) {
                console.warn(`Using stale price for ${normalized}: ${cached.price}`);
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
    async fetchSpotPrice(symbol) {
        const normalized = symbol.replace('_', '').toUpperCase();
        const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${normalized}`;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Upstream price error for ${symbol}`);
        const j = (await res.json());
        const p = parseFloat(j?.price ?? j?.data?.price ?? "NaN");
        if (!Number.isFinite(p) || p <= 0)
            throw new Error("Invalid price");
        return p;
    }
    // Get all current prices
    getAllPrices() {
        const result = new Map();
        for (const [symbol, update] of this.prices) {
            result.set(symbol, update.price);
        }
        return result;
    }
}
exports.priceService = new PriceService();
//# sourceMappingURL=priceService.js.map