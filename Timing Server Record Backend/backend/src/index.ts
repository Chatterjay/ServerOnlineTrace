import express from "express";
import cors from "cors";
import serversRouter from "./routes/servers.js";
import playersRouter from "./routes/players.js";
import eventsRouter from "./routes/events.js";

const app = express();
const PORT = parseInt(process.env.PORT || "4560");

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/servers", serversRouter);
app.use("/api/players", playersRouter);
app.use("/api/events", eventsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
