"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signAccessToken = (payload) => {
    const { jwtAccessSecret } = (0, env_1.getConfig)();
    return jsonwebtoken_1.default.sign(payload, jwtAccessSecret, { expiresIn: "15m" });
};
exports.signAccessToken = signAccessToken;
const signRefreshToken = (payload) => {
    const { jwtRefreshSecret } = (0, env_1.getConfig)();
    return jsonwebtoken_1.default.sign(payload, jwtRefreshSecret, { expiresIn: "7d" });
};
exports.signRefreshToken = signRefreshToken;
const verifyAccessToken = (token) => {
    const { jwtAccessSecret } = (0, env_1.getConfig)();
    return jsonwebtoken_1.default.verify(token, jwtAccessSecret);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    const { jwtRefreshSecret } = (0, env_1.getConfig)();
    return jsonwebtoken_1.default.verify(token, jwtRefreshSecret);
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwt.js.map