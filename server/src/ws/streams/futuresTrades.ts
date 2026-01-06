import { WebSocketServer } from 'ws'

type Trade = {
    price: number
    qty: number
    time: number
    side: 'buy' | 'sell'
}

type ClientMsg = { type: 'sub'; symbol: string; limit?: number } | { type: 'unsub' }

export const stream = {
    paths: ['/ws/futures-trades'],
    wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()

async function send(symbol: string) {
    try {
        // Use the deal endpoint: https://contract.mexc.com/api/v1/contract/deals/{symbol}
        // Normalize symbol: ensure underscores if needed, or removing?
        // MEXC futures symbols usually have underscores e.g. BTC_USDT.
        // The endpoint likely expects BTC_USDT.
        const r = await fetch(`https://contract.mexc.com/api/v1/contract/deals/${symbol}`)
        if (!r.ok) return
        const res = await r.json() as any
        const data = res?.data
        if (!Array.isArray(data)) return

        // Data format: { p: price, v: vol, T: type(1=buy, 2=sell), t: time, ... }
        const trades: Trade[] = data.map((t: any) => ({
            price: t.p,
            qty: t.v,
            time: t.t,
            side: t.T === 2 ? 'sell' : 'buy' // Assuming T=2 is sell based on price action hypothesis, can adjust if backwards
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
                const sym = msg.symbol.toUpperCase() // Ensure consistent Key
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
