import type { Server as HttpServer, IncomingMessage } from 'http'
import { WebSocketServer } from 'ws'

type Stream = { paths: string[]; wss: WebSocketServer }

// Streams
import { stream as spotTicks } from './streams/spotTicks'
import { stream as futuresTicks } from './streams/futuresTicks'
import { stream as spotStats } from './streams/spotStats'
import { stream as futuresStats } from './streams/futuresStats'
import { stream as spotDepth } from './streams/spotDepth'
import { stream as futuresDepth } from './streams/futuresDepth'
import { stream as account } from './streams/account'
import { stream as spotTrades } from './streams/spotTrades'
import { stream as futuresTrades } from './streams/futuresTrades'

const streams: Stream[] = [
  spotTicks, futuresTicks,
  spotStats, futuresStats, spotDepth, futuresDepth, account,
  spotTrades, futuresTrades
]

export function attachMarketWSS(server: HttpServer) {
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const rawUrl = req.url || ''
    console.log(`[WS] Upgrade request: ${rawUrl}`)

    let pathname = rawUrl
    try {
      const u = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)
      pathname = u.pathname
    } catch (e) {
      console.error(`[WS] URL parse error:`, e)
    }

    console.log(`[WS] Pathname: ${pathname}`)

    for (const s of streams) {
      if (s.paths.some(p => pathname === p)) {
        console.log(`[WS] Found matching stream for ${pathname}`)
        s.wss.handleUpgrade(req, socket, head, (ws) => {
          console.log(`[WS] Handshake successful for ${pathname}`)
          s.wss.emit('connection', ws, req)
        })
        return
      }
    }

    console.warn(`[WS] No matching stream for ${pathname}`)
    socket.destroy()
  })
}


