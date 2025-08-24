import type { Server as HttpServer, IncomingMessage } from 'http'
import { WebSocketServer } from 'ws'

type Stream = { paths: string[]; wss: WebSocketServer }

// Streams
import { stream as spotTicks } from './streams/spotTicks'
import { stream as spotTickers } from './streams/spotTickers'
import { stream as futuresTickers } from './streams/futuresTickers'
import { stream as futuresTicks } from './streams/futuresTicks'
import { stream as spotStats } from './streams/spotStats'
import { stream as futuresStats } from './streams/futuresStats'
import { stream as spotDepth } from './streams/spotDepth'
import { stream as futuresDepth } from './streams/futuresDepth'

const streams: Stream[] = [
  spotTicks, spotTickers, futuresTickers, futuresTicks,
  spotStats, futuresStats, spotDepth, futuresDepth,
]

export function attachMarketWSS(server: HttpServer) {
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const rawUrl = req.url || ''
    let pathname = rawUrl
    try { const u = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`); pathname = u.pathname } catch {}
    try { console.log('[ws] upgrade', rawUrl, '->', pathname) } catch {}
    for (const s of streams) {
      if (s.paths.some(p => pathname.startsWith(p))) {
        try { console.log('[ws] match', pathname, '->', s.paths.join(',')) } catch {}
        s.wss.handleUpgrade(req, socket, head, (ws) => { s.wss.emit('connection', ws, req) })
        return
      }
    }
    try { console.warn('[ws] unknown path, destroying socket:', rawUrl) } catch {}
    socket.destroy()
  })
}


