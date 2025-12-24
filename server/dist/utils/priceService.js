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
    // Update price from external source (like spotTicks)
    updatePrice(symbol, price) {
        const update = {
            symbol,
            price,
            timestamp: Date.now()
        };
        this.prices.set(symbol, update);
        this.emit('price', update);
    }
    // Get current price - uses cache if fresh, otherwise fetches fresh
    async getPrice(symbol) {
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
        }
        catch (error) {
            // If fetch fails and we have a cached price (even if old), use it
            if (cached && (now - cached.timestamp) < this.MAX_AGE) {
                console.warn(`Using stale price for ${symbol}: ${cached.price}`);
                return cached.price;
            }
            throw error;
        }
    }
    /**
     * ISSUE 2 FIX: MEXC Symbol Normalization.
     * TRIGGER: Happens right before any price check by the Engines or UI.
     * RATIONALE: PriceService acts as a unified "Hot Cache" fed by WebSockets.
     * We strip underscores so it can look up the correct symbol in its memory
     * or fall back to HTTP if the WebSocket isn't yet active.
     */
    /**
     * Why the api.mexc link exists (The "Safety Net")
     * If the Liquidation Engine needs to check the price of ETH_USDT, but no user is currently watching the ETH chart, then
     * spotTicks.ts is asleep. It's not feeding the bucket.
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
// Global instance
exports.priceService = new PriceService();
// Who uses PriceService?? - Every other part of the server(the Engines, the API Routes, etc.) just asks this one service: "Hey, what's the price of BTC?"
//# sourceMappingURL=priceService.js.map