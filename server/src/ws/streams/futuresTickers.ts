// Broadcasts all futures contracts’ last prices every second. Polling fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

export const stream = {
	paths: ['/ws/futures-tickers'],
	wss: new WebSocketServer({ noServer: true })
}

const clients = new Set<WebSocket>()
let timer: NodeJS.Timeout | null = null

async function send() {
	try {
		const resp = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
		if (!resp.ok) return
		const data = await resp.json()
		const payload = JSON.stringify({ type: 'futures-tickers', data, t: Date.now() })

		// Bulk update central price service
		if (Array.isArray(data?.data)) {
			for (const t of data.data) {
				const p = Number(t.lastPrice);
				if (Number.isFinite(p) && t.symbol) priceService.updatePrice(t.symbol, p);
			}
		}

		for (const c of clients) { try { (c as any).send(payload) } catch { } }
	} catch { }
}

function start() {
	if (timer) return
	timer = setInterval(send, 1000)
	void send()
}

function stop() { if (timer) { clearInterval(timer); timer = null } }

stream.wss.on('connection', (ws: any) => {
	clients.add(ws)
	start()
	ws.on('close', () => {
		clients.delete(ws)
		if (clients.size === 0) stop()
	})
})
