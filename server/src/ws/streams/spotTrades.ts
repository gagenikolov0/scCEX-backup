import { WebSocketServer } from 'ws'

type Trade = {
    price: number
    qty: number
    time: number
    side: 'buy' | 'sell'
}

type ClientMsg = { type: 'sub'; symbol: string; limit?: number } | { type: 'unsub' }

export const stream = {
    paths: ['/ws/spot-trades'],
    wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()
// To prevent sending duplicates, we could track last trade ID, but simpler is to just send set
// Or for polling, we often just send the snapshot and let client dedupe or just replacing buffer.
// Actually, for a "stream" feel, we want to only send NEW trades. 
// But simplest first ver: just send the recent snapshot 1/s.
// Client can dedupe if it uses IDs (spot has IDs, futures has 'i').

async function send(symbol: string) {
    try {
        // limit=50 is reasonable
        const r = await fetch(`https://api.mexc.com/api/v3/trades?symbol=${symbol.replace('_', '')}&limit=50`)
        if (!r.ok) return
        const j = await r.json() as any[]
        if (!Array.isArray(j)) return

        const trades: Trade[] = j.map(t => ({
            price: parseFloat(t.price),
            qty: parseFloat(t.qty),
            time: t.time,
            side: t.isBuyerMaker ? 'sell' : 'buy'
        }))

        const payload = JSON.stringify({ type: 'trades', symbol, data: trades, t: Date.now() })
        const set = subs.get(symbol)
        if (!set || set.size === 0) return
        for (const c of set) { try { (c as any).send(payload) } catch { } }
    } catch { }
}

function start(symbol: string) {
    if (timers.has(symbol)) return
    timers.set(symbol, setInterval(() => { void send(symbol) }, 3000))
    void send(symbol)
}
function stop(symbol: string) {
    const t = timers.get(symbol)
    if (t) clearInterval(t)
    timers.delete(symbol)
}

stream.wss.on('connection', (ws: any) => {
    ws.on('message', (raw: Buffer) => {
        try {
            const msg = JSON.parse(String(raw)) as ClientMsg
            if (msg.type === 'sub' && msg.symbol) {
                const sym = msg.symbol.toUpperCase()
                let set = subs.get(sym); if (!set) { set = new Set(); subs.set(sym, set) }
                set.add(ws as any)
                start(sym)
            } else if (msg.type === 'unsub') {
                for (const [sym, set] of subs) {
                    if (set.delete(ws as any) && set.size === 0) { subs.delete(sym); stop(sym) }
                }
            }
        } catch { }
    })
    ws.on('close', () => {
        for (const [sym, set] of subs) {
            if (set.delete(ws as any) && set.size === 0) { subs.delete(sym); stop(sym) }
        }
    })
})
