// Per-symbol spot ticks; subscribe with a symbol; polling fan-out.

import { WebSocketServer } from 'ws'
import { matchLimitOrders } from '../../utils/matchingEngine'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/spot-ticks'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()
const lastPrices = new Map<string, number>()

async function tick(symbol: string) {
	try {
		const resp = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`)
		if (!resp.ok) return
		const j = await resp.json() as any
		const price = parseFloat(j?.price)
		if (!Number.isFinite(price)) return

		const lastPrice = lastPrices.get(symbol)
		lastPrices.set(symbol, price)

		// Check for limit order matches if price changed
		if (lastPrice !== undefined && lastPrice !== price) {
			void matchLimitOrders(symbol, price)
		}

		const payload = JSON.stringify({ type: 'tick', symbol, price, t: Date.now() })
		const set = subs.get(symbol)
		if (!set || set.size === 0) return
		for (const c of set) { try { (c as any).send(payload) } catch {} }
	} catch {}
}

function start(symbol: string) {
	if (timers.has(symbol)) return
	timers.set(symbol, setInterval(() => { void tick(symbol) }, 1000))
	void tick(symbol)
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
		} catch {}
	})
	ws.on('close', () => {
		for (const [sym, set] of subs) {
			if (set.delete(ws as any) && set.size === 0) { subs.delete(sym); stop(sym) }
		}
	})
})
