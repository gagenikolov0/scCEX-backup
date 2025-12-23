// Per-symbol spot 24h stats; subscribe with symbol. Polling fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'sub_all' } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/spot-24h'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const allStatsSubs = new Set<WebSocket>()
let timer: NodeJS.Timeout | null = null

async function send() {
	try {
		const r = await fetch('https://api.mexc.com/api/v3/ticker/24hr')
		if (!r.ok) return
		const rawArr = await r.json()
		if (!Array.isArray(rawArr)) return

		const data = rawArr.map((raw: any) => ({
			symbol: raw.symbol,
			lastPrice: raw.lastPrice ?? raw.last ?? raw.price ?? null,

			// Mexc V3 returns priceChangePercent as a decimal ratio (e.g. 0.02 for 2%), so * 100
			change24h: raw.priceChangePercent ? parseFloat(raw.priceChangePercent) * 100 : null,
			high24h: raw.highPrice ?? null,
			low24h: raw.lowPrice ?? null,
			volume24h: raw.quoteVolume ?? raw.volume ?? null, // Prefer quote volume (USDT) for better readability
			baseVolume: raw.volume ?? null,
		}))

		// Update central price service
		for (const d of data) {
			const price = parseFloat(d.lastPrice);
			if (Number.isFinite(price)) priceService.updatePrice(d.symbol, price);
		}

		// Broadcast all to 'sub_all' clients
		if (allStatsSubs.size > 0) {
			const payload = JSON.stringify({ type: 'stats_all', data, t: Date.now() })
			for (const c of allStatsSubs) { try { (c as any).send(payload) } catch { } }
		}

		// Broadcast individual stats to specific symbol subscribers
		for (const [symbol, set] of subs) {
			if (set.size === 0) continue
			const row = data.find(d => d.symbol === symbol)
			if (!row) continue
			const payload = JSON.stringify({ type: 'stats', symbol, data: row, t: Date.now() })
			for (const c of set) { try { (c as any).send(payload) } catch { } }
		}
	} catch { }
}

function start() {
	if (timer) return
	timer = setInterval(send, 5000)
	void send()
}
function stop() {
	if (allStatsSubs.size === 0 && Array.from(subs.values()).every(s => s.size === 0)) {
		if (timer) clearInterval(timer)
		timer = null
	}
}

stream.wss.on('connection', (ws: any) => {
	ws.on('message', (raw: Buffer) => {
		try {
			const msg = JSON.parse(String(raw)) as ClientMsg
			if (msg.type === 'sub_all') {
				allStatsSubs.add(ws)
				start()
			} else if (msg.type === 'sub' && msg.symbol) {
				const sym = msg.symbol.toUpperCase()
				let set = subs.get(sym); if (!set) { set = new Set(); subs.set(sym, set) }
				set.add(ws)
				start()
			} else if (msg.type === 'unsub') {
				allStatsSubs.delete(ws)
				for (const [sym, set] of subs) { set.delete(ws) }
				stop()
			}
		} catch { }
	})
	ws.on('close', () => {
		allStatsSubs.delete(ws)
		for (const [sym, set] of subs) { set.delete(ws) }
		stop()
	})
})
