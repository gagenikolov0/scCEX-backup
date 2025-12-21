// Per-symbol spot 24h stats; subscribe with symbol. Polling fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/spot-24h'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()

async function send(symbol: string) {
	try {
		const url = `https://api.mexc.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
		const r = await fetch(url)
		if (!r.ok) return
		const raw = await r.json()
		const data = {
			lastPrice: raw?.lastPrice ?? raw?.last ?? raw?.price ?? null,
			priceChangePercent: raw?.priceChangePercent ?? raw?.changeRate ?? null,
			highPrice: raw?.highPrice ?? raw?.high ?? null,
			lowPrice: raw?.lowPrice ?? raw?.low ?? null,
			volume: raw?.volume ?? raw?.vol ?? null,
			quoteVolume: raw?.quoteVolume ?? raw?.quoteVol ?? null,
		}
		const payload = JSON.stringify({ type: 'stats', symbol, data, t: Date.now() })

		// Update central price service
		const price = parseFloat(data.lastPrice);
		if (Number.isFinite(price)) {
			priceService.updatePrice(symbol, price);
		}

		const set = subs.get(symbol)
		if (!set || set.size === 0) return
		for (const c of set) { try { (c as any).send(payload) } catch { } }
	} catch { }
}

function start(symbol: string) {
	if (timers.has(symbol)) return
	timers.set(symbol, setInterval(() => { void send(symbol) }, 5000))
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
