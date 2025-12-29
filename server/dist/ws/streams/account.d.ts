import type { IncomingMessage } from 'http';
type AccountEvent = {
    kind: 'balance';
    spotAvailable: {
        USDT: string;
        USDC: string;
    };
} | {
    kind: 'spotPosition';
    asset: string;
    available: string;
    reserved: string;
} | {
    kind: 'order';
    order: any;
} | {
    kind: 'futuresBalance';
    futuresAvailable: {
        USDT: string;
        USDC: string;
    };
} | {
    kind: 'futuresPosition';
    symbol: string;
    position: any;
} | {
    kind: 'portfolio';
    totalPortfolioUSD: number;
};
export declare const stream: {
    paths: string[];
    wss: import("ws").Server<typeof import("ws"), typeof IncomingMessage>;
};
export declare function emitAccountEvent(userId: string, event: AccountEvent): void;
export {};
//# sourceMappingURL=account.d.ts.map