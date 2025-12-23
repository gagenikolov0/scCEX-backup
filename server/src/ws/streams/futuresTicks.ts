// Per-symbol futures ticks; subscribe with a futures symbol like BTC_USDT. Polling fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/futures-ticks'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()
const minuteOpens = new Map<string, { minute: number; price: number }>()

async function tick(symbol: string) {
	try {
		const r = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
		if (!r.ok) return
		const j = await r.json() as any
		const arr = Array.isArray(j?.data) ? j.data : []
		const row = arr.find((x: any) => x?.symbol === symbol)
		const price = row ? Number(row.lastPrice) : NaN
		if (!Number.isFinite(price)) return

		// Update minute open tracking
		const now = Date.now()
		const currentMin = Math.floor(now / 60000)
		let open = minuteOpens.get(symbol)
		if (!open || open.minute < currentMin) {
			open = { minute: currentMin, price }
			minuteOpens.set(symbol, open)
		}

		// Update central price service
		priceService.updatePrice(symbol, price);

		const payload = JSON.stringify({ type: 'tick', symbol, price, open: open.price, t: now })
		const set = subs.get(symbol)
		if (!set || set.size === 0) return
		for (const c of set) { try { (c as any).send(payload) } catch { } }
	} catch { }
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
				const sym = msg.symbol.toUpperCase().includes('_') ? msg.symbol.toUpperCase() : msg.symbol.toUpperCase().replace(/(USDT|USDC)$/, '_$1')
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
