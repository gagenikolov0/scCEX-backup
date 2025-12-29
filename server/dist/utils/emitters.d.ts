/**
 * Emits full stablecoin balance (USDT & USDC) to the user.
 * This fixes the "zero-out" bug by always fetching both from the database.
 */
export declare function syncStableBalances(userId: string): Promise<void>;
/**
 * Emits full futures balance (USDT & USDC) to the user.
 */
export declare function syncFuturesBalances(userId: string): Promise<void>;
/**
 * Emits updated position (including reserved) to the user in DB.
 */
export declare function syncSpotPosition(userId: string, asset: string): Promise<void>;
/**
 * Emits updated futures position to the user in DB
 */
export declare function syncFuturesPosition(userId: string, symbol: string): Promise<void>;
/**
 * Emits order update.
 */
export declare function syncOrder(userId: string, order: any): void;
//# sourceMappingURL=emitters.d.ts.map