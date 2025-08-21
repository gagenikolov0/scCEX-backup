"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
const DepositAddress_1 = require("../models/DepositAddress");
async function main() {
    const cfg = (0, env_1.getConfig)();
    await mongoose_1.default.connect(cfg.mongoUri);
    const existing = await DepositAddress_1.DepositAddress.countDocuments({});
    if (existing > 0) {
        console.log('Keys already seeded:', existing);
        await mongoose_1.default.disconnect();
        return;
    }
    const demo = [];
    for (let i = 0; i < 50; i++) {
        demo.push({ address: `USDT-DEMO-${i.toString().padStart(3, '0')}`, asset: 'USDT', chain: 'TRON' });
        demo.push({ address: `USDC-DEMO-${i.toString().padStart(3, '0')}`, asset: 'USDC', chain: 'ETH' });
    }
    await DepositAddress_1.DepositAddress.insertMany(demo);
    console.log('Seeded deposit addresses:', demo.length);
    await mongoose_1.default.disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map