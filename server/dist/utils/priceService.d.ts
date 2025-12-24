import { EventEmitter } from 'events';
declare class PriceService extends EventEmitter {
    private prices;
    private readonly MAX_AGE;
    updatePrice(symbol: string, price: number): void;
    getPrice(symbol: string): Promise<number>;
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
    private fetchSpotPrice;
    getAllPrices(): Map<string, number>;
}
export declare const priceService: PriceService;
export {};
//# sourceMappingURL=priceService.d.ts.map