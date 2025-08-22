"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const AddressGroup_1 = require("../models/AddressGroup");
const router = (0, express_1.Router)();
router.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await User_1.User.findById(req.user.id).lean();
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const group = user.addressGroupId ? await AddressGroup_1.AddressGroup.findById(user.addressGroupId).lean() : null;
    return res.json({
        id: String(user._id),
        email: user.email,
        balances: user.balances,
        addressGroup: group ? {
            ethAddress: group.ethAddress ?? null,
            tronAddress: group.tronAddress ?? null,
            bscAddress: group.bscAddress ?? null,
            solAddress: group.solAddress ?? null,
            xrpAddress: group.xrpAddress ?? null,
        } : null,
    });
});
router.get("/address-group", auth_1.requireAuth, async (req, res) => {
    const user = await User_1.User.findById(req.user.id).lean();
    if (!user)
        return res.status(404).json({ error: "User not found" });
    if (!user.addressGroupId)
        return res.status(404).json({ error: "No address group assigned" });
    const group = await AddressGroup_1.AddressGroup.findById(user.addressGroupId).lean();
    if (!group)
        return res.status(404).json({ error: "Group not found" });
    return res.json({
        ethAddress: group.ethAddress ?? null,
        tronAddress: group.tronAddress ?? null,
        bscAddress: group.bscAddress ?? null,
        solAddress: group.solAddress ?? null,
        xrpAddress: group.xrpAddress ?? null,
    });
});
exports.default = router;
//# sourceMappingURL=user.js.map