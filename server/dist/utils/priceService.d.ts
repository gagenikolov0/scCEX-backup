import { EventEmitter } from 'events';
declare class PriceService extends EventEmitter {
    private prices;
    private readonly MAX_AGE;
    updatePrice(symbol: string, price: number): void;
    getPrice(symbol: string): Promise<number>;
    /**
     * Why the api.mexc link exists (The "Safety Net")
     * If the Liquidation Engine needs to check the price of ETH_USDT, but no user is currently watching the ETH chart,
     * then spotTicks.ts is asleep!!! It's not feeding the bucket.
     * This prevents escape so now the only escape of liquidation is if server crashes and fetchSpotPrice() can't call MEXC API.
    */
    private fetchSpotPrice;
    getAllPrices(): Map<string, number>;
}
export declare const priceService: PriceService;
export {};
//# sourceMappingURL=priceService.d.ts.map