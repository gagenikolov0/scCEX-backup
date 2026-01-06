// Per-symbol futures order book; subscribe with symbol and depth. Polling fan-out.

import { WebSocketServer } from 'ws'

type ClientMsg = { type: 'sub'; symbol: string; depth?: number } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/futures-depth'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>() // key: SYMBOL:DEPTH
const timers = new Map<string, NodeJS.Timeout>() // key: SYMBOL:DEPTH

function keyFor(sym: string, depth: number): string { return `${sym}:${depth}` }
function normalize(sym: string): string { return sym.toUpperCase().includes('_') ? sym.toUpperCase() : sym.toUpperCase().replace(/(USDT|USDC)$/, '_$1') }

async function send(symbol: string, depth: number) {
	try {
		// Try multiple variants: query and path styles, depth/size params
		const urls = [
			`https://contract.mexc.com/api/v1/contract/depth?symbol=${encodeURIComponent(symbol)}&depth=${encodeURIComponent(String(depth))}`,
			`https://contract.mexc.com/api/v1/contract/depth?symbol=${encodeURIComponent(symbol)}&size=${encodeURIComponent(String(depth))}`,
			`https://contract.mexc.com/api/v1/contract/depth/${encodeURIComponent(symbol)}?depth=${encodeURIComponent(String(depth))}`,
			`https://contract.mexc.com/api/v1/contract/depth/${encodeURIComponent(symbol)}?size=${encodeURIComponent(String(depth))}`,
		]
		let data: any = null
		for (const u of urls) {
			try {
				const r = await fetch(u)
				if (r.ok) { data = await r.json(); break }
			} catch { }
		}
		const d = data?.data ?? data
		const bids = Array.isArray(d?.bids) ? d.bids.slice(0, depth).map((x: any[]) => [Number(x[0]), Number(x[1])]) : []
		const asks = Array.isArray(d?.asks) ? d.asks.slice(0, depth).map((x: any[]) => [Number(x[0]), Number(x[1])]) : []
		const payload = JSON.stringify({ type: 'depth', symbol, depth, bids, asks, t: Date.now() })
		const k = keyFor(symbol, depth)
		const set = subs.get(k)
		if (!set || set.size === 0) return
		for (const c of set) { try { (c as any).send(payload) } catch { } }
	} catch { }
}

function start(symbol: string, depth: number) {
	const k = keyFor(symbol, depth)
	if (timers.has(k)) return
	timers.set(k, setInterval(() => { void send(symbol, depth) }, 3000))
	void send(symbol, depth)
}
function stop(symbol: string, depth: number) {
	const k = keyFor(symbol, depth)
	const t = timers.get(k)
	if (t) clearInterval(t)
	timers.delete(k)
}

stream.wss.on('connection', (ws: any) => {
	ws.on('message', (raw: Buffer) => {
		try {
			const msg = JSON.parse(String(raw)) as ClientMsg
			if (msg.type === 'sub' && msg.symbol) {
				const sym = normalize(msg.symbol)
				const depth = Number(msg.depth) > 0 ? Number(msg.depth) : 50
				const k = keyFor(sym, depth)
				let set = subs.get(k); if (!set) { set = new Set(); subs.set(k, set) }
				set.add(ws as any)
				start(sym, depth)
			} else if (msg.type === 'unsub') {
				for (const [k, set] of subs) {
					if (set.delete(ws as any) && set.size === 0) { subs.delete(k); const [s, d] = (k || '').split(':'); stop(s || '', Number(d || '0')) }
				}
			}
		} catch { }
	})
	ws.on('close', () => {
		for (const [k, set] of subs) {
			if (set.delete(ws as any) && set.size === 0) { subs.delete(k); const [s, d] = (k || '').split(':'); stop(s || '', Number(d || '0')) }
		}
	})
})
