"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Proxy: Spot tickers (prices for all symbols)
router.get('/spot/tickers', async (_req, res) => {
    try {
        const upstream = await fetch('https://api.mexc.com/api/v3/ticker/price');
        const data = await upstream.json();
        return res.json(data);
    }
    catch (e) {
        return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null });
    }
});
// Proxy: Spot klines
router.get('/spot/klines', async (req, res) => {
    try {
        const { symbol, interval = '1m', limit = '200' } = req.query;
        if (!symbol)
            return res.status(400).json({ error: 'symbol is required' });
        const url = `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`;
        const upstream = await fetch(url);
        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            return res.status(502).json({ error: 'Upstream not ok', status: upstream.status, body: text });
        }
        const data = await upstream.json();
        return res.json(data);
    }
    catch (e) {
        return res.status(502).json({ error: 'Upstream error', detail: e?.message ?? null });
    }
});
exports.default = router;
//# sourceMappingURL=markets.js.map