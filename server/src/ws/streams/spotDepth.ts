import { WebSocketServer } from 'ws'

type ClientMsg = { type: 'sub'; symbol: string; depth?: number } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/spot-depth'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()

async function send(symbol: string, depth: number) {
	try {
		const url = `https://api.mexc.com/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${encodeURIComponent(String(depth))}`
		const r = await fetch(url)
		if (!r.ok) return
		const j = await r.json() as any
		const bids = Array.isArray(j?.bids) ? j.bids.slice(0, depth).map((x: any) => [Number(x[0] ?? x.price ?? x[1]), Number(x[1] ?? x.qty ?? x[2])]) : []
		const asks = Array.isArray(j?.asks) ? j.asks.slice(0, depth).map((x: any) => [Number(x[0] ?? x.price ?? x[1]), Number(x[1] ?? x.qty ?? x[2])]) : []
		const payload = JSON.stringify({ type: 'depth', symbol, depth, bids, asks, t: Date.now() })
		const key = `${symbol}:${depth}`
		const set = subs.get(key)
		if (!set || set.size === 0) return
		for (const c of set) { try { (c as any).send(payload) } catch {} }
	} catch {}
}

function start(symbol: string, depth: number) {
	const key = `${symbol}:${depth}`
	if (timers.has(key)) return
	timers.set(key, setInterval(() => { void send(symbol, depth) }, 1000))
	void send(symbol, depth)
}
function stop(symbol: string, depth: number) {
	const key = `${symbol}:${depth}`
	const t = timers.get(key)
	if (t) clearInterval(t)
	timers.delete(key)
}

stream.wss.on('connection', (ws: any) => {
	ws.on('message', (raw: Buffer) => {
		try {
			const msg = JSON.parse(String(raw)) as ClientMsg
			if (msg.type === 'sub' && msg.symbol) {
				const sym = msg.symbol.toUpperCase()
				const depth = Number(msg.depth) > 0 ? Number(msg.depth) : 50
				const key = `${sym}:${depth}`
				let set = subs.get(key); if (!set) { set = new Set(); subs.set(key, set) }
				set.add(ws as any)
				start(sym, depth)
			} else if (msg.type === 'unsub') {
				for (const [k, set] of subs) {
					if (set.delete(ws as any) && set.size === 0) { subs.delete(k); const [sym, d] = (k || '').split(':'); stop(sym || '', Number(d || '50')) }
				}
			}
		} catch {}
	})
	ws.on('close', () => {
		for (const [k, set] of subs) {
			if (set.delete(ws as any) && set.size === 0) { subs.delete(k); const [sym, d] = (k || '').split(':'); stop(sym || '', Number(d || '50')) }
		}
	})
})
