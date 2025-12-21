// Broadcasts all spot tickers every second. Simple fan-out.

import { WebSocketServer } from 'ws'
import { priceService } from '../../utils/priceService'

export const stream = {
	paths: ['/ws/spot-tickers'],
	wss: new WebSocketServer({ noServer: true })
}

const clients = new Set<WebSocket>()
let timer: NodeJS.Timeout | null = null

async function send() {
	try {
		const resp = await fetch('https://api.mexc.com/api/v3/ticker/price')
		if (!resp.ok) return
		const data = await resp.json()
		const payload = JSON.stringify({ type: 'tickers', data, t: Date.now() })

		// Bulk update central price service
		if (Array.isArray(data)) {
			for (const t of data) {
				const p = parseFloat(t.price);
				if (Number.isFinite(p)) priceService.updatePrice(t.symbol, p);
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
