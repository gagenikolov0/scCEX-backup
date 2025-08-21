"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const DepositAddress_1 = require("../models/DepositAddress");
const router = (0, express_1.Router)();
router.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await User_1.User.findById(req.user.id).lean();
    if (!user)
        return res.status(404).json({ error: "User not found" });
    let key = null;
    if (user.depositAddressId) {
        const k = await DepositAddress_1.DepositAddress.findById(user.depositAddressId).lean();
        if (k)
            key = { address: k.address, asset: k.asset, chain: k.chain };
    }
    return res.json({
        id: String(user._id),
        email: user.email,
        balances: user.balances,
        key,
    });
});
router.get("/deposit-address", auth_1.requireAuth, async (req, res) => {
    const user = await User_1.User.findById(req.user.id).lean();
    if (!user)
        return res.status(404).json({ error: "User not found" });
    if (!user.depositAddressId)
        return res.status(404).json({ error: "No deposit address assigned" });
    const k = await DepositAddress_1.DepositAddress.findById(user.depositAddressId).lean();
    if (!k)
        return res.status(404).json({ error: "Key not found" });
    return res.json({ address: k.address, asset: k.asset, chain: k.chain });
});
exports.default = router;
//# sourceMappingURL=user.js.map