"use strict";
// Per-symbol futures ticks; subscribe with a futures symbol like BTC_USDT. Polling fan-out.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
const ws_1 = require("ws");
const priceService_1 = require("../../utils/priceService");
exports.stream = {
    paths: ['/ws/futures-ticks'],
    wss: new ws_1.WebSocketServer({ noServer: true })
};
const subs = new Map();
const timers = new Map();
const minuteOpens = new Map();
async function tick(symbol) {
    try {
        const r = await fetch('https://contract.mexc.com/api/v1/contract/ticker');
        if (!r.ok)
            return;
        const j = await r.json();
        const arr = Array.isArray(j?.data) ? j.data : [];
        const row = arr.find((x) => x?.symbol === symbol);
        const price = row ? Number(row.lastPrice) : NaN;
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
        // Update central price service
        priceService_1.priceService.updatePrice(symbol, price);
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
                const sym = msg.symbol.toUpperCase().includes('_') ? msg.symbol.toUpperCase() : msg.symbol.toUpperCase().replace(/(USDT|USDC)$/, '_$1');
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
//# sourceMappingURL=futuresTicks.js.map