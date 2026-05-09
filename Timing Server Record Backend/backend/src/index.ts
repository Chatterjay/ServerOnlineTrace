import express from "express";
import cors from "cors";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "./prisma.js";
import serversRouter from "./routes/servers.js";
import playersRouter from "./routes/players.js";
import eventsRouter from "./routes/events.js";
import commandsRouter from "./routes/commands.js";
import chatRouter from "./routes/chat.js";

const app = express();
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "27890");
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || "27891");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/servers", serversRouter);
app.use("/api/players", playersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/servers", commandsRouter);
app.use("/api/servers", chatRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── HTTP server (backward compat, also redirects to HTTPS) ──
app.listen(HTTP_PORT, () => {
  console.log(`Backend (HTTP) running at http://localhost:${HTTP_PORT}`);
});

// ── HTTPS server ──
const sslPath = path.join(__dirname, "..", "ssl");
if (fs.existsSync(path.join(sslPath, "key.pem")) && fs.existsSync(path.join(sslPath, "cert.pem"))) {
  const key = fs.readFileSync(path.join(sslPath, "key.pem"));
  const cert = fs.readFileSync(path.join(sslPath, "cert.pem"));
  https.createServer({ key, cert }, app).listen(HTTPS_PORT, () => {
    console.log(`Backend (HTTPS) running at https://localhost:${HTTPS_PORT}`);
  });
} else {
  console.log("SSL cert not found, HTTPS not available");
}

// ── 定期清理旧数据 ──
const RETENTION_DAYS = 30;
async function cleanupOldData() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const deletedEvents = await prisma.event.deleteMany({ where: { timestamp: { lt: cutoff } } });
    const deletedSessions = await prisma.session.deleteMany({ where: { joinTime: { lt: cutoff }, leaveTime: { not: null } } });
    if (deletedEvents.count > 0 || deletedSessions.count > 0) {
      console.log(`Cleanup: removed ${deletedEvents.count} events, ${deletedSessions.count} sessions (older than ${RETENTION_DAYS} days)`);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}
cleanupOldData();
setInterval(cleanupOldData, 60 * 60 * 1000); // 每小时执行一次
