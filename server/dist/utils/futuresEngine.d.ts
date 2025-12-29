declare class FuturesEngine {
    private interval;
    private running;
    start(ms?: number): void;
    stop(): void;
    private tick;
    private processLimitOrders;
    private processTPSL;
    private processLiquidations;
    private fillOrder;
    private liquidatePosition;
    executePositionClose(posId: string, exitPrice: number, closeQuantity?: number): Promise<void>;
}
export declare const futuresEngine: FuturesEngine;
export {};
//# sourceMappingURL=futuresEngine.d.ts.map