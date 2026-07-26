import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { takePending } from "./commands.js";
import { isDebugApiEnabled, requireTrustedRequest, sanitizeText } from "../security.js";
import { auditLog } from "../logger.js";

const router = Router();

const STALE_MS = 90_000;
const SH_OFFSET = 8 * 60 * 60 * 1000; // 90 秒无心跳视为离线

interface HeartbeatPlayer {
  uuid: string;
  name?: string;
  dimension?: string;
  x?: number;
  y?: number;
  z?: number;
  health?: number;
  maxHealth?: number;
  foodLevel?: number;
  experienceLevel?: number;
  gameMode?: string;
  latency?: number;
  overview?: PlayerOverview;
}

interface DebugSeedPlayer {
  uuid: string;
  name: string;
}
interface ServerMetricPoint {
  id: string;
  serverId: string;
  timestamp: Date;
  tps: number | null;
  mtps: number | null;
  playerCount: number;
}
interface PlayerOverviewCell {
  dx: number;
  dz: number;
  y: number;
  block: string;
  color?: string;
}
interface PlayerOverviewEntity {
  uuid: string;
  type: string;
  name: string;
  category: "player" | "monster" | "animal" | "item" | "entity";
  dx: number;
  dz: number;
  y: number;
  color?: string;
}
interface PlayerOverview {
  radius: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  cells: PlayerOverviewCell[];
  entities?: PlayerOverviewEntity[];
}
type HealthState = "unknown" | "danger" | "low" | "healthy";
type ActivityState = "fresh-session" | "long-session";
type LatencyState = "unknown" | "good" | "high";
type MovementState = "unknown" | "idle" | "moving";
const metricHistory = new Map<string, ServerMetricPoint[]>();
const maxPlayersByServer = new Map<string, number>();
const playerOverviewByServer = new Map<string, Map<string, PlayerOverview & { updatedAt: Date; playerUuid: string; playerName: string }>>();
const pendingOverviewRequests = new Map<string, Set<string>>();

function queueOverviewRequest(serverId: string, playerUuid: string) {
  if (!pendingOverviewRequests.has(serverId)) pendingOverviewRequests.set(serverId, new Set());
  pendingOverviewRequests.get(serverId)!.add(playerUuid);
}

function takeOverviewRequests(serverId: string) {
  const pending = pendingOverviewRequests.get(serverId);
  if (!pending || pending.size === 0) return [];
  const uuids = [...pending];
  pendingOverviewRequests.delete(serverId);
  return uuids;
}

function rememberPlayerOverview(serverId: string, player: HeartbeatPlayer & { uuid: string; name: string }) {
  if (!player.overview || !Array.isArray(player.overview.cells)) return;
  const radius = Math.max(1, Math.min(24, Math.floor(Number(player.overview.radius) || 0)));
  const cells = player.overview.cells
    .filter(cell => Number.isFinite(Number(cell.dx)) && Number.isFinite(Number(cell.dz)) && typeof cell.block === "string")
    .slice(0, (radius * 2 + 1) * (radius * 2 + 1))
    .map(cell => ({
      dx: Math.round(Number(cell.dx)),
      dz: Math.round(Number(cell.dz)),
      y: Number.isFinite(Number(cell.y)) ? Math.round(Number(cell.y)) : 0,
      block: cell.block,
      color: typeof cell.color === "string" && /^#[0-9a-f]{6}$/i.test(cell.color) ? cell.color : undefined,
    }));
  const allowedEntityCategories = new Set(["player", "monster", "animal", "item", "entity"]);
  const entities = Array.isArray(player.overview.entities)
    ? player.overview.entities
      .filter(entity => Number.isFinite(Number(entity.dx)) && Number.isFinite(Number(entity.dz)) && typeof entity.type === "string")
      .slice(0, 120)
      .map(entity => ({
        uuid: typeof entity.uuid === "string" ? entity.uuid : "",
        type: entity.type,
        name: typeof entity.name === "string" && entity.name.trim() ? entity.name.trim() : entity.type,
        category: allowedEntityCategories.has(entity.category) ? entity.category : "entity",
        dx: Math.round(Number(entity.dx)),
        dz: Math.round(Number(entity.dz)),
        y: Number.isFinite(Number(entity.y)) ? Math.round(Number(entity.y)) : 0,
        color: typeof entity.color === "string" && /^#[0-9a-f]{6}$/i.test(entity.color) ? entity.color : undefined,
      }))
    : [];
  if (!playerOverviewByServer.has(serverId)) playerOverviewByServer.set(serverId, new Map());
  playerOverviewByServer.get(serverId)!.set(player.uuid, {
    radius,
    centerX: Math.round(Number(player.overview.centerX) || 0),
    centerY: Math.round(Number(player.overview.centerY) || 0),
    centerZ: Math.round(Number(player.overview.centerZ) || 0),
    cells,
    entities,
    updatedAt: new Date(),
    playerUuid: player.uuid,
    playerName: player.name,
  });
}

function rememberMetric(serverId: string, timestamp: Date, tps: unknown, mtps: unknown, playerCount: number) {
  const rows = metricHistory.get(serverId) || [];
  rows.push({
    id: `${serverId}-${timestamp.getTime()}`,
    serverId,
    timestamp,
    tps: Number.isFinite(Number(tps)) ? Number(tps) : null,
    mtps: Number.isFinite(Number(mtps)) ? Number(mtps) : null,
    playerCount,
  });
  metricHistory.set(serverId, rows.slice(-720));
}

function healthState(snapshot: { health?: number | null; maxHealth?: number | null } | null): HealthState {
  if (snapshot?.health == null || snapshot?.maxHealth == null) return "unknown";
  if (snapshot.health <= 6) return "danger";
  if (snapshot.health <= snapshot.maxHealth * 0.5) return "low";
  return "healthy";
}

function latencyState(snapshot: { latency?: number | null } | null): LatencyState {
  if (snapshot?.latency == null) return "unknown";
  if (snapshot.latency >= 180) return "high";
  return "good";
}

function distance(a: { x: number | null; y: number | null; z: number | null }, b: { x: number | null; y: number | null; z: number | null }) {
  if (a.x == null || a.y == null || a.z == null || b.x == null || b.y == null || b.z == null) return null;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function sessionSeconds(session: { joinTime: Date; leaveTime?: Date | null; durationSeconds?: number | null }, now = new Date()) {
  if (session.durationSeconds != null) return session.durationSeconds;
  if (!session.leaveTime) return Math.max(0, Math.floor((now.getTime() - session.joinTime.getTime()) / 1000));
  return Math.max(0, Math.floor((session.leaveTime.getTime() - session.joinTime.getTime()) / 1000));
}

function sessionEndTime(session: { joinTime: Date; leaveTime?: Date | null; durationSeconds?: number | null }, now = new Date()) {
  if (session.leaveTime) return session.leaveTime;
  if (session.durationSeconds != null) return new Date(session.joinTime.getTime() + session.durationSeconds * 1000);
  return now;
}

function splitSessionByLocalHour(
  session: { joinTime: Date; leaveTime?: Date | null; durationSeconds?: number | null },
  rangeStart: Date,
  now = new Date(),
) {
  const buckets = new Map<number, number>();
  const end = sessionEndTime(session, now).getTime();
  let cursor = Math.max(session.joinTime.getTime(), rangeStart.getTime());
  if (end <= cursor) return buckets;

  while (cursor < end) {
    const local = new Date(cursor + SH_OFFSET);
    const hour = local.getUTCHours();
    const nextLocalHourUtc = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      local.getUTCHours() + 1,
    ) - SH_OFFSET;
    const segmentEnd = Math.min(end, nextLocalHourUtc);
    buckets.set(hour, (buckets.get(hour) || 0) + Math.max(0, Math.floor((segmentEnd - cursor) / 1000)));
    cursor = segmentEnd > cursor ? segmentEnd : end;
  }
  return buckets;
}

function computeStatus(lastHeartbeat: Date | null, storedStatus: string): string {
  if (storedStatus === "offline") return "offline";
  if (!lastHeartbeat) return "offline";
  return Date.now() - new Date(lastHeartbeat).getTime() < STALE_MS ? "online" : "offline";
}

function uniqueLatestSessions<T extends { playerUuid: string; joinTime: Date }>(sessions: T[]): T[] {
  const byPlayer = new Map<string, T>();
  for (const session of sessions) {
    const current = byPlayer.get(session.playerUuid);
    if (!current || session.joinTime > current.joinTime) byPlayer.set(session.playerUuid, session);
  }
  return [...byPlayer.values()];
}

async function closeDuplicateOpenSessions(serverId: string, playerUuid: string, keepId: string, now = new Date()) {
  const duplicates = await prisma.session.findMany({
    where: { serverId, playerUuid, leaveTime: null, id: { not: keepId } },
    select: { id: true, joinTime: true },
  });
  for (const session of duplicates) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        leaveTime: now,
        durationSeconds: Math.max(0, Math.floor((now.getTime() - session.joinTime.getTime()) / 1000)),
      },
    });
  }
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

async function reconcileOnlinePlayers(serverId: string, players: HeartbeatPlayer[]) {
  const now = new Date();
  const byUuid = new Map<string, HeartbeatPlayer & { uuid: string; name: string }>();
  players
    .filter(p => typeof p.uuid === "string" && p.uuid.trim())
    .map(p => ({ ...p, uuid: p.uuid.trim(), name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Unknown" }))
    .forEach(player => byUuid.set(player.uuid, player));
  const normalized = [...byUuid.values()];
  const onlineUuids = new Set(normalized.map(p => p.uuid));
  console.log(`[heartbeat] ${serverId}: ${normalized.length} online player snapshot(s)`);

  for (const player of normalized) {
    await prisma.player.upsert({
      where: { uuid: player.uuid },
      update: { name: player.name, lastSeen: now },
      create: { uuid: player.uuid, name: player.name, firstSeen: now, lastSeen: now },
    });

    const openSession = await prisma.session.findFirst({
      where: { serverId, playerUuid: player.uuid, leaveTime: null },
      orderBy: { joinTime: "desc" },
      select: { id: true },
    });
    if (!openSession) {
      await prisma.session.create({
        data: { serverId, playerUuid: player.uuid, joinTime: now },
      });
      await prisma.event.create({
        data: { serverId, playerUuid: player.uuid, type: "join", timestamp: now },
      });
    } else {
      await closeDuplicateOpenSessions(serverId, player.uuid, openSession.id, now);
    }

    await prisma.playerSnapshot.create({
      data: {
        serverId,
        playerUuid: player.uuid,
        name: player.name,
        timestamp: now,
        dimension: typeof player.dimension === "string" ? player.dimension : null,
        x: Number.isFinite(player.x) ? Math.round(player.x!) : null,
        y: Number.isFinite(player.y) ? Math.round(player.y!) : null,
        z: Number.isFinite(player.z) ? Math.round(player.z!) : null,
        health: Number.isFinite(player.health) ? player.health! : null,
        maxHealth: Number.isFinite(player.maxHealth) ? player.maxHealth! : null,
        foodLevel: Number.isFinite(player.foodLevel) ? Math.round(player.foodLevel!) : null,
        experienceLevel: Number.isFinite(player.experienceLevel) ? Math.round(player.experienceLevel!) : null,
        gameMode: typeof player.gameMode === "string" ? player.gameMode : null,
        latency: Number.isFinite(player.latency) ? Math.round(player.latency!) : null,
      },
    });
    rememberPlayerOverview(serverId, player);
  }

  const openSessions = await prisma.session.findMany({
    where: { serverId, leaveTime: null },
    select: { id: true, playerUuid: true, joinTime: true },
  });
  const leaving = openSessions.filter(s => !onlineUuids.has(s.playerUuid));
  for (const session of leaving) {
    const duration = Math.max(0, Math.floor((now.getTime() - session.joinTime.getTime()) / 1000));
    await prisma.session.update({
      where: { id: session.id },
      data: { leaveTime: now, durationSeconds: duration },
    });
    await prisma.event.create({
      data: { serverId, playerUuid: session.playerUuid, type: "leave", timestamp: now },
    });
  }
}

// Mod heartbeat
router.post("/heartbeat", async (req: Request, res: Response) => {
  const { serverId, serverName, address, status, tps, mtps, maxPlayers, gameMode, modLoader, modVersion, gameVersion, onlinePlayers } = req.body;
  try {
    const heartbeatAt = new Date();
    const server = await prisma.server.upsert({
      where: { id: serverId },
      update: {
        status: status || "online", lastHeartbeat: heartbeatAt, name: serverName, address,
        ...(tps != null ? { tps } : {}),
        ...(mtps != null ? { mtps } : {}),
        ...(gameMode != null ? { gameMode } : {}),
        ...(modLoader != null ? { modLoader } : {}),
        ...(modVersion != null ? { modVersion } : {}),
        ...(gameVersion != null ? { gameVersion } : {}),
      },
      create: {
        id: serverId, name: serverName || "Unknown", address: address || "",
        status: "online", lastHeartbeat: heartbeatAt,
        ...(tps != null ? { tps } : {}),
        ...(mtps != null ? { mtps } : {}),
        ...(gameMode != null ? { gameMode } : {}),
        ...(modLoader != null ? { modLoader } : {}),
        ...(modVersion != null ? { modVersion } : {}),
        ...(gameVersion != null ? { gameVersion } : {}),
      },
    });

    if (Number.isFinite(Number(maxPlayers))) {
      maxPlayersByServer.set(serverId, Math.max(0, Math.round(Number(maxPlayers))));
    }
    console.log(`[heartbeat] ${serverId}: players=${Array.isArray(onlinePlayers) ? onlinePlayers.length : "n/a"}/${maxPlayers ?? "n/a"}`);
    rememberMetric(serverId, heartbeatAt, tps, mtps, Array.isArray(onlinePlayers) ? onlinePlayers.length : 0);

    // 服务器离线时，关闭该服务器所有未结束的 session 并生成 leave 事件
    if (status === "offline") {
      await closeServerSessions(serverId);
    } else if (Array.isArray(onlinePlayers)) {
      await reconcileOnlinePlayers(serverId, onlinePlayers);
    }

    const commands = takePending(serverId);
    const overviewRequests = takeOverviewRequests(serverId);
    res.json({ ok: true, server, commands, overviewRequests });
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

  // 批量查询各服务器当前在线玩家数
  const ids = servers.map(s => s.id);
  const playerCountMap = new Map<string, number>();
  if (ids.length > 0) {
    const openSessions = await prisma.session.findMany({
      where: { serverId: { in: ids }, leaveTime: null },
      select: { serverId: true, playerUuid: true },
    });
    const seen = new Map<string, Set<string>>();
    for (const session of openSessions) {
      if (!seen.has(session.serverId)) seen.set(session.serverId, new Set());
      seen.get(session.serverId)!.add(session.playerUuid);
    }
    for (const [serverId, uuids] of seen) {
      playerCountMap.set(serverId, uuids.size);
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
      maxPlayers: maxPlayersByServer.get(s.id) ?? null,
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
  const playerCount = await prisma.session.count({
    where: { serverId: req.params.id, leaveTime: null },
  });
  const onlineSessions = await prisma.session.findMany({
    where: { serverId: req.params.id, leaveTime: null },
    select: { playerUuid: true, joinTime: true },
  });
  res.json({
    ...server,
    status: computeStatus(server.lastHeartbeat, server.status),
    playerCount: uniqueLatestSessions(onlineSessions).length || playerCount,
    maxPlayers: maxPlayersByServer.get(req.params.id) ?? null,
  });
});

router.get("/:id/players", async (req: Request, res: Response) => {
  const openSessions = await prisma.session.findMany({
    where: { serverId: req.params.id, leaveTime: null },
    orderBy: { joinTime: "desc" },
    include: { player: { select: { uuid: true, name: true, firstSeen: true, lastSeen: true } } },
  });
  const sessions = uniqueLatestSessions(openSessions);
  for (const session of sessions) {
    await closeDuplicateOpenSessions(req.params.id, session.playerUuid, session.id);
  }
  const rows = [];
  for (const session of sessions) {
    const snapshot = await prisma.playerSnapshot.findFirst({
      where: { serverId: req.params.id, playerUuid: session.playerUuid },
      orderBy: { timestamp: "desc" },
    });
    rows.push({
      uuid: session.playerUuid,
      name: snapshot?.name || session.player.name,
      sessionId: session.id,
      joinTime: session.joinTime,
      onlineSeconds: sessionSeconds(session),
      firstSeen: session.player.firstSeen,
      lastSeen: session.player.lastSeen,
      snapshot,
      derived: {
        healthState: healthState(snapshot),
        activityState: sessionSeconds(session) >= 3600 ? "long-session" : "fresh-session",
        latencyState: latencyState(snapshot),
      },
    });
  }
  res.json(rows);
});

router.get("/:id/overview/requests/pending", (req: Request, res: Response) => {
  requireTrustedRequest(req, res, () => {
    res.json({ overviewRequests: takeOverviewRequests(req.params.id) });
  });
});

router.get("/:id/players/:uuid/overview", (req: Request, res: Response) => {
  const overview = playerOverviewByServer.get(req.params.id)?.get(req.params.uuid);
  if (!overview) {
    res.status(404).json({ error: "Player overview not available yet" });
    return;
  }
  res.json(overview);
});

router.post("/:id/players/:uuid/overview/request", (req: Request, res: Response) => {
  playerOverviewByServer.get(req.params.id)?.delete(req.params.uuid);
  queueOverviewRequest(req.params.id, req.params.uuid);
  auditLog("overview_requested", req, { serverId: req.params.id, playerUuid: req.params.uuid });
  res.json({ ok: true, serverId: req.params.id, playerUuid: req.params.uuid });
});

router.get("/:id/history/players", async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(300, parseInt(req.query.limit as string) || 120));
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id },
    orderBy: { joinTime: "desc" },
    include: { player: { select: { uuid: true, name: true, firstSeen: true, lastSeen: true } } },
  });

  const byPlayer = new Map<string, {
    uuid: string;
    name: string;
    firstSeen: Date;
    lastSeen: Date;
    firstJoinTime: Date;
    lastJoinTime: Date;
    lastLeaveTime: Date | null;
    totalSeconds: number;
    sessionCount: number;
    online: boolean;
  }>();

  for (const session of sessions) {
    const entry = byPlayer.get(session.playerUuid) || {
      uuid: session.playerUuid,
      name: session.player.name,
      firstSeen: session.player.firstSeen,
      lastSeen: session.player.lastSeen,
      firstJoinTime: session.joinTime,
      lastJoinTime: session.joinTime,
      lastLeaveTime: session.leaveTime,
      totalSeconds: 0,
      sessionCount: 0,
      online: false,
    };
    entry.name = session.player.name;
    entry.firstJoinTime = session.joinTime < entry.firstJoinTime ? session.joinTime : entry.firstJoinTime;
    entry.lastJoinTime = session.joinTime > entry.lastJoinTime ? session.joinTime : entry.lastJoinTime;
    if (session.leaveTime && (!entry.lastLeaveTime || session.leaveTime > entry.lastLeaveTime)) entry.lastLeaveTime = session.leaveTime;
    entry.totalSeconds += sessionSeconds(session);
    entry.sessionCount++;
    if (!session.leaveTime) entry.online = true;
    byPlayer.set(session.playerUuid, entry);
  }

  const rows = [];
  for (const player of [...byPlayer.values()].sort((a, b) => b.lastJoinTime.getTime() - a.lastJoinTime.getTime()).slice(0, limit)) {
    const latestSnapshot = await prisma.playerSnapshot.findFirst({
      where: { serverId: req.params.id, playerUuid: player.uuid },
      orderBy: { timestamp: "desc" },
    });
    rows.push({ ...player, latestSnapshot });
  }

  res.json(rows);
});

router.get("/:id/analysis", async (req: Request, res: Response) => {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 60 * 1000);
  const [server, sessions, recentEvents] = await Promise.all([
    prisma.server.findUnique({ where: { id: req.params.id } }),
    prisma.session.findMany({
      where: { serverId: req.params.id, leaveTime: null },
      include: { player: { select: { uuid: true, name: true, firstSeen: true, lastSeen: true } } },
      orderBy: { joinTime: "asc" },
    }),
    prisma.event.findMany({
      where: { serverId: req.params.id, timestamp: { gte: since } },
      orderBy: { timestamp: "desc" },
      take: 100,
      include: { player: { select: { name: true } } },
    }),
  ]);
  if (!server) { res.status(404).json({ error: "Server not found" }); return; }

  const uniqueSessions = uniqueLatestSessions(sessions);
  for (const session of uniqueSessions) {
    await closeDuplicateOpenSessions(req.params.id, session.playerUuid, session.id, now);
  }

  const players = [];
  const dimensionCounts = new Map<string, number>();
  let dangerCount = 0;
  let highLatencyCount = 0;
  let movingCount = 0;
  let idleCount = 0;

  for (const session of uniqueSessions) {
    const snapshots = await prisma.playerSnapshot.findMany({
      where: { serverId: req.params.id, playerUuid: session.playerUuid },
      orderBy: { timestamp: "desc" },
      take: 2,
    });
    const latest = snapshots[0] ?? null;
    const previous = snapshots[1] ?? null;
    const movedBlocks = latest && previous ? distance(latest, previous) : null;
    const moveState: MovementState = movedBlocks == null ? "unknown" : movedBlocks < 2 ? "idle" : "moving";
    const hState = healthState(latest);
    const lState = latencyState(latest);
    const onlineSeconds = sessionSeconds(session, now);
    const activityState: ActivityState = onlineSeconds >= 3600 ? "long-session" : "fresh-session";
    const dimension = latest?.dimension || "unknown";

    dimensionCounts.set(dimension, (dimensionCounts.get(dimension) || 0) + 1);
    if (hState === "danger" || hState === "low") dangerCount++;
    if (lState === "high") highLatencyCount++;
    if (moveState === "moving") movingCount++;
    if (moveState === "idle") idleCount++;

    players.push({
      uuid: session.playerUuid,
      name: latest?.name || session.player.name,
      onlineSeconds,
      snapshot: latest,
      derived: {
        healthState: hState,
        latencyState: lState,
        movementState: moveState,
        activityState,
        movedBlocks: movedBlocks == null ? null : Math.round(movedBlocks),
      },
    });
  }

  const joins = recentEvents.filter(e => e.type === "join").length;
  const leaves = recentEvents.filter(e => e.type === "leave").length;
  const deaths = recentEvents.filter(e => e.type === "death").length;
  const onlineCount = uniqueSessions.length;
  const status = computeStatus(server.lastHeartbeat, server.status);
  const health = status !== "online"
    ? "offline"
    : (server.tps != null && server.tps < 18) || (server.mtps != null && server.mtps > 60) || dangerCount > 0 || highLatencyCount > 0
      ? "attention"
      : "healthy";

  res.json({
    serverId: req.params.id,
    generatedAt: now,
    summary: {
      status,
      health,
      onlineCount,
      dangerCount,
      highLatencyCount,
      movingCount,
      idleCount,
      joinsLast30m: joins,
      leavesLast30m: leaves,
      deathsLast30m: deaths,
    },
    dimensions: [...dimensionCounts.entries()].map(([dimension, count]) => ({ dimension, count })),
    players,
    insights: [
      { label: "在线清洗", value: `心跳快照确认 ${onlineCount} 名在线玩家，缺失 join 事件时也会自动补会话。` },
      { label: "风险判断", value: dangerCount || highLatencyCount ? `${dangerCount} 名玩家生命偏低，${highLatencyCount} 名玩家延迟偏高。` : "当前在线玩家状态正常。" },
      { label: "行为判断", value: `${movingCount} 名玩家正在移动，${idleCount} 名玩家近两次快照位置几乎未变。` },
      { label: "事件判断", value: `近 30 分钟加入 ${joins} 次，离开 ${leaves} 次，死亡 ${deaths} 次。` },
    ],
  });
});

router.get("/:id/stats/metrics", async (req: Request, res: Response) => {
  const hours = Math.max(1, Math.min(72, parseInt(req.query.hours as string) || 6));
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = (metricHistory.get(req.params.id) || []).filter(row => row.timestamp >= cutoff);
  res.json(rows);
});

function isDebugRequest(req: Request) {
  return isDebugApiEnabled() && req.header("x-tracesession-debug") === "enabled";
}

router.post("/:id/debug/playtime", async (req: Request, res: Response) => {
  if (!isDebugRequest(req)) { res.status(403).json({ error: "Debug header required" }); return; }
  const { playerUuid, playerName, seconds } = req.body;
  const duration = Number(seconds);
  if (!playerUuid || !Number.isFinite(duration) || duration < 0) {
    res.status(400).json({ error: "playerUuid and non-negative seconds are required" });
    return;
  }
  const now = new Date();
  const joinTime = new Date(now.getTime() - Math.floor(duration) * 1000);
  await prisma.player.upsert({
    where: { uuid: playerUuid },
    update: { name: playerName || "Unknown", lastSeen: now },
    create: { uuid: playerUuid, name: playerName || "Unknown", firstSeen: joinTime, lastSeen: now },
  });
  await prisma.session.create({
    data: { serverId: req.params.id, playerUuid, joinTime, leaveTime: now, durationSeconds: Math.floor(duration) },
  });
  await prisma.event.create({
    data: { serverId: req.params.id, playerUuid, type: "debug-playtime", timestamp: now },
  });
  auditLog("debug_playtime", req, { serverId: req.params.id, playerUuid, seconds: Math.floor(duration) });
  res.json({ ok: true, playerUuid, seconds: Math.floor(duration) });
});

router.post("/:id/debug/seed", async (req: Request, res: Response) => {
  if (!isDebugRequest(req)) { res.status(403).json({ error: "Debug header required" }); return; }
  const count = Math.max(1, Math.min(50, Math.floor(Number(req.body.count) || 5)));
  const now = new Date();
  const players: DebugSeedPlayer[] = Array.from({ length: count }, (_, index) => ({
    uuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `TraceTest${index + 1}`,
  }));
  for (const [index, player] of players.entries()) {
    const joinTime = new Date(now.getTime() - (index + 1) * 600_000);
    const leaveTime = index % 2 === 0 ? null : now;
    const durationSeconds = leaveTime ? Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000) : null;
    await prisma.player.upsert({
      where: { uuid: player.uuid },
      update: { name: player.name, lastSeen: now },
      create: { uuid: player.uuid, name: player.name, firstSeen: joinTime, lastSeen: now },
    });
    await prisma.session.create({
      data: { serverId: req.params.id, playerUuid: player.uuid, joinTime, leaveTime, durationSeconds },
    });
    await prisma.playerSnapshot.create({
      data: {
        serverId: req.params.id,
        playerUuid: player.uuid,
        name: player.name,
        timestamp: now,
        dimension: index % 3 === 0 ? "minecraft:the_nether" : index % 3 === 1 ? "minecraft:the_end" : "minecraft:overworld",
        x: 100 + index * 7,
        y: 64 + (index % 20),
        z: -40 - index * 5,
        health: index % 4 === 0 ? 4 : 20,
        maxHealth: 20,
        foodLevel: 20 - (index % 8),
        experienceLevel: index * 3,
        gameMode: "survival",
        latency: index % 5 === 0 ? 240 : 45 + index * 8,
      },
    });
    await prisma.event.create({
      data: { serverId: req.params.id, playerUuid: player.uuid, type: index % 4 === 0 ? "death" : "debug-seed", timestamp: now },
    });
  }
  auditLog("debug_seed", req, { serverId: req.params.id, count });
  res.json({ ok: true, count });
});

// Update server note
router.put("/:id/note", async (req: Request, res: Response) => {
  const note = sanitizeText(req.body?.note, 200);
  const server = await prisma.server.update({
    where: { id: req.params.id },
    data: { note },
  });
  auditLog("server_note_updated", req, { serverId: req.params.id });
  res.json(server);
});

// ── Server Stats ──

// Daily play time (last N days)
router.get("/:id/stats/daily", async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id, joinTime: { gte: cutoff } },
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

// Hourly distribution (last 30 days)
router.get("/:id/stats/hourly", async (req: Request, res: Response) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: {
      serverId: req.params.id,
      OR: [
        { joinTime: { gte: cutoff } },
        { leaveTime: { gte: cutoff } },
        { leaveTime: null },
      ],
    },
    select: { joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const hourlyMap = new Map<number, { totalSeconds: number; sessionCount: number }>();
  for (const s of sessions) {
    for (const [hour, seconds] of splitSessionByLocalHour(s, cutoff)) {
      const e = hourlyMap.get(hour) || { totalSeconds: 0, sessionCount: 0 };
      e.totalSeconds += seconds;
      e.sessionCount++;
      hourlyMap.set(hour, e);
    }
  }
  const rows = [...hourlyMap.entries()].sort(([a], [b]) => a - b)
    .map(([hour, v]) => ({ hour, totalSeconds: v.totalSeconds, sessionCount: v.sessionCount }));
  res.json(rows);
});

router.get("/:id/stats/hourly/:hour/players", async (req: Request, res: Response) => {
  const hour = Math.max(0, Math.min(23, parseInt(req.params.hour) || 0));
  const days = Math.max(1, Math.min(90, parseInt(req.query.days as string) || 30));
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: {
      serverId: req.params.id,
      OR: [
        { joinTime: { gte: cutoff } },
        { leaveTime: { gte: cutoff } },
        { leaveTime: null },
      ],
    },
    select: { playerUuid: true, joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const byPlayer = new Map<string, { totalSeconds: number; sessionCount: number }>();
  for (const session of sessions) {
    const seconds = splitSessionByLocalHour(session, cutoff).get(hour) || 0;
    if (seconds <= 0) continue;
    const entry = byPlayer.get(session.playerUuid) || { totalSeconds: 0, sessionCount: 0 };
    entry.totalSeconds += seconds;
    entry.sessionCount++;
    byPlayer.set(session.playerUuid, entry);
  }
  const uuids = [...byPlayer.keys()];
  const players = uuids.length > 0 ? await prisma.player.findMany({
    where: { uuid: { in: uuids } },
    select: { uuid: true, name: true },
  }) : [];
  const nameMap = new Map(players.map(p => [p.uuid, p.name]));
  const rows = [...byPlayer.entries()]
    .map(([playerUuid, stats]) => ({
      hour,
      playerUuid,
      playerName: nameMap.get(playerUuid) || "Unknown",
      totalSeconds: stats.totalSeconds,
      sessionCount: stats.sessionCount,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, limit);
  res.json(rows);
});

// Weekday distribution (last 30 days)
router.get("/:id/stats/weekday", async (req: Request, res: Response) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id, joinTime: { gte: cutoff } },
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

// Top players by play time on this server
router.get("/:id/stats/players", async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const days = parseInt(req.query.days as string) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { serverId: req.params.id, joinTime: { gte: cutoff } },
    select: { playerUuid: true, joinTime: true, leaveTime: true, durationSeconds: true },
  });
  const byPlayer = new Map<string, { totalSeconds: number; sessionCount: number }>();
  for (const session of sessions) {
    const entry = byPlayer.get(session.playerUuid) || { totalSeconds: 0, sessionCount: 0 };
    entry.totalSeconds += sessionSeconds(session);
    entry.sessionCount++;
    byPlayer.set(session.playerUuid, entry);
  }
  const uuids = [...byPlayer.keys()];
  const players = uuids.length > 0 ? await prisma.player.findMany({
    where: { uuid: { in: uuids } },
    select: { uuid: true, name: true },
  }) : [];
  const nameMap = new Map(players.map(p => [p.uuid, p.name]));
  const rows = [...byPlayer.entries()].map(([playerUuid, stats]) => ({
    playerUuid,
    playerName: nameMap.get(playerUuid) || "Unknown",
    totalSeconds: stats.totalSeconds,
    sessionCount: stats.sessionCount,
  })).sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, limit);
  res.json(rows);
});

export default router;
