import { Router, Request, Response } from "express";
import prisma from "../prisma.js";

const router = Router();

const STALE_MS = 90_000; // 90 秒无心跳视为离线

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
  const durationSeconds = 0;

  await prisma.session.updateMany({
    where: { id: { in: openSessions.map(s => s.id) } },
    data: { leaveTime: now, durationSeconds },
  });

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
  const { serverId, serverName, address, status, tps, mtps } = req.body;
  try {
    const server = await prisma.server.upsert({
      where: { id: serverId },
      update: {
        status: status || "online", lastHeartbeat: new Date(), name: serverName, address,
        ...(tps != null ? { tps } : {}),
        ...(mtps != null ? { mtps } : {}),
      },
      create: {
        id: serverId, name: serverName || "Unknown", address: address || "",
        status: "online", lastHeartbeat: new Date(),
        ...(tps != null ? { tps } : {}),
        ...(mtps != null ? { mtps } : {}),
      },
    });

    // 服务器离线时，关闭该服务器所有未结束的 session 并生成 leave 事件
    if (status === "offline") {
      await closeServerSessions(serverId);
    }

    res.json({ ok: true, server });
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
  const playerCounts = ids.length > 0 ? await prisma.$queryRawUnsafe<
    { serverId: string; count: bigint }[]
  >(
    `SELECT "serverId", COUNT(DISTINCT "playerUuid") as count
     FROM "Session"
     WHERE "serverId" = ANY($1)
     GROUP BY "serverId"`,
    ids
  ) : [];
  const playerCountMap = new Map(playerCounts.map(r => [r.serverId, Number(r.count)]));

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
  const rows = await prisma.$queryRawUnsafe<{ date: string; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT DATE("joinTime" AT TIME ZONE 'Asia/Shanghai')::text as date,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "serverId" = $1
       AND "joinTime" >= NOW() - INTERVAL '${days} days'
       AND "durationSeconds" IS NOT NULL
     GROUP BY DATE("joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY date`,
    req.params.id
  );
  res.json(rows.map(r => ({ date: r.date, totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

// Hourly distribution (last 30 days)
router.get("/:id/stats/hourly", async (req: Request, res: Response) => {
  const rows = await prisma.$queryRawUnsafe<{ hour: number; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT EXTRACT(HOUR FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')::int as hour,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "serverId" = $1
       AND "joinTime" >= NOW() - INTERVAL '30 days'
       AND "durationSeconds" IS NOT NULL
     GROUP BY EXTRACT(HOUR FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY hour`,
    req.params.id
  );
  res.json(rows.map(r => ({ hour: Number(r.hour), totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

// Weekday distribution (last 30 days)
router.get("/:id/stats/weekday", async (req: Request, res: Response) => {
  const rows = await prisma.$queryRawUnsafe<{ day: number; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT EXTRACT(DOW FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')::int as day,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "serverId" = $1
       AND "joinTime" >= NOW() - INTERVAL '30 days'
       AND "durationSeconds" IS NOT NULL
     GROUP BY EXTRACT(DOW FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY day`,
    req.params.id
  );
  res.json(rows.map(r => ({ day: Number(r.day), totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

// Top players by play time on this server
router.get("/:id/stats/players", async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const days = parseInt(req.query.days as string) || 30;
  const rows = await prisma.$queryRawUnsafe<
    { playerUuid: string; playerName: string; totalSeconds: bigint; sessionCount: bigint }[]
  >(
    `SELECT s."playerUuid" as "playerUuid",
            p."name" as "playerName",
            COALESCE(SUM(s."durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session" s
     JOIN "Player" p ON p."uuid" = s."playerUuid"
     WHERE s."serverId" = $1
       AND s."joinTime" >= NOW() - INTERVAL '${days} days'
       AND s."durationSeconds" IS NOT NULL
     GROUP BY s."playerUuid", p."name"
     ORDER BY "totalSeconds" DESC
     LIMIT ${limit}`,
    req.params.id
  );
  res.json(rows.map(r => ({
    playerUuid: r.playerUuid,
    playerName: r.playerName,
    totalSeconds: Number(r.totalSeconds),
    sessionCount: Number(r.sessionCount),
  })));
});

export default router;
