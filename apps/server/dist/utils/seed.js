"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
const AddressGroup_1 = require("../models/AddressGroup");
async function main() {
    const cfg = (0, env_1.getConfig)();
    await mongoose_1.default.connect(cfg.mongoUri);
    const existing = await AddressGroup_1.AddressGroup.countDocuments({});
    if (existing > 0) {
        console.log('Address groups already seeded:', existing);
        await mongoose_1.default.disconnect();
        return;
    }
    const groups = [];
    for (let i = 0; i < 50; i++) {
        groups.push({
            ethAddress: `ETH-DEMO-${i.toString().padStart(3, '0')}`,
            tronAddress: `TRON-DEMO-${i.toString().padStart(3, '0')}`,
            bscAddress: `BSC-DEMO-${i.toString().padStart(3, '0')}`,
            solAddress: `SOL-DEMO-${i.toString().padStart(3, '0')}`,
            xrpAddress: `XRP-DEMO-${i.toString().padStart(3, '0')}`,
        });
    }
    await AddressGroup_1.AddressGroup.insertMany(groups);
    console.log('Seeded address groups:', groups.length);
    await mongoose_1.default.disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map