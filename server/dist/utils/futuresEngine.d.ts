declare class FuturesEngine {
    private interval;
    private running;
    start(ms?: number): void;
    stop(): void;
    /**
     * Hartbeat of the engine. Calls all the Engine functions every 2 seconds.
     */
    private tick;
    private processLimitOrders;
    private fillOrder;
    private processTPSL;
    private processLiquidations;
    private liquidatePosition;
    /**
     * Shared logic to close a position (Manual, TP, or SL) Realizes PnL, Refunds Margin, and Records History.
     */
    executePositionClose(posId: string, exitPrice: number, closeQuantity?: number): Promise<void>;
}
export declare const futuresEngine: FuturesEngine;
export {};
//# sourceMappingURL=futuresEngine.d.ts.map