import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  nodeEnv: "development" | "production" | "test" | string;
  port: number;
  mongoUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsOrigin: string;
  // no flags for WS; we keep server simple and predictable
  // add toggles only when absolutely necessary
  // useUpstreamWS removed for simplicity
}

export const getConfig = (): AppConfig => {
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


