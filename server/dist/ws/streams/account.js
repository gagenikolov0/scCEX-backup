"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
exports.emitAccountEvent = emitAccountEvent;
const ws_1 = require("ws");
const jwt_1 = require("../../utils/jwt");
const portfolio_1 = require("../../utils/portfolio");
exports.stream = {
    paths: ['/ws/account'],
    wss: new ws_1.WebSocketServer({ noServer: true })
};
// userId -> sockets
const userSockets = new Map();
function addSocket(userId, ws) {
    let set = userSockets.get(userId);
    if (!set) {
        set = new Set();
        userSockets.set(userId, set);
    }
    set.add(ws);
}
function removeSocket(ws) {
    for (const [uid, set] of userSockets) {
        if (set.delete(ws) && set.size === 0) {
            userSockets.delete(uid);
            stopBroadcastingIfNoUsers();
        }
    }
}
let broadcastTimer = null;
function stopBroadcastingIfNoUsers() {
    if (userSockets.size === 0 && broadcastTimer) {
        clearInterval(broadcastTimer);
        broadcastTimer = null;
    }
}
async function broadcastPortfolioUpdates() {
    for (const userId of userSockets.keys()) {
        try {
            const totalUSD = await (0, portfolio_1.calculateTotalPortfolioUSD)(userId);
            emitAccountEvent(userId, { kind: 'portfolio', totalPortfolioUSD: totalUSD });
        }
        catch {
            // Quiet fail for one user
        }
    }
}
function emitAccountEvent(userId, event) {
    const sockets = userSockets.get(userId); // all sockets for this user
    if (!sockets)
        return;
    const payload = JSON.stringify({
        type: 'account', // tells THE CLIENT what kind of data it is
        ...event, // e.g. {kind:'balance', spotAvailable:{USDT:'10'}}
        t: Date.now() // timestamp
    });
    for (const ws of sockets) { // the loop, loops WS messages
        try {
            ws.send(payload);
        }
        catch { } // <-- actual WS send
    }
}
function extractToken(req) {
    // Try to get token from query parameters first
    const raw = req.url || '';
    try {
        const u = new URL(raw, `http://${req.headers.host || 'localhost'}`);
        const q = u.searchParams.get('token');
        if (q)
            return q;
    }
    catch { }
    // Fallback to authorization header
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer '))
        return auth.slice(7);
    // Try to get from sec-websocket-protocol header (alternative approach)
    const protocol = req.headers['sec-websocket-protocol'];
    if (typeof protocol === 'string') {
        const parts = protocol.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.startsWith('token=')) {
                return trimmed.slice(6); // Remove 'token=' prefix
            }
        }
    }
    return null;
}
exports.stream.wss.on('connection', (ws, req) => {
    try {
        const tok = extractToken(req);
        console.log(`[WS Account] Connection attempt. Token present: ${!!tok}`);
        if (!tok) {
            console.warn(`[WS Account] No token found in request`);
            try {
                ws.close();
            }
            catch { }
            ;
            return;
        }
        try {
            const payload = (0, jwt_1.verifyAccessToken)(tok);
            const userId = String(payload.sub);
            console.log(`[WS Account] Authorized: ${userId}`);
            addSocket(userId, ws);
            // Start broadcasting if this is the first user
            if (!broadcastTimer) {
                broadcastTimer = setInterval(broadcastPortfolioUpdates, 2000);
            }
            ws.on('message', (_raw) => { });
            ws.on('close', () => {
                console.log(`[WS Account] Closed for user: ${userId}`);
                removeSocket(ws);
            });
        }
        catch (jwtErr) {
            console.error(`[WS Account] Token verification failed:`, jwtErr.message);
            try {
                ws.close();
            }
            catch { }
        }
    }
    catch (error) {
        console.error(`[WS Account] Connection error:`, error.message);
        try {
            ws.close();
        }
        catch { }
    }
});
//# sourceMappingURL=account.js.map