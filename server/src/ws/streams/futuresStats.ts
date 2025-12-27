// Per-symbol futures 24h stats; subscribe with symbol. Polling fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'sub_all' } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/futures-24h'],
	wss: new WebSocketServer({ noServer: true })
}

const subs = new Map<string, Set<WebSocket>>()
const allStatsSubs = new Set<WebSocket>()
let timer: NodeJS.Timeout | null = null

async function send() {
	try {
		const r = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
		if (!r.ok) return
		const j = await r.json() as any
		const arr = Array.isArray(j?.data) ? j.data : []

		const data: any[] = arr.map((row: any) => {
			const rawRise = row?.riseFallRate
			const riseFallRate = typeof rawRise === 'number'
				? (Math.abs(rawRise) <= 1 ? rawRise * 100 : rawRise)
				: (typeof rawRise === 'string' ? (Math.abs(parseFloat(rawRise)) <= 1 ? parseFloat(rawRise) * 100 : parseFloat(rawRise)) : null)

			return {
				symbol: row.symbol,
				lastPrice: row?.lastPrice ?? row?.last ?? null,
				change24h: riseFallRate,
				high24h: row?.highPrice ?? row?.highestPrice ?? row?.high24Price ?? row?.high24h ?? row?.maxPrice ?? row?.max24h ?? row?.priceHigh ?? null,
				low24h: row?.lowPrice ?? row?.lowestPrice ?? row?.lower24Price ?? row?.low24h ?? row?.minPrice ?? row?.min24h ?? row?.priceLow ?? null,
				volume24h: row?.quoteVolume ?? row?.amount ?? row?.amount24 ?? row?.turnover ?? row?.turnover24 ?? row?.turnoverUsd ?? row?.volume ?? row?.volume24 ?? row?.vol24 ?? row?.vol ?? row?.baseVolume ?? null,
				fundingRate: row?.fundingRate ?? null,
			}
		})

		// Fill The bucket from futures stats
		for (const d of data) {
			const price = Number((d as any).lastPrice);
			if (Number.isFinite(price) && (d as any).symbol) priceService.updatePrice((d as any).symbol, price);
		}

		// Broadcast all
		if (allStatsSubs.size > 0) {
			const payload = JSON.stringify({ type: 'stats_all', data, t: Date.now() })
			for (const c of allStatsSubs) { try { (c as any).send(payload) } catch { } }
		}

		// Broadcast individual
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
				const sym = msg.symbol.toUpperCase().includes('_') ? msg.symbol.toUpperCase() : msg.symbol.toUpperCase().replace(/(USDT|USDC)$/, '_$1')
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
