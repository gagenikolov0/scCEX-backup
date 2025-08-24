// Broadcasts all spot symbols’ last prices every second. Polling fan-out.

import { WebSocketServer } from 'ws'

export const stream = {
	paths: ['/ws/tickers'],
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
		for (const c of clients) { try { (c as any).send(payload) } catch {} }
	} catch {}
}

function start() { if (!timer) { timer = setInterval(send, 1000); void send() } }
function stop() { if (timer) { clearInterval(timer); timer = null } }

stream.wss.on('connection', (ws: any) => {
	clients.add(ws)
	start()
	ws.on('close', () => {
		clients.delete(ws)
		if (clients.size === 0) stop()
	})
})
