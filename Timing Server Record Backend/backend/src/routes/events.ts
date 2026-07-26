import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { dispatchOutbound } from "../outbound.js";
import { sanitizeText } from "../security.js";
import { auditLog } from "../logger.js";

const router = Router();

// Mod reports player event (join/leave)
router.post("/", async (req: Request, res: Response) => {
  const { serverId, playerUuid, playerName, type } = req.body;
  const cleanServerId = sanitizeText(serverId, 120);
  const cleanPlayerUuid = sanitizeText(playerUuid, 80);
  const cleanPlayerName = sanitizeText(playerName, 40) || "Unknown";
  const cleanType = sanitizeText(type, 40);
  const allowedTypes = new Set(["join", "leave", "death", "debug-playtime", "debug-seed"]);
  if (!cleanServerId || !cleanPlayerUuid || !allowedTypes.has(cleanType)) {
    res.status(400).json({ error: "Missing fields: serverId, playerUuid, type" });
    return;
  }

  try {
    // Upsert player
    await prisma.player.upsert({
      where: { uuid: cleanPlayerUuid },
      update: { name: cleanPlayerName, lastSeen: new Date() },
      create: { uuid: cleanPlayerUuid, name: cleanPlayerName },
    });

    // Create event
    const event = await prisma.event.create({
      data: { playerUuid: cleanPlayerUuid, serverId: cleanServerId, type: cleanType },
    });
    dispatchOutbound("event.created", {
      ...event,
      playerName: cleanPlayerName,
    });

    // If join, start a session; if leave, close the latest open session
    if (cleanType === "join") {
      const openSession = await prisma.session.findFirst({
        where: { playerUuid: cleanPlayerUuid, serverId: cleanServerId, leaveTime: null },
        select: { id: true },
      });
      if (openSession) {
        res.json({ ok: true, event });
        return;
      }
      await prisma.session.create({
        data: { playerUuid: cleanPlayerUuid, serverId: cleanServerId, joinTime: new Date() },
      });
    } else if (cleanType === "leave") {
      const openSessions = await prisma.session.findMany({
        where: { playerUuid: cleanPlayerUuid, serverId: cleanServerId, leaveTime: null },
        orderBy: { joinTime: "desc" },
      });
      for (const openSession of openSessions) {
        const now = new Date();
        const duration = Math.floor((now.getTime() - openSession.joinTime.getTime()) / 1000);
        await prisma.session.update({
          where: { id: openSession.id },
          data: { leaveTime: now, durationSeconds: duration },
        });
      }
    }

    res.json({ ok: true, event });
  } catch (err) {
    console.error("Event error:", err);
    res.status(500).json({ error: "Failed to process event" });
  }
});

// Get events (paginated)
router.get("/", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const serverId = req.query.serverId as string;
  const playerUuid = req.query.playerUuid as string;

  const where: any = {};
  if (serverId) where.serverId = serverId;
  if (playerUuid) where.playerUuid = playerUuid;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { player: { select: { name: true } }, server: { select: { name: true, note: true } } },
    }),
    prisma.event.count({ where }),
  ]);

  res.json({ events, total, page, totalPages: Math.ceil(total / limit) });
});

router.delete("/", async (req: Request, res: Response) => {
  const serverId = req.query.serverId as string;
  const playerUuid = req.query.playerUuid as string;

  const where: any = {};
  if (serverId) where.serverId = serverId;
  if (playerUuid) where.playerUuid = playerUuid;

  if (!serverId && !playerUuid) {
    res.status(400).json({ error: "serverId or playerUuid is required" });
    return;
  }

  const deleted = await prisma.event.deleteMany({ where });
  auditLog("events_cleared", req, { serverId, playerUuid, removed: deleted.count });
  res.json({ ok: true, removed: deleted.count });
});

export default router;
