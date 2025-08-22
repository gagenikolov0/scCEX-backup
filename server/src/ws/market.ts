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
  const spotStatsWss = new WebSocketServer({ noServer: true })
  const futuresStatsWss = new WebSocketServer({ noServer: true })
  const spotDepthWss = new WebSocketServer({ noServer: true })
  const futuresDepthWss = new WebSocketServer({ noServer: true })

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
  
  // Spot 24h stats per-symbol (shared timers)
  const spotStatsSubs = new Map<string, Set<WebSocket>>()
  const spotStatsTimers = new Map<string, NodeJS.Timeout>()
  const startSpotStats = async (symbol: string) => {
    if (spotStatsTimers.has(symbol)) return
    const tick = async () => {
      try {
        const url = `https://api.mexc.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
        const r = await fetch(url)
        if (!r.ok) return
        const raw = await r.json()
        const data = {
          lastPrice: raw?.lastPrice ?? raw?.last ?? raw?.price ?? null,
          priceChangePercent: raw?.priceChangePercent ?? raw?.changeRate ?? null,
          highPrice: raw?.highPrice ?? raw?.high ?? null,
          lowPrice: raw?.lowPrice ?? raw?.low ?? null,
          volume: raw?.volume ?? raw?.vol ?? null,
          quoteVolume: raw?.quoteVolume ?? raw?.quoteVol ?? null,
        }
        const payload = JSON.stringify({ type: 'stats', symbol, data, t: Date.now() })
        const subs = spotStatsSubs.get(symbol)
        if (!subs || subs.size === 0) return
        for (const c of subs) { try { c.send(payload) } catch {} }
      } catch {}
    }
    spotStatsTimers.set(symbol, setInterval(tick, 5000))
    await tick()
  }
  const stopSpotStats = (symbol: string) => {
    const t = spotStatsTimers.get(symbol)
    if (t) clearInterval(t)
    spotStatsTimers.delete(symbol)
  }
  spotStatsWss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any
        if (msg?.type === 'sub' && msg?.symbol) {
          const sym = String(msg.symbol).toUpperCase()
          let set = spotStatsSubs.get(sym)
          if (!set) { set = new Set(); spotStatsSubs.set(sym, set) }
          set.add(ws)
          startSpotStats(sym)
        } else if (msg?.type === 'unsub') {
          for (const [sym, set] of spotStatsSubs) {
            if (set.delete(ws) && set.size === 0) { spotStatsSubs.delete(sym); stopSpotStats(sym) }
          }
        }
      } catch {}
    })
    ws.on('close', () => {
      for (const [sym, set] of spotStatsSubs) {
        if (set.delete(ws) && set.size === 0) { spotStatsSubs.delete(sym); stopSpotStats(sym) }
      }
    })
  })

  // Futures 24h stats per-symbol (shared timers)
  const futStatsSubs = new Map<string, Set<WebSocket>>()
  const futStatsTimers = new Map<string, NodeJS.Timeout>()
  const startFutStats = async (symbol: string) => {
    if (futStatsTimers.has(symbol)) return
    const tick = async () => {
      try {
        const r = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
        if (!r.ok) return
        const j = await r.json()
        const arr = Array.isArray(j?.data) ? j.data : []
        const row = arr.find((x: any) => x?.symbol === symbol)
        if (!row) return
        // Normalize futures 24h stats with broad fallbacks
        const rawRise = row?.riseFallRate
        const riseFallRate = typeof rawRise === 'number'
          ? (Math.abs(rawRise) <= 1 ? rawRise * 100 : rawRise)
          : (typeof rawRise === 'string' ? (Math.abs(parseFloat(rawRise)) <= 1 ? parseFloat(rawRise) * 100 : parseFloat(rawRise)) : null)
        const data = {
          lastPrice: row?.lastPrice ?? row?.last ?? null,
          riseFallRate,
          highPrice: row?.highPrice ?? row?.highestPrice ?? row?.high24Price ?? row?.high24h ?? row?.maxPrice ?? row?.max24h ?? row?.priceHigh ?? null,
          lowPrice: row?.lowPrice ?? row?.lowestPrice ?? row?.lower24Price ?? row?.low24h ?? row?.minPrice ?? row?.min24h ?? row?.priceLow ?? null,
          volume: row?.volume ?? row?.volume24 ?? row?.vol24 ?? row?.vol ?? row?.baseVolume ?? null,
          quoteVolume: row?.quoteVolume ?? row?.amount ?? row?.amount24 ?? row?.turnover ?? row?.turnover24 ?? row?.turnoverUsd ?? null,
          fundingRate: row?.fundingRate ?? null,
        }
        const payload = JSON.stringify({ type: 'stats', symbol, data, t: Date.now() })
        const subs = futStatsSubs.get(symbol)
        if (!subs || subs.size === 0) return
        for (const c of subs) { try { c.send(payload) } catch {} }
      } catch {}
    }
    futStatsTimers.set(symbol, setInterval(tick, 5000))
    await tick()
  }
  const stopFutStats = (symbol: string) => {
    const t = futStatsTimers.get(symbol)
    if (t) clearInterval(t)
    futStatsTimers.delete(symbol)
  }
  futuresStatsWss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any
        if (msg?.type === 'sub' && msg?.symbol) {
          const sym = String(msg.symbol).toUpperCase().includes('_')
            ? String(msg.symbol).toUpperCase()
            : String(msg.symbol).toUpperCase().replace(/(USDT|USDC)$/,'_$1')
          let set = futStatsSubs.get(sym)
          if (!set) { set = new Set(); futStatsSubs.set(sym, set) }
          set.add(ws)
          startFutStats(sym)
        } else if (msg?.type === 'unsub') {
          for (const [sym, set] of futStatsSubs) {
            if (set.delete(ws) && set.size === 0) { futStatsSubs.delete(sym); stopFutStats(sym) }
          }
        }
      } catch {}
    })
    ws.on('close', () => {
      for (const [sym, set] of futStatsSubs) {
        if (set.delete(ws) && set.size === 0) { futStatsSubs.delete(sym); stopFutStats(sym) }
      }
    })
  })

  // Spot orderbook depth per symbol (shared timers per key symbol:depth)
  const spotDepthSubs = new Map<string, Set<WebSocket>>()
  const spotDepthTimers = new Map<string, NodeJS.Timeout>()
  const startSpotDepth = async (symbol: string, depth: number) => {
    const key = `${symbol}:${depth}`
    if (spotDepthTimers.has(key)) return
    const tick = async () => {
      try {
        const url = `https://api.mexc.com/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${encodeURIComponent(String(depth))}`
        const r = await fetch(url)
        if (!r.ok) return
        const j = await r.json() as any
        const bids = Array.isArray(j?.bids) ? j.bids.slice(0, depth).map((x: any) => [Number(x[0] ?? x.price ?? x[1]), Number(x[1] ?? x.qty ?? x[2])]) : []
        const asks = Array.isArray(j?.asks) ? j.asks.slice(0, depth).map((x: any) => [Number(x[0] ?? x.price ?? x[1]), Number(x[1] ?? x.qty ?? x[2])]) : []
        const payload = JSON.stringify({ type: 'depth', symbol, depth, bids, asks, t: Date.now() })
        const subs = spotDepthSubs.get(key)
        if (!subs || subs.size === 0) return
        for (const c of subs) { try { c.send(payload) } catch {} }
      } catch {}
    }
    spotDepthTimers.set(key, setInterval(tick, 1000))
    await tick()
  }
  const stopSpotDepth = (symbol: string, depth: number) => {
    const key = `${symbol}:${depth}`
    const t = spotDepthTimers.get(key)
    if (t) clearInterval(t)
    spotDepthTimers.delete(key)
  }
  spotDepthWss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any
        if (msg?.type === 'sub' && msg?.symbol) {
          const sym = String(msg.symbol).toUpperCase()
          const depth = Number(msg.depth) > 0 ? Number(msg.depth) : 50
          const key = `${sym}:${depth}`
          let set = spotDepthSubs.get(key)
          if (!set) { set = new Set(); spotDepthSubs.set(key, set) }
          set.add(ws)
          startSpotDepth(sym, depth)
        } else if (msg?.type === 'unsub') {
          for (const [k, set] of spotDepthSubs) {
            if (set.delete(ws) && set.size === 0) {
              spotDepthSubs.delete(k)
              const [sym, d] = (k || '').split(':'); stopSpotDepth(sym || '', Number(d || 0))
            }
          }
        }
      } catch {}
    })
    ws.on('close', () => {
      for (const [k, set] of spotDepthSubs) {
        if (set.delete(ws) && set.size === 0) {
          spotDepthSubs.delete(k)
          const [sym, d] = (k || '').split(':'); stopSpotDepth(sym || '', Number(d || 0))
        }
      }
    })
  })

  // Futures orderbook depth per symbol (shared timers per key symbol:depth)
  const futDepthSubs = new Map<string, Set<WebSocket>>()
  const futDepthTimers = new Map<string, NodeJS.Timeout>()
  const startFutDepth = async (symbol: string, depth: number) => {
    const key = `${symbol}:${depth}`
    if (futDepthTimers.has(key)) return
    const tick = async () => {
      try {
        const tryUrls = [
          `https://contract.mexc.com/api/v1/contract/depth?symbol=${encodeURIComponent(symbol)}&depth=${encodeURIComponent(String(depth))}`,
          `https://contract.mexc.com/api/v1/contract/depth?symbol=${encodeURIComponent(symbol)}&size=${encodeURIComponent(String(depth))}`,
          `https://contract.mexc.com/api/v1/contract/depth/${encodeURIComponent(symbol)}?depth=${encodeURIComponent(String(depth))}`,
          `https://contract.mexc.com/api/v1/contract/depth/${encodeURIComponent(symbol)}?size=${encodeURIComponent(String(depth))}`,
        ]
        let data: any = null
        for (const u of tryUrls) {
          try {
            const r = await fetch(u)
            if (r.ok) { data = await r.json(); break }
          } catch {}
        }
        const d = data?.data ?? data
        const bids = Array.isArray(d?.bids) ? d.bids.slice(0, depth).map((x: any[]) => [Number(x[0]), Number(x[1])]) : []
        const asks = Array.isArray(d?.asks) ? d.asks.slice(0, depth).map((x: any[]) => [Number(x[0]), Number(x[1])]) : []
        const payload = JSON.stringify({ type: 'depth', symbol, depth, bids, asks, t: Date.now() })
        const subs = futDepthSubs.get(key)
        if (!subs || subs.size === 0) return
        for (const c of subs) { try { c.send(payload) } catch {} }
      } catch {}
    }
    futDepthTimers.set(key, setInterval(tick, 1000))
    await tick()
  }
  const stopFutDepth = (symbol: string, depth: number) => {
    const key = `${symbol}:${depth}`
    const t = futDepthTimers.get(key)
    if (t) clearInterval(t)
    futDepthTimers.delete(key)
  }
  futuresDepthWss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any
        if (msg?.type === 'sub' && msg?.symbol) {
          const sym = String(msg.symbol).toUpperCase().includes('_')
            ? String(msg.symbol).toUpperCase()
            : String(msg.symbol).toUpperCase().replace(/(USDT|USDC)$/,'_$1')
          const depth = Number(msg.depth) > 0 ? Number(msg.depth) : 50
          const key = `${sym}:${depth}`
          let set = futDepthSubs.get(key)
          if (!set) { set = new Set(); futDepthSubs.set(key, set) }
          set.add(ws)
          startFutDepth(sym, depth)
        } else if (msg?.type === 'unsub') {
          for (const [k, set] of futDepthSubs) {
            if (set.delete(ws) && set.size === 0) {
              futDepthSubs.delete(k)
              const [sym, d] = (k || '').split(':'); stopFutDepth(sym || '', Number(d || 0))
            }
          }
        }
      } catch {}
    })
    ws.on('close', () => {
      for (const [k, set] of futDepthSubs) {
        if (set.delete(ws) && set.size === 0) {
          futDepthSubs.delete(k)
          const [sym, d] = (k || '').split(':'); stopFutDepth(sym || '', Number(d || 0))
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
    } else if (pathname.startsWith('/ws/spot-24h')) {
      spotStatsWss.handleUpgrade(req, socket, head, (ws) => {
        spotStatsWss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/ws/futures-24h')) {
      futuresStatsWss.handleUpgrade(req, socket, head, (ws) => {
        futuresStatsWss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/ws/spot-depth')) {
      spotDepthWss.handleUpgrade(req, socket, head, (ws) => {
        spotDepthWss.emit('connection', ws, req)
      })
    } else if (pathname.startsWith('/ws/futures-depth')) {
      futuresDepthWss.handleUpgrade(req, socket, head, (ws) => {
        futuresDepthWss.emit('connection', ws, req)
      })
    } else {
      try { console.warn('[ws] unknown path, destroying socket:', rawUrl) } catch {}
      socket.destroy()
    }
  })
}


