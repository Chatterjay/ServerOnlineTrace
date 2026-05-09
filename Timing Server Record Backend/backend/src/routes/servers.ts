import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { takePending } from "./commands.js";

const router = Router();

const STALE_MS = 90_000;
const SH_OFFSET = 8 * 60 * 60 * 1000; // 90 秒无心跳视为离线

function computeStatus(lastHeartbeat: Date | null, storedStatus: string): string {
  if (storedStatus === "offline") return "offline";
  if (!lastHeartbeat) return "offline";
  return Date.now() - new Date(lastHeartbeat).getTime() < STALE_MS ? "online" : "offline";
}

// 关闭服务器所有在线 session 并生成 leave 事件
async function closeServerSessions(serverId: string) {
  const openSessions = await prisma.session.findMany({
    where: { serverId, leaveTime: null },
    select: { id: true, playerUuid: true, joinTime: true },
  });
  if (openSessions.length === 0) return;

  const now = new Date();
  for (const s of openSessions) {
    const duration = Math.floor((now.getTime() - s.joinTime.getTime()) / 1000);
    await prisma.session.update({
      where: { id: s.id },
      data: { leaveTime: now, durationSeconds: duration },
    });
  }

  await prisma.event.createMany({
    data: openSessions.map(s => ({
      playerUuid: s.playerUuid,
      serverId,
      type: "leave",
      timestamp: now,
    })),
  });
}

// Mod heartbeat
router.post("/heartbeat", async (req: Request, res: Response) => {
  const { serverId, serverName, address, status, tps, mtps, gameMode, modLoader } = req.body;
  try {
    const server = await prisma.server.upsert({
      where: { id: serverId },
      update: {
        status: status || "online", lastHeartbeat: new Date(), name: serverName, address,
        ...(tps != null ? { tps } : {}),
        ...(mtps != null ? { mtps } : {}),
        ...(gameMode != null ? { gameMode } : {}),
        ...(modLoader != null ? { modLoader } : {}),
      },
      create: {
        id: serverId, name: serverName || "Unknown", address: address || "",
        status: "online", lastHeartbeat: new Date(),
        ...(tps != null ? { tps } : {}),
        ...(mtps != null ? { mtps } : {}),
        ...(gameMode != null ? { gameMode } : {}),
        ...(modLoader != null ? { modLoader } : {}),
      },
    });

    // 服务器离线时，关闭该服务器所有未结束的 session 并生成 leave 事件
    if (status === "offline") {
      await closeServerSessions(serverId);
    }

    const commands = takePending(serverId);
    res.json({ ok: true, server, commands });
  } catch (err) {
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

// Get all servers
router.get("/", async (_req: Request, res: Response) => {
  const servers = await prisma.server.findMany({
    orderBy: { firstSeen: "desc" },
    include: {
      _count: { select: { sessions: true, events: true } },
    },
  });
  const now = Date.now();

  // 批量查询各服务器的独立玩家数
  const ids = servers.map(s => s.id);
  const playerCountMap = new Map<string, number>();
  if (ids.length > 0) {
    const groups = await prisma.session.groupBy({
      by: ["serverId", "playerUuid"],
      where: { serverId: { in: ids } },
    });
    for (const g of groups) {
      playerCountMap.set(g.serverId, (playerCountMap.get(g.serverId) || 0) + 1);
    }
  }

  const result = servers.map(s => {
    const computed = computeStatus(s.lastHeartbeat, s.status);
    // 检测到服务器离线（崩溃、未发离线心跳），关闭残留 session/事件 并更新状态
    if (computed === "offline" && s.status === "online" && s.lastHeartbeat) {
      const elapsed = now - new Date(s.lastHeartbeat).getTime();
      if (elapsed >= STALE_MS) {
        closeServerSessions(s.id).then(() => {
          prisma.server.update({ where: { id: s.id }, data: { status: "offline" } });
        });
      }
    }
    return {
      ...s, status: computed,
      playerCount: playerCountMap.get(s.id) || 0,
    };
  });
  res.json(result);
});

// Get server detail
router.get("/:id", async (req: Request, res: Response) => {
  const server = await prisma.server.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { sessions: true, events: true } },
    },
  });
  if (!server) { res.status(404).json({ error: "Server not found" }); return; }
  res.json({ ...server, status: computeStatus(server.lastHeartbeat, server.status) });
});

// Update server note
router.put("/:id/note", async (req: Request, res: Response) => {
  const { note } = req.body;
  if (typeof note !== "string") { res.status(400).json({ error: "note must be a string" }); return; }
  const server = await prisma.server.update({
    where: { id: req.params.id },
    data: { note },
  });
  res.json(server);
});

// ── Server Stats ──

// Daily play time (last N days)
router.get("/:id/stats/daily", async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
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

// Hourly distribution (last 30 days)
router.get("/:id/stats/hourly", async (req: Request, res: Response) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
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
router.get("/:id/stats/weekday", async (req: Request, res: Response) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
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

// Top players by play time on this server
router.get("/:id/stats/players", async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const groups = await prisma.session.groupBy({
    by: ["playerUuid"],
    where: { serverId: req.params.id, joinTime: { gte: cutoff }, durationSeconds: { not: null } },
    _sum: { durationSeconds: true },
    _count: true,
  });
  const uuids = groups.map(g => g.playerUuid);
  const players = uuids.length > 0 ? await prisma.player.findMany({
    where: { uuid: { in: uuids } },
    select: { uuid: true, name: true },
  }) : [];
  const nameMap = new Map(players.map(p => [p.uuid, p.name]));
  const rows = groups.map(g => ({
    playerUuid: g.playerUuid,
    playerName: nameMap.get(g.playerUuid) || "Unknown",
    totalSeconds: Number(g._sum.durationSeconds || 0),
    sessionCount: g._count,
  })).sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, limit);
  res.json(rows);
});

export default router;
