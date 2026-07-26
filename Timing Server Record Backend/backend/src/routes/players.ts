import { Router, Request, Response } from "express";
import prisma from "../prisma.js";

const router = Router();

const SH_OFFSET = 8 * 60 * 60 * 1000;

function sessionSeconds(session: { joinTime: Date; leaveTime?: Date | null; durationSeconds?: number | null }, now = new Date()) {
  if (session.durationSeconds != null) return session.durationSeconds;
  if (!session.leaveTime) return Math.max(0, Math.floor((now.getTime() - session.joinTime.getTime()) / 1000));
  return Math.max(0, Math.floor((session.leaveTime.getTime() - session.joinTime.getTime()) / 1000));
}

// Get player count
router.get("/count", async (_req: Request, res: Response) => {
  const count = await prisma.player.count();
  res.json({ count });
});

// Get player profiles for dashboard drill-down
router.get("/", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const players = await prisma.player.findMany({
    orderBy: { lastSeen: "desc" },
    take: limit,
    include: {
      _count: { select: { sessions: true, events: true } },
      snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
      sessions: {
        orderBy: { joinTime: "desc" },
        take: 1,
        include: { server: { select: { id: true, name: true } } },
      },
    },
  });
  const rows = players.map(player => ({
    uuid: player.uuid,
    name: player.name,
    firstSeen: player.firstSeen,
    lastSeen: player.lastSeen,
    sessionCount: player._count.sessions,
    eventCount: player._count.events,
    latestSnapshot: player.snapshots[0] ?? null,
    latestSession: player.sessions[0] ?? null,
  }));
  res.json(rows);
});

// Get recent sessions for dashboard drill-down
router.get("/sessions/recent", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const sessions = await prisma.session.findMany({
    orderBy: { joinTime: "desc" },
    take: limit,
    include: {
      player: { select: { uuid: true, name: true } },
      server: { select: { id: true, name: true, note: true } },
    },
  });
  res.json(sessions.map(session => ({
    ...session,
    computedSeconds: sessionSeconds(session),
  })));
});

// Get player detail/profile
router.get("/:uuid", async (req: Request, res: Response) => {
  const player = await prisma.player.findUnique({
    where: { uuid: req.params.uuid },
    include: {
      _count: { select: { sessions: true, events: true } },
    },
  });
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const recentSessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid },
    orderBy: { joinTime: "desc" },
    take: 100,
    include: { server: { select: { id: true, name: true, note: true } } },
  });

  const allSessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid },
    select: { joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const totalPlayTime = allSessions.reduce((sum, session) => sum + sessionSeconds(session), 0);

  const deathCount = await prisma.event.count({
    where: { playerUuid: req.params.uuid, type: "death" },
  });
  const latestSnapshot = await prisma.playerSnapshot.findFirst({
    where: { playerUuid: req.params.uuid },
    orderBy: { timestamp: "desc" },
  });

  res.json({
    ...player,
    recentSessions,
    latestSnapshot,
    stats: { totalPlayTime, deaths: deathCount },
  });
});

// Daily play time (last N days)
router.get("/:uuid/stats/daily", async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff } },
    select: { joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const dailyMap = new Map<string, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const key = `${sh.getUTCFullYear()}-${String(sh.getUTCMonth() + 1).padStart(2, "0")}-${String(sh.getUTCDate()).padStart(2, "0")}`;
    const e = dailyMap.get(key) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += sessionSeconds(s);
    e.sessionCount++;
    dailyMap.set(key, e);
  }
  const rows = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, totalSeconds: v.totalSeconds, sessionCount: v.sessionCount }));
  res.json(rows);
});

// Weekly play time (last N weeks)
router.get("/:uuid/stats/weekly", async (req: Request, res: Response) => {
  const weeks = parseInt(req.query.weeks as string) || 12;
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff } },
    select: { joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const weekMap = new Map<string, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const day = sh.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(sh);
    monday.setUTCDate(monday.getUTCDate() + diff);
    const key = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
    const e = weekMap.get(key) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += sessionSeconds(s);
    e.sessionCount++;
    weekMap.set(key, e);
  }
  const rows = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, totalSeconds: v.totalSeconds, sessionCount: v.sessionCount }));
  res.json(rows);
});

// Hourly heatmap data (last 30 days)
router.get("/:uuid/stats/hourly", async (req: Request, res: Response) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff } },
    select: { joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const hourlyMap = new Map<number, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const hour = sh.getUTCHours();
    const e = hourlyMap.get(hour) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += sessionSeconds(s);
    e.sessionCount++;
    hourlyMap.set(hour, e);
  }
  const rows = [...hourlyMap.entries()].sort(([a], [b]) => a - b)
    .map(([hour, v]) => ({ hour, totalSeconds: v.totalSeconds, sessionCount: v.sessionCount }));
  res.json(rows);
});

// Weekday distribution (last 30 days)
router.get("/:uuid/stats/weekday", async (req: Request, res: Response) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff } },
    select: { joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const weekdayMap = new Map<number, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const day = sh.getUTCDay();
    const e = weekdayMap.get(day) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += sessionSeconds(s);
    e.sessionCount++;
    weekdayMap.set(day, e);
  }
  const rows = [...weekdayMap.entries()].sort(([a], [b]) => a - b)
    .map(([day, v]) => ({ day, totalSeconds: v.totalSeconds, sessionCount: v.sessionCount }));
  res.json(rows);
});

export default router;
