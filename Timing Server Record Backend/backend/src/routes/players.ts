import { Router, Request, Response } from "express";
import prisma from "../prisma.js";

const router = Router();

const SH_OFFSET = 8 * 60 * 60 * 1000;

// Get player count
router.get("/count", async (_req: Request, res: Response) => {
  const count = await prisma.player.count();
  res.json({ count });
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
    include: { server: { select: { name: true } } },
  });

  const totalPlayTimeResult = await prisma.session.aggregate({
    where: { playerUuid: req.params.uuid },
    _sum: { durationSeconds: true },
  });
  const totalPlayTime = totalPlayTimeResult._sum.durationSeconds || 0;

  const deathCount = await prisma.event.count({
    where: { playerUuid: req.params.uuid, type: "death" },
  });

  res.json({
    ...player,
    recentSessions,
    stats: { totalPlayTime, deaths: deathCount },
  });
});

// Daily play time (last N days)
router.get("/:uuid/stats/daily", async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
    select: { joinTime: true, durationSeconds: true },
  });
  const dailyMap = new Map<string, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const key = `${sh.getUTCFullYear()}-${String(sh.getUTCMonth() + 1).padStart(2, "0")}-${String(sh.getUTCDate()).padStart(2, "0")}`;
    const e = dailyMap.get(key) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += s.durationSeconds!;
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
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
    select: { joinTime: true, durationSeconds: true },
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
    e.totalSeconds += s.durationSeconds!;
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
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
    select: { joinTime: true, durationSeconds: true },
  });
  const hourlyMap = new Map<number, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const hour = sh.getUTCHours();
    const e = hourlyMap.get(hour) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += s.durationSeconds!;
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
    where: { playerUuid: req.params.uuid, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
    select: { joinTime: true, durationSeconds: true },
  });
  const weekdayMap = new Map<number, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    const sh = new Date(s.joinTime.getTime() + SH_OFFSET);
    const day = sh.getUTCDay();
    const e = weekdayMap.get(day) || { totalSeconds: 0, sessionCount: 0 };
    e.totalSeconds += s.durationSeconds!;
    e.sessionCount++;
    weekdayMap.set(day, e);
  }
  const rows = [...weekdayMap.entries()].sort(([a], [b]) => a - b)
    .map(([day, v]) => ({ day, totalSeconds: v.totalSeconds, sessionCount: v.sessionCount }));
  res.json(rows);
});

export default router;
