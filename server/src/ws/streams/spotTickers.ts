// Subscription-based spot tickers fan-out. Server fetches once per second and fans out subsets per client.

import { WebSocketServer } from 'ws'

type ClientMsg = { type: 'sub'; symbols: string[] } | { type: 'unsub' }

export const stream = {
	paths: ['/ws/tickers'],
	wss: new WebSocketServer({ noServer: true })
}

const clientSubs = new Map<WebSocket, Set<string>>()
let timer: NodeJS.Timeout | null = null
let latestMap: Record<string, number> = {}

async function refreshUpstream() {
	try {
		const resp = await fetch('https://api.mexc.com/api/v3/ticker/price')
		if (!resp.ok) return
		const arr = await resp.json()
		const map: Record<string, number> = {}
		if (Array.isArray(arr)) {
			for (const t of arr) {
				const sym = (t?.symbol || '').toUpperCase()
				const p = parseFloat(t?.price ?? 'NaN')
				if (sym && Number.isFinite(p)) map[sym] = p
			}
		}
		latestMap = map
		const now = Date.now()
		// Fan out only subscribed symbols per client
		for (const [ws, subs] of clientSubs) {
			if (subs.size === 0) continue
			const data: any[] = []
			for (const s of subs) {
				const p = latestMap[s]
				if (p && Number.isFinite(p)) data.push({ symbol: s, price: String(p) })
			}
			if (data.length > 0) {
				const payload = JSON.stringify({ type: 'tickers', data, t: now })
				try { (ws as any).send(payload) } catch {}
			}
		}
	} catch {}
}

function start() { if (!timer) { timer = setInterval(refreshUpstream, 1000); void refreshUpstream() } }
function stop() { if (timer) { clearInterval(timer); timer = null } }

stream.wss.on('connection', (ws: any) => {
	clientSubs.set(ws as any, new Set())
	start()
	ws.on('message', (raw: Buffer) => {
		try {
			const msg = JSON.parse(String(raw)) as ClientMsg
			if (msg?.type === 'sub' && Array.isArray((msg as any).symbols)) {
				const next = new Set<string>()
				for (const s of (msg as any).symbols) {
					if (!s) continue
					const sym = String(s).toUpperCase()
					if (/^[A-Z0-9_]{2,20}$/.test(sym)) next.add(sym)
				}
				clientSubs.set(ws as any, next)
				// Send immediate snapshot for requested symbols
				const data: any[] = []
				for (const s of next) {
					const p = latestMap[s]
					if (p && Number.isFinite(p)) data.push({ symbol: s, price: String(p) })
				}
				if (data.length > 0) {
					try { (ws as any).send(JSON.stringify({ type: 'tickers', data, t: Date.now() })) } catch {}
				}
			} else if (msg?.type === 'unsub') {
				clientSubs.set(ws as any, new Set())
			}
		} catch {}
	})
	ws.on('close', () => {
		clientSubs.delete(ws as any)
		if (clientSubs.size === 0) stop()
	})
})
