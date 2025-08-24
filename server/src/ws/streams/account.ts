import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import { verifyAccessToken } from '../../utils/jwt'

type AccountEvent = 
  | { kind: 'balance'; spotAvailable: { USDT: string; USDC: string } }
  | { kind: 'position'; asset: string; available: string }
  | { kind: 'order'; order: any }

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
    if (set.delete(ws) && set.size === 0) userSockets.delete(uid)
  }
}

export function emitAccountEvent(userId: string, event: AccountEvent) {
  const set = userSockets.get(userId)
  if (!set || set.size === 0) return
  const payload = JSON.stringify({ type: 'account', ...event, t: Date.now() })
  for (const ws of set) { try { (ws as any).send(payload) } catch {} }
}

function extractToken(req: IncomingMessage): string | null {
  // Try to get token from query parameters first
  const raw = req.url || ''
  try {
    const u = new URL(raw, `http://${req.headers.host || 'localhost'}`)
    const q = u.searchParams.get('token')
    if (q) return q
  } catch {}
  
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
    console.log('[WS Account] New connection attempt')
    console.log('[WS Account] URL:', req.url)
    console.log('[WS Account] Headers:', Object.keys(req.headers))
    
    const tok = extractToken(req)
    console.log('[WS Account] Token extracted:', tok ? 'YES' : 'NO')
    
    if (!tok) { 
      console.log('[WS Account] No token found, closing connection')
      try { ws.close() } catch {}; 
      return 
    }
    
    const payload = verifyAccessToken(tok)
    const userId = String(payload.sub)
    console.log('[WS Account] User authenticated:', userId)
    
    addSocket(userId, ws as any)
    ws.on('message', (_raw: Buffer) => { /* no-op for now */ })
    ws.on('close', () => { 
      console.log('[WS Account] Socket closed for user:', userId)
      removeSocket(ws as any) 
    })
    
    console.log('[WS Account] Connection established successfully')
  } catch (error) {
    console.error('[WS Account] Connection error:', error)
    try { ws.close() } catch {} 
  }
})


