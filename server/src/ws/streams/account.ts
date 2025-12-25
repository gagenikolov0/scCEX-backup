import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import { verifyAccessToken } from '../../utils/jwt'
import { calculateTotalPortfolioUSD } from '../../utils/portfolio'

type AccountEvent =
  | { kind: 'balance'; spotAvailable: { USDT: string; USDC: string } }
  | { kind: 'spotPosition'; asset: string; available: string; reserved: string }
  | { kind: 'order'; order: any }
  | { kind: 'futuresBalance'; futuresAvailable: { USDT: string; USDC: string } }
  | { kind: 'futuresPosition'; symbol: string; position: any }
  | { kind: 'portfolio'; totalPortfolioUSD: number }

export const stream = {
  paths: ['/ws/account'],
  wss: new WebSocketServer({ noServer: true })
}

// userId -> sockets
const userSockets = new Map<string, Set<WebSocket>>()

function addSocket(userId: string, ws: WebSocket) {
  let set = userSockets.get(userId)
  if (!set) { set = new Set(); userSockets.set(userId, set) }
  set.add(ws)
}

function removeSocket(ws: WebSocket) {
  for (const [uid, set] of userSockets) {
    if (set.delete(ws) && set.size === 0) {
      userSockets.delete(uid)
      stopBroadcastingIfNoUsers()
    }
  }
}

let broadcastTimer: NodeJS.Timeout | null = null

function stopBroadcastingIfNoUsers() {
  if (userSockets.size === 0 && broadcastTimer) {
    clearInterval(broadcastTimer)
    broadcastTimer = null
  }
}

async function broadcastPortfolioUpdates() {
  for (const userId of userSockets.keys()) {
    try {
      const totalUSD = await calculateTotalPortfolioUSD(userId)
      emitAccountEvent(userId, { kind: 'portfolio', totalPortfolioUSD: totalUSD })
    } catch {
      // Quiet fail for one user
    }
  }
}


export function emitAccountEvent(userId: string, event: AccountEvent) {
  const sockets = userSockets.get(userId);          // all sockets for this user
  if (!sockets) return;

  const payload = JSON.stringify({
    type: 'account',   // tells the client what kind of data it is
    ...event,          // e.g. {kind:'balance', spotAvailable:{USDT:'10'}}
    t: Date.now()      // timestamp
  });

  for (const ws of sockets) { // the loop, loops WS messages
    try { (ws as any).send(payload); } catch { }   // <-- actual WS send
  }
}


function extractToken(req: IncomingMessage): string | null {
  // Try to get token from query parameters first
  const raw = req.url || ''
  try {
    const u = new URL(raw, `http://${req.headers.host || 'localhost'}`)
    const q = u.searchParams.get('token')
    if (q) return q
  } catch { }

  // Fallback to authorization header
  const auth = req.headers['authorization']
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7)

  // Try to get from sec-websocket-protocol header (alternative approach)
  const protocol = req.headers['sec-websocket-protocol']
  if (typeof protocol === 'string') {
    const parts = protocol.split(',')
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.startsWith('token=')) {
        return trimmed.slice(6) // Remove 'token=' prefix
      }
    }
  }

  return null
}

stream.wss.on('connection', (ws: any, req: IncomingMessage) => {
  try {
    const tok = extractToken(req)
    console.log(`[WS Account] Connection attempt. Token present: ${!!tok}`)

    if (!tok) {
      console.warn(`[WS Account] No token found in request`)
      try { ws.close() } catch { };
      return
    }

    try {
      const payload = verifyAccessToken(tok)
      const userId = String(payload.sub)
      console.log(`[WS Account] Authorized: ${userId}`)

      addSocket(userId, ws as any)

      // Start broadcasting if this is the first user
      if (!broadcastTimer) {
        broadcastTimer = setInterval(broadcastPortfolioUpdates, 2000)
      }

      ws.on('message', (_raw: Buffer) => { /* no-op for now */ })
      ws.on('close', () => {
        console.log(`[WS Account] Closed for user: ${userId}`)
        removeSocket(ws as any)
      })
    } catch (jwtErr: any) {
      console.error(`[WS Account] Token verification failed:`, jwtErr.message)
      try { ws.close() } catch { }
    }
  } catch (error: any) {
    console.error(`[WS Account] Connection error:`, error.message)
    try { ws.close() } catch { }
  }
})


