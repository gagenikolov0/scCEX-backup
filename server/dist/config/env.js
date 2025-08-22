"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getConfig = () => {
    const nodeEnv = process.env.NODE_ENV ?? "development";
    const port = Number(process.env.PORT ?? 4000);
    const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/exchange";
    const jwtAccessSecret = process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me";
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret_change_me";
    const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
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