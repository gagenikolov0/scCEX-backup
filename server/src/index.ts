import "express-async-errors";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { getConfig } from "./config/env";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import marketsRoutes from "./routes/markets";

const app = express();
const httpServer = http.createServer(app);

const config = getConfig();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/markets", marketsRoutes);

const start = async () => {
  await mongoose.connect(config.mongoUri);
  const { attachMarketWSS } = await import('./ws')
  attachMarketWSS(httpServer)
  httpServer.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});


