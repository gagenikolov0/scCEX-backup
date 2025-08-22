import type { Server as HttpServer, IncomingMessage } from 'http'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'

type ClientMsg = { type: 'sub'; symbol: string } | { type: 'unsub' }

export function attachMarketWSS(server: HttpServer) {
  // Create WS servers in noServer mode and route by path in a single upgrade handler
  const wss = new WebSocketServer({ noServer: true })
  const tickersWss = new WebSocketServer({ noServer: true })
  const futuresTickersWss = new WebSocketServer({ noServer: true })
  const futuresTicksWss = new WebSocketServer({ noServer: true })

  // Spot per-symbol ticks stream (subscribe to symbol) with shared timers per symbol
  const spotSymbolSubscribers = new Map<string, Set<WebSocket>>()
  const spotSymbolTimers = new Map<string, NodeJS.Timeout>()
  const spotLog = (...a: any[]) => { if (process.env.NODE_ENV !== 'production') try { console.log(...a) } catch {} }
  const startSpotSymbol = async (symbol: string) => {
    if (spotSymbolTimers.has(symbol)) return
    const sendTick = async () => {
      try {
        const resp = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`)
        if (!resp.ok) return
        const j = await resp.json() as { symbol: string; price: string }
        const price = parseFloat(j.price)
        if (!Number.isFinite(price)) return
        const payload = JSON.stringify({ type: 'tick', symbol, price, t: Date.now() })
        const subs = spotSymbolSubscribers.get(symbol)
        if (!subs || subs.size === 0) return
        for (const client of subs) {
          try { client.send(payload) } catch {}
        }
      } catch {}
    }
    spotSymbolTimers.set(symbol, setInterval(sendTick, 1000))
    await sendTick()
  }
  const stopSpotSymbol = (symbol: string) => {
    const t = spotSymbolTimers.get(symbol)
    if (t) clearInterval(t)
    spotSymbolTimers.delete(symbol)
  }
  wss.on('connection', (ws: WebSocket) => {
    spotLog('[ws] spot ticks connected')
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMsg
        if (msg.type === 'sub' && msg.symbol) {
          const sym = msg.symbol.toUpperCase()
          let set = spotSymbolSubscribers.get(sym)
          if (!set) { set = new Set(); spotSymbolSubscribers.set(sym, set) }
          set.add(ws)
          startSpotSymbol(sym)
        } else if (msg.type === 'unsub') {
          for (const [sym, set] of spotSymbolSubscribers) {
            if (set.delete(ws) && set.size === 0) {
              spotSymbolSubscribers.delete(sym)
              stopSpotSymbol(sym)
            }
          }
        }
      } catch {}
    })
    ws.on('close', () => {
      for (const [sym, set] of spotSymbolSubscribers) {
        if (set.delete(ws) && set.size === 0) {
          spotSymbolSubscribers.delete(sym)
          stopSpotSymbol(sym)
        }
      }
    })
  })

  // Spot tickers stream for Markets page (per-connection timer)
  const spotTickerClients = new Set<WebSocket>()
  let spotTickerTimer: NodeJS.Timeout | null = null
  const spotTickerLog = (...a: any[]) => { if (process.env.NODE_ENV !== 'production') try { console.log(...a) } catch {} }
  const startSpotTicker = async () => {
    if (spotTickerTimer) return
    const send = async () => {
      try {
        const resp = await fetch('https://api.mexc.com/api/v3/ticker/price')
        if (!resp.ok) return
        const data = await resp.json()
        const payload = JSON.stringify({ type: 'tickers', data, t: Date.now() })
        for (const c of spotTickerClients) { try { c.send(payload) } catch {} }
      } catch {}
    }
    spotTickerTimer = setInterval(send, 1000)
    await send()
  }
  const stopSpotTicker = () => { if (spotTickerTimer) clearInterval(spotTickerTimer); spotTickerTimer = null }
  tickersWss.on('connection', (ws: WebSocket) => {
    spotTickerLog('[ws] /ws/tickers connected')
    spotTickerClients.add(ws)
    startSpotTicker()
    ws.on('close', () => {
      spotTickerClients.delete(ws)
      if (spotTickerClients.size === 0) stopSpotTicker()
    })
  })

  // Futures tickers stream for Markets page (per-connection timer)
  const futTickerClients = new Set<WebSocket>()
  let futTickerTimer: NodeJS.Timeout | null = null
  const futTickerLog = (...a: any[]) => { if (process.env.NODE_ENV !== 'production') try { console.log(...a) } catch {} }
  const startFutTicker = async () => {
    if (futTickerTimer) return
    const send = async () => {
      try {
        const resp = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
        if (!resp.ok) return
        const data = await resp.json()
        const payload = JSON.stringify({ type: 'futures-tickers', data, t: Date.now() })
        for (const c of futTickerClients) { try { c.send(payload) } catch {} }
      } catch {}
    }
    futTickerTimer = setInterval(send, 1000)
    await send()
  }
  const stopFutTicker = () => { if (futTickerTimer) clearInterval(futTickerTimer); futTickerTimer = null }
  futuresTickersWss.on('connection', (ws: WebSocket) => {
    futTickerLog('[ws] /ws/futures-tickers connected')
    futTickerClients.add(ws)
    startFutTicker()
    ws.on('close', () => {
      futTickerClients.delete(ws)
      if (futTickerClients.size === 0) stopFutTicker()
    })
  })

  // Futures per-symbol ticks (subscribe to symbol) - approximated via polling lastPrice
  const futSymbolSubscribers = new Map<string, Set<WebSocket>>()
  const futSymbolTimers = new Map<string, NodeJS.Timeout>()
  const startFutSymbol = async (symbol: string) => {
    if (futSymbolTimers.has(symbol)) return
    const sendTick = async () => {
      try {
        const resp = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
        if (!resp.ok) return
        const j = await resp.json() as any
        const arr = Array.isArray(j?.data) ? j.data : []
        const row = arr.find((r: any) => r?.symbol === symbol)
        const price = row ? Number(row.lastPrice) : NaN
        if (!Number.isFinite(price)) return
        const payload = JSON.stringify({ type: 'tick', symbol, price, t: Date.now() })
        const subs = futSymbolSubscribers.get(symbol)
        if (!subs || subs.size === 0) return
        for (const c of subs) { try { c.send(payload) } catch {} }
      } catch {}
    }
    futSymbolTimers.set(symbol, setInterval(sendTick, 1000))
    await sendTick()
  }
  const stopFutSymbol = (symbol: string) => {
    const t = futSymbolTimers.get(symbol)
    if (t) clearInterval(t)
    futSymbolTimers.delete(symbol)
  }
  futuresTicksWss.on('connection', (ws: WebSocket) => {
    if (process.env.NODE_ENV !== 'production') try { console.log('[ws] futures ticks connected') } catch {}
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMsg
        if (msg.type === 'sub' && msg.symbol) {
          const sym = msg.symbol.toUpperCase().includes('_') ? msg.symbol.toUpperCase() : msg.symbol.toUpperCase().replace(/(USDT|USDC)$/,'_$1')
          let set = futSymbolSubscribers.get(sym)
          if (!set) { set = new Set(); futSymbolSubscribers.set(sym, set) }
          set.add(ws)
          startFutSymbol(sym)
        } else if (msg.type === 'unsub') {
          for (const [sym, set] of futSymbolSubscribers) {
            if (set.delete(ws) && set.size === 0) {
              futSymbolSubscribers.delete(sym)
              stopFutSymbol(sym)
            }
          }
        }
      } catch {}
    })
    ws.on('close', () => {
      for (const [sym, set] of futSymbolSubscribers) {
        if (set.delete(ws) && set.size === 0) {
          futSymbolSubscribers.delete(sym)
          stopFutSymbol(sym)
        }
      }
    })
  })
  // Single upgrade handler to route by pathname
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const rawUrl = req.url || ''
    let pathname = rawUrl
    try {
      const u = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)
      pathname = u.pathname
    } catch {}
    if (process.env.NODE_ENV !== 'production') try { console.log('[ws] upgrade', rawUrl, '->', pathname) } catch {}
    if (pathname.startsWith('/ws/market') || pathname.startsWith('/ws/spot-ticks')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/ws/tickers')) {
      tickersWss.handleUpgrade(req, socket, head, (ws) => {
        tickersWss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/ws/futures-tickers')) {
      futuresTickersWss.handleUpgrade(req, socket, head, (ws) => {
        futuresTickersWss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/ws/futures-ticks')) {
      futuresTicksWss.handleUpgrade(req, socket, head, (ws) => {
        futuresTicksWss.emit('connection', ws, req)
      })
    } else {
      try { console.warn('[ws] unknown path, destroying socket:', rawUrl) } catch {}
      socket.destroy()
    }
  })
}


