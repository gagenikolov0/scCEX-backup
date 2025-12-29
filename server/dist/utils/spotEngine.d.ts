/**
 * Handles 100% of the Limit Order matching logic for Spot
 * Just a dumb engine that gets dinged every 1 second by spotTicks.ts stream to check db if any orders should be filled and it fills them
 */
export declare function matchSpotLimitOrders(symbol: string, currentPrice: number): Promise<void>;
//# sourceMappingURL=spotEngine.d.ts.map