import { Router, type Request, type Response } from 'express'

const router = Router()

// Simple in-memory cache with TTL to protect upstream
type CacheEntry = { expires: number; data: any }
const cache = new Map<string, CacheEntry>()
async function fromCache(key: string, ttlMs: number, fetcher: () => Promise<any>) {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expires > now) return hit.data
  const data = await fetcher()
  cache.set(key, { expires: now + ttlMs, data })
  return data
}

// Proxy: Spot tickers (prices for all symbols)
router.get('/spot/tickers', async (_req: Request, res: Response) => {
  try {
    const data = await fromCache('spot:ticker:all', 1000, async () => {
      const upstream = await fetch('https://api.mexc.com/api/v3/ticker/price')
      return upstream.json()
    })
    return res.json(data)
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

// Proxy: Spot klines
router.get('/spot/klines', async (req: Request, res: Response) => {
  try {
    const { symbol, interval = '1m', limit = '200' } = req.query as Record<string, string>
    if (!symbol) return res.status(400).json({ error: 'symbol is required' })
    const key = `spot:klines:${symbol}:${interval}:${limit}`
    const ttl = interval === '1m' ? 2000 : interval === '5m' ? 10_000 : interval === '1h' ? 60_000 : 300_000
    const data = await fromCache(key, ttl, async () => {
      const candidates: string[] = [interval]
      if (interval === '1h') candidates.push('60m')
      if (interval === '2h') candidates.push('120m')
      if (interval === '4h') candidates.push('240m')
      if (interval === '6h') candidates.push('360m')
      if (interval === '1w') candidates.push('7d')
      if (interval === '2d') candidates.push('2880m')
      let lastErr: any = null
      for (const iv of candidates) {
        try {
          const url = `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(iv)}&limit=${encodeURIComponent(limit)}`
          const upstream = await fetch(url)
          if (upstream.ok) return upstream.json()
          lastErr = await upstream.text().catch(() => '')
        } catch (e) { lastErr = e }
      }
      // If upstream failed for this symbol/interval, return empty set rather than error to avoid UI spam
      return []
    })
    return res.json(data)
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

// Spot: available intervals for a symbol
router.get('/spot/intervals', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.query.symbol || '')
    if (!symbol) return res.status(400).json({ error: 'symbol is required' })
    const key = `spot:intv:${symbol}`
    const data = await fromCache(key, 5 * 60 * 1000, async () => {
      const candidates = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '1d', '2d', '1w'];

      const checkResults = await Promise.all(candidates.map(async (iv) => {
        const tries = iv === '1h' ? ['1h', '60m']
          : iv === '2h' ? ['2h', '120m']
            : iv === '4h' ? ['4h', '240m']
              : iv === '6h' ? ['6h', '360m']
                : iv === '2d' ? ['2d', '2880m']
                  : iv === '1w' ? ['1w', '10080m']
                    : [iv];

        for (const t of tries) {
          try {
            const url = `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(t)}&limit=1`;
            const r = await fetch(url);
            if (r.ok) return iv;
          } catch { }
        }
        return null;
      }));

      return checkResults.filter((res): res is string => res !== null);
    })
    return res.json({ symbol, intervals: data })
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

// Spot: 24h ticker stats for a symbol
router.get('/spot/24h', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.query.symbol || '')
    if (!symbol) return res.status(400).json({ error: 'symbol is required' })
    const key = `spot:24h:${symbol}`
    const data = await fromCache(key, 2000, async () => {
      const url = `https://api.mexc.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
      const upstream = await fetch(url)
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '')
        throw new Error(JSON.stringify({ status: upstream.status, body: text }))
      }
      return upstream.json()
    })
    return res.json(data)
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

export default router

// Futures: tickers (all contracts)
router.get('/futures/tickers', async (_req: Request, res: Response) => {
  try {
    const data = await fromCache('futures:ticker:all', 1000, async () => {
      const upstream = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '')
        throw new Error(JSON.stringify({ status: upstream.status, body: text }))
      }
      return upstream.json()
    })
    return res.json(data)
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

// Futures: klines
router.get('/futures/klines', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.query.symbol || '')
    const interval = String(req.query.interval || '1m')
    const limit = String(req.query.limit || '200')
    if (!symbol) return res.status(400).json({ error: 'symbol is required' })
    // Map spot-style intervals to futures API intervals
    const map: Record<string, string> = {
      '1m': 'Min1', '5m': 'Min5', '15m': 'Min15', '30m': 'Min30',
      '1h': 'H1', '2h': 'H2', '4h': 'H4', '6h': 'H6',
      '1d': 'D1', '2d': 'D2', '1w': 'W1'
    }
    const iv = map[interval] ?? 'Min1'
    // Ensure futures symbol uses underscore format, e.g., BTC_USDT
    const sym = symbol.includes('_') ? symbol : symbol.replace(/(USDT|USDC)$/i, '_$1')
    const makeUrls = () => [
      `https://contract.mexc.com/api/v1/contract/kline?symbol=${encodeURIComponent(sym)}&type=${encodeURIComponent(iv)}&page_size=${encodeURIComponent(limit)}`,
      `https://contract.mexc.com/api/v1/contract/kline?symbol=${encodeURIComponent(sym)}&type=${encodeURIComponent(iv)}&limit=${encodeURIComponent(limit)}`,
      // fallback to numeric minute type if needed
      `https://contract.mexc.com/api/v1/contract/kline?symbol=${encodeURIComponent(sym)}&type=${encodeURIComponent(interval)}&page_size=${encodeURIComponent(limit)}`,
    ]
    const key = `futures:klines:${sym}:${iv}:${limit}`
    const ttl = interval === '1m' ? 2000 : interval === '5m' ? 10_000 : interval === '1h' ? 60_000 : 300_000
    const data = await fromCache(key, ttl, async () => {
      const urls = makeUrls()
      let lastErr: any = null
      for (const u of urls) {
        try {
          const upstream = await fetch(u)
          if (upstream.ok) {
            return upstream.json()
          } else {
            lastErr = await upstream.text().catch(() => '')
          }
        } catch (e) { lastErr = e }
      }
      throw new Error(typeof lastErr === 'string' ? lastErr : 'Upstream not ok')
    })
    return res.json(data)
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

// Futures: available intervals for a symbol (fallback to spot if futures unavailable)
router.get('/futures/intervals', async (req: Request, res: Response) => {
  try {
    let symbol = String(req.query.symbol || '')
    if (!symbol) return res.status(400).json({ error: 'symbol is required' })
    const sym = symbol.includes('_') ? symbol : symbol.replace(/(USDT|USDC)$/i, '_$1')
    const key = `futures:intv:${sym}`
    const data = await fromCache(key, 5 * 60 * 1000, async () => {
      const candidates = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '1d', '2d', '1w'];
      const map: Record<string, string> = {
        '1m': 'Min1', '5m': 'Min5', '15m': 'Min15', '30m': 'Min30',
        '1h': 'H1', '2h': 'H2', '4h': 'H4', '6h': 'H6',
        '1d': 'D1', '2d': 'D2', '1w': 'W1'
      };

      const checkResults = await Promise.all(candidates.map(async (iv) => {
        const type = map[iv] ?? 'Min1';
        try {
          const url = `https://contract.mexc.com/api/v1/contract/kline?symbol=${encodeURIComponent(sym)}&type=${encodeURIComponent(type)}&page_size=1`;
          const r = await fetch(url);
          if (r.ok) return iv;
        } catch { }
        return null;
      }));

      let results = checkResults.filter((res): res is string => res !== null);

      // Fallback to spot availability if none detected
      if (results.length === 0) {
        const spotSym = sym.replace('_', '');
        const spotUrl = `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(spotSym)}&interval=1m&limit=1`;
        try {
          const r = await fetch(spotUrl);
          if (r.ok) return ['1m', '5m'];
        } catch { }
      }
      return results;
    })
    return res.json({ symbol: sym, intervals: data })
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})

// Futures: 24h ticker stats for a symbol
router.get('/futures/24h', async (req: Request, res: Response) => {
  try {
    let symbol = String(req.query.symbol || '')
    if (!symbol) return res.status(400).json({ error: 'symbol is required' })
    const sym = symbol.includes('_') ? symbol : symbol.replace(/(USDT|USDC)$/i, '_$1')
    const key = `futures:24h:${sym}`
    const data = await fromCache(key, 2000, async () => {
      // contract ticker list returns 24h fields per symbol; fetch all and pick one (MEXC lacks single-symbol 24h endpoint for futures)
      const upstream = await fetch('https://contract.mexc.com/api/v1/contract/ticker')
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '')
        throw new Error(JSON.stringify({ status: upstream.status, body: text }))
      }
      const j = await upstream.json()
      const arr = Array.isArray(j?.data) ? j.data : []
      const row = arr.find((r: any) => r?.symbol === sym) || null
      return row || {}
    })
    return res.json(data)
  } catch (e: any) {
    return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null })
  }
})


