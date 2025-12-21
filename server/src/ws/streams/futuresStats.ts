// Per-symbol futures 24h stats; subscribe with symbol. Polling fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/futures-24h'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const timers = new Map<string, NodeJS.Timeout>()

async function send(symbol: string) {
	try {
		const r = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
		if (!r.ok) return
		const j = await r.json() as any
		const arr = Array.isArray(j?.data) ? j.data : []
		const row = arr.find((x: any) => x?.symbol === symbol)
		if (!row) return
		const rawRise = row?.riseFallRate
		const riseFallRate = typeof rawRise === 'number'
			? (Math.abs(rawRise) <= 1 ? rawRise * 100 : rawRise)
			: (typeof rawRise === 'string' ? (Math.abs(parseFloat(rawRise)) <= 1 ? parseFloat(rawRise) * 100 : parseFloat(rawRise)) : null)
		const data = {
			lastPrice: row?.lastPrice ?? row?.last ?? null,
			riseFallRate,
			highPrice: row?.highPrice ?? row?.highestPrice ?? row?.high24Price ?? row?.high24h ?? row?.maxPrice ?? row?.max24h ?? row?.priceHigh ?? null,
			lowPrice: row?.lowPrice ?? row?.lowestPrice ?? row?.lower24Price ?? row?.low24h ?? row?.minPrice ?? row?.min24h ?? row?.priceLow ?? null,
			volume: row?.volume ?? row?.volume24 ?? row?.vol24 ?? row?.vol ?? row?.baseVolume ?? null,
			quoteVolume: row?.quoteVolume ?? row?.amount ?? row?.amount24 ?? row?.turnover ?? row?.turnover24 ?? row?.turnoverUsd ?? null,
			fundingRate: row?.fundingRate ?? null,
		}
		const payload = JSON.stringify({ type: 'stats', symbol, data, t: Date.now() })

		// Update central price service
		const price = Number(data.lastPrice);
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
