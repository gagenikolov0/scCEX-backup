"use strict";
// Per-symbol spot 24h stats; subscribe with symbol. Polling fan-out.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
const ws_1 = require("ws");
const priceService_1 = require("../../utils/priceService");
exports.stream = {
    paths: ['/ws/spot-24h'],
    wss: new ws_1.WebSocketServer({ noServer: true })
};
const subs = new Map();
const allStatsSubs = new Set();
let timer = null;
async function send() {
    try {
        const r = await fetch('https://api.mexc.com/api/v3/ticker/24hr');
        if (!r.ok)
            return;
        const rawArr = await r.json();
        if (!Array.isArray(rawArr))
            return;
        const data = rawArr.map((raw) => ({
            symbol: raw.symbol,
            lastPrice: raw.lastPrice ?? raw.last ?? raw.price ?? null,
            // Mexc V3 returns priceChangePercent as a decimal ratio (e.g. 0.02 for 2%), so * 100
            change24h: raw.priceChangePercent ? parseFloat(raw.priceChangePercent) * 100 : null,
            high24h: raw.highPrice ?? null,
            low24h: raw.lowPrice ?? null,
            volume24h: raw.quoteVolume ?? raw.volume ?? null, // Prefer quote volume (USDT) for better readability
            baseVolume: raw.volume ?? null,
        }));
        // Update central price service
        for (const d of data) {
            const price = parseFloat(d.lastPrice);
            if (Number.isFinite(price))
                priceService_1.priceService.updatePrice(d.symbol, price);
        }
        // Broadcast all to 'sub_all' clients
        if (allStatsSubs.size > 0) {
            const payload = JSON.stringify({ type: 'stats_all', data, t: Date.now() });
            for (const c of allStatsSubs) {
                try {
                    c.send(payload);
                }
                catch { }
            }
        }
        // Broadcast individual stats to specific symbol subscribers
        for (const [symbol, set] of subs) {
            if (set.size === 0)
                continue;
            const row = data.find(d => d.symbol === symbol);
            if (!row)
                continue;
            const payload = JSON.stringify({ type: 'stats', symbol, data: row, t: Date.now() });
            for (const c of set) {
                try {
                    c.send(payload);
                }
                catch { }
            }
        }
    }
    catch { }
}
function start() {
    if (timer)
        return;
    timer = setInterval(send, 5000);
    void send();
}
function stop() {
    if (allStatsSubs.size === 0 && Array.from(subs.values()).every(s => s.size === 0)) {
        if (timer)
            clearInterval(timer);
        timer = null;
    }
}
exports.stream.wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            if (msg.type === 'sub_all') {
                allStatsSubs.add(ws);
                start();
            }
            else if (msg.type === 'sub' && msg.symbol) {
                const sym = msg.symbol.toUpperCase();
                let set = subs.get(sym);
                if (!set) {
                    set = new Set();
                    subs.set(sym, set);
                }
                set.add(ws);
                start();
            }
            else if (msg.type === 'unsub') {
                allStatsSubs.delete(ws);
                for (const [sym, set] of subs) {
                    set.delete(ws);
                }
                stop();
            }
        }
        catch { }
    });
    ws.on('close', () => {
        allStatsSubs.delete(ws);
        for (const [sym, set] of subs) {
            set.delete(ws);
        }
        stop();
    });
});
//# sourceMappingURL=spotStats.js.map