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

const app = express()
const httpServer = http.createServer(app)
const config = getConfig()

app.use(express.json())

app.use(helmet())
app.use(cookieParser())
app.use(rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false, }))
app.use(cors({ origin: config.corsOrigin, credentials: true, }))

app.get("/health", (_req, res) => res.json({ ok: true }))

app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/markets", marketsRoutes)
app.use("/api/spot", spotRoutes)

const start = async () => {
  await mongoose.connect(config.mongoUri)

  const { attachMarketWSS } = await import('./ws') //❓What exactly is happening here?
  attachMarketWSS(httpServer) //❓ What exactly is happening here?
  httpServer.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})


