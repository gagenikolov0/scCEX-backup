"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachMarketWSS = attachMarketWSS;
const ws_1 = require("ws");
function attachMarketWSS(server) {
    const wss = new ws_1.WebSocketServer({ server, path: '/ws/market' });
    wss.on('connection', (ws) => {
        let timer = null;
        let currentSymbol = null;
        const clearTimer = () => { if (timer) {
            clearInterval(timer);
            timer = null;
        } };
        ws.on('message', async (raw) => {
            try {
                const msg = JSON.parse(String(raw));
                if (msg.type === 'sub' && msg.symbol) {
                    currentSymbol = msg.symbol.toUpperCase();
                    clearTimer();
                    const sendTick = async () => {
                        try {
                            const resp = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${currentSymbol}`);
                            if (!resp.ok)
                                return;
                            const j = await resp.json();
                            const price = parseFloat(j.price);
                            if (Number.isFinite(price)) {
                                ws.send(JSON.stringify({ type: 'tick', symbol: currentSymbol, price, t: Date.now() }));
                            }
                        }
                        catch { }
                    };
                    await sendTick();
                    timer = setInterval(sendTick, 1000);
                }
                else if (msg.type === 'unsub') {
                    clearTimer();
                    currentSymbol = null;
                }
            }
            catch { }
        });
        ws.on('close', () => {
            clearTimer();
            currentSymbol = null;
        });
    });
    return wss;
}
//# sourceMappingURL=market.js.map