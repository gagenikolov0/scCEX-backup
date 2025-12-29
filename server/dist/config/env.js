"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getConfig = () => {
    const nodeEnv = process.env.NODE_ENV;
    const port = Number(process.env.PORT);
    const mongoUri = process.env.MONGODB_URI;
    const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const corsOrigin = process.env.CORS_ORIGIN;
    return {
        nodeEnv,
        port,
        mongoUri,
        jwtAccessSecret,
        jwtRefreshSecret,
        corsOrigin,
    };
};
exports.getConfig = getConfig;
//# sourceMappingURL=env.js.map