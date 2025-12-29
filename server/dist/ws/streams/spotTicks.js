"use strict";
// Per-symbol spot ticks; subscribe with a symbol; polling fan-out.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
const ws_1 = require("ws");
const spotEngine_1 = require("../../utils/spotEngine");
const priceService_1 = require("../../utils/priceService");
exports.stream = {
    paths: ['/ws/spot-ticks'],
    wss: new ws_1.WebSocketServer({ noServer: true })
};
const subs = new Map();
const timers = new Map();
const minuteOpens = new Map();
async function tick(symbol) {
    try {
        const normalized = symbol.replace('_', '').toUpperCase();
        const resp = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${normalized}`);
        if (!resp.ok)
            return;
        const j = await resp.json();
        const price = parseFloat(j?.price);
        if (!Number.isFinite(price))
            return;
        // Update minute open tracking
        const now = Date.now();
        const currentMin = Math.floor(now / 60000);
        let open = minuteOpens.get(symbol);
        if (!open || open.minute < currentMin) {
            open = { minute: currentMin, price };
            minuteOpens.set(symbol, open);
        }
        // 1. Get the previous price from memory BEFORE we update it.
        // We do this to see if the price has actually changed.
        const lastPrice = priceService_1.priceService.getAllPrices().get(symbol);
        /**
         * FEEDING THE BUCKET: This is where the PriceService gets its "Hot" prices.
         * Every time this loop ticks (normally 1s), we push the new price to the service.
         */
        priceService_1.priceService.updatePrice(symbol, price);
        /**
         * SPOT MATCHING ENGINE TRIGGER:
         * If the price moved (e.g. from $99 to $100), we immediately check the database
         * to see if any user's Limit Orders should now be filled ("Matched").
         * We skip this if the price hasn't moved to save CPU power.
         */
        if (lastPrice !== undefined && lastPrice !== price) {
            // TRIGGER: Only call the SPOT engine if the "sensor" sees movement
            void (0, spotEngine_1.matchSpotLimitOrders)(symbol, price);
        }
        const payload = JSON.stringify({ type: 'tick', symbol, price, open: open.price, t: now });
        const set = subs.get(symbol);
        if (!set || set.size === 0)
            return;
        for (const c of set) {
            try {
                c.send(payload);
            }
            catch { }
        }
    }
    catch { }
}
function start(symbol) {
    if (timers.has(symbol))
        return;
    // THE CLOCK (1 second)... In Spot, the Stream is in control. It fetches the price every 1 second and "dings" the engine.
    timers.set(symbol, setInterval(() => { void tick(symbol); }, 1000));
    void tick(symbol);
}
function stop(symbol) {
    const t = timers.get(symbol);
    if (t)
        clearInterval(t);
    timers.delete(symbol);
}
exports.stream.wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            if (msg.type === 'sub' && msg.symbol) {
                const sym = msg.symbol.toUpperCase();
                let set = subs.get(sym);
                if (!set) {
                    set = new Set();
                    subs.set(sym, set);
                }
                set.add(ws);
                start(sym);
            }
            else if (msg.type === 'unsub') {
                for (const [sym, set] of subs) {
                    if (set.delete(ws) && set.size === 0) {
                        subs.delete(sym);
                        stop(sym);
                    }
                }
            }
        }
        catch { }
    });
    ws.on('close', () => {
        for (const [sym, set] of subs) {
            if (set.delete(ws) && set.size === 0) {
                subs.delete(sym);
                stop(sym);
            }
        }
    });
});
//# sourceMappingURL=spotTicks.js.map