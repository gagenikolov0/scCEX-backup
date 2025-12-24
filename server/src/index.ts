import "express-async-errors"
import express from "express"
import http from "http"
import { getConfig } from "./config/env"
import mongoose from "mongoose"

import helmet from "helmet"
import cors from "cors"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"

import authRoutes from "./routes/auth"
import userRoutes from "./routes/user"
import marketsRoutes from "./routes/markets"
import spotRoutes from "./routes/spot"
import futuresRoutes from "./routes/futures"

const app = express()
const httpServer = http.createServer(app)
const config = getConfig()

app.use(express.json())

app.use(helmet())
app.use(cookieParser())
app.use(rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false, }))
// CORS configuration
const allowedOrigins = config.corsOrigin.split(',').map(origin => origin.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list or if wildcard is enabled
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') ||
      process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Reject requests from other origins
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}))

app.get("/health", (_req, res) => res.json({ ok: true }))

app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/markets", marketsRoutes)
app.use("/api/spot", spotRoutes)
app.use("/api/futures", futuresRoutes)

const start = async () => {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(config.mongoUri)
  console.log('Connected to MongoDB.')

  console.log('Attaching WebSocket streams...')
  const { attachMarketWSS } = await import('./ws')
  attachMarketWSS(httpServer)

  const { futuresEngine } = await import('./utils/futuresEngine')
  console.log('Starting Futures Engine...')
  futuresEngine.start()

  httpServer.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})


