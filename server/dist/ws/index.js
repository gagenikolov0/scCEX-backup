"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachMarketWSS = attachMarketWSS;
// Streams
const spotTicks_1 = require("./streams/spotTicks");
const futuresTicks_1 = require("./streams/futuresTicks");
const spotStats_1 = require("./streams/spotStats");
const futuresStats_1 = require("./streams/futuresStats");
const spotDepth_1 = require("./streams/spotDepth");
const futuresDepth_1 = require("./streams/futuresDepth");
const account_1 = require("./streams/account");
const streams = [
    spotTicks_1.stream, futuresTicks_1.stream,
    spotStats_1.stream, futuresStats_1.stream, spotDepth_1.stream, futuresDepth_1.stream, account_1.stream,
];
function attachMarketWSS(server) {
    server.on('upgrade', (req, socket, head) => {
        const rawUrl = req.url || '';
        console.log(`[WS] Upgrade request: ${rawUrl}`);
        let pathname = rawUrl;
        try {
            const u = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
            pathname = u.pathname;
        }
        catch (e) {
            console.error(`[WS] URL parse error:`, e);
        }
        console.log(`[WS] Pathname: ${pathname}`);
        for (const s of streams) {
            if (s.paths.some(p => pathname === p)) {
                console.log(`[WS] Found matching stream for ${pathname}`);
                s.wss.handleUpgrade(req, socket, head, (ws) => {
                    console.log(`[WS] Handshake successful for ${pathname}`);
                    s.wss.emit('connection', ws, req);
                });
                return;
            }
        }
        console.warn(`[WS] No matching stream for ${pathname}`);
        socket.destroy();
    });
}
//# sourceMappingURL=index.js.map