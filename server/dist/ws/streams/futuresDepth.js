"use strict";
// Per-symbol futures order book; subscribe with symbol and depth. Polling fan-out.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
const ws_1 = require("ws");
exports.stream = {
    paths: ['/ws/futures-depth'],
    wss: new ws_1.WebSocketServer({ noServer: true })
};
const subs = new Map(); // key: SYMBOL:DEPTH
const timers = new Map(); // key: SYMBOL:DEPTH
function keyFor(sym, depth) { return `${sym}:${depth}`; }
function normalize(sym) { return sym.toUpperCase().includes('_') ? sym.toUpperCase() : sym.toUpperCase().replace(/(USDT|USDC)$/, '_$1'); }
async function send(symbol, depth) {
    try {
        // Try multiple variants: query and path styles, depth/size params
        const urls = [
            `https://contract.mexc.com/api/v1/contract/depth?symbol=${encodeURIComponent(symbol)}&depth=${encodeURIComponent(String(depth))}`,
            `https://contract.mexc.com/api/v1/contract/depth?symbol=${encodeURIComponent(symbol)}&size=${encodeURIComponent(String(depth))}`,
            `https://contract.mexc.com/api/v1/contract/depth/${encodeURIComponent(symbol)}?depth=${encodeURIComponent(String(depth))}`,
            `https://contract.mexc.com/api/v1/contract/depth/${encodeURIComponent(symbol)}?size=${encodeURIComponent(String(depth))}`,
        ];
        let data = null;
        for (const u of urls) {
            try {
                const r = await fetch(u);
                if (r.ok) {
                    data = await r.json();
                    break;
                }
            }
            catch { }
        }
        const d = data?.data ?? data;
        const bids = Array.isArray(d?.bids) ? d.bids.slice(0, depth).map((x) => [Number(x[0]), Number(x[1])]) : [];
        const asks = Array.isArray(d?.asks) ? d.asks.slice(0, depth).map((x) => [Number(x[0]), Number(x[1])]) : [];
        const payload = JSON.stringify({ type: 'depth', symbol, depth, bids, asks, t: Date.now() });
        const k = keyFor(symbol, depth);
        const set = subs.get(k);
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
function start(symbol, depth) {
    const k = keyFor(symbol, depth);
    if (timers.has(k))
        return;
    timers.set(k, setInterval(() => { void send(symbol, depth); }, 1000));
    void send(symbol, depth);
}
function stop(symbol, depth) {
    const k = keyFor(symbol, depth);
    const t = timers.get(k);
    if (t)
        clearInterval(t);
    timers.delete(k);
}
exports.stream.wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            if (msg.type === 'sub' && msg.symbol) {
                const sym = normalize(msg.symbol);
                const depth = Number(msg.depth) > 0 ? Number(msg.depth) : 50;
                const k = keyFor(sym, depth);
                let set = subs.get(k);
                if (!set) {
                    set = new Set();
                    subs.set(k, set);
                }
                set.add(ws);
                start(sym, depth);
            }
            else if (msg.type === 'unsub') {
                for (const [k, set] of subs) {
                    if (set.delete(ws) && set.size === 0) {
                        subs.delete(k);
                        const [s, d] = (k || '').split(':');
                        stop(s || '', Number(d || '0'));
                    }
                }
            }
        }
        catch { }
    });
    ws.on('close', () => {
        for (const [k, set] of subs) {
            if (set.delete(ws) && set.size === 0) {
                subs.delete(k);
                const [s, d] = (k || '').split(':');
                stop(s || '', Number(d || '0'));
            }
        }
    });
});
//# sourceMappingURL=futuresDepth.js.map