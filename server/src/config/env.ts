import dotenv from "dotenv"

dotenv.config()

export interface AppConfig {
  nodeEnv: "development" | "production" | "test" | string
  port: number
  mongoUri: string
  jwtAccessSecret: string
  jwtRefreshSecret: string
  corsOrigin: string
}

export const getConfig = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV!
  const port = Number(process.env.PORT!)
  const mongoUri = process.env.MONGODB_URI!
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET!
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!
  const corsOrigin = process.env.CORS_ORIGIN!

  return {
    nodeEnv,
    port,
    mongoUri,
    jwtAccessSecret,
    jwtRefreshSecret,
    corsOrigin,
  }
}


