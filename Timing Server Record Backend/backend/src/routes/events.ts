import { Router, Request, Response } from "express";
import prisma from "../prisma.js";

const router = Router();

// Mod reports player event (join/leave)
router.post("/", async (req: Request, res: Response) => {
  const { serverId, playerUuid, playerName, type } = req.body;
  if (!serverId || !playerUuid || !type) {
    res.status(400).json({ error: "Missing fields: serverId, playerUuid, type" });
    return;
  }

  try {
    // Upsert player
    await prisma.player.upsert({
      where: { uuid: playerUuid },
      update: { name: playerName, lastSeen: new Date() },
      create: { uuid: playerUuid, name: playerName || "Unknown" },
    });

    // Create event
    const event = await prisma.event.create({
      data: { playerUuid, serverId, type },
    });

    // If join, start a session; if leave, close the latest open session
    if (type === "join") {
      await prisma.session.create({
        data: { playerUuid, serverId, joinTime: new Date() },
      });
    } else if (type === "leave") {
      const openSession = await prisma.session.findFirst({
        where: { playerUuid, serverId, leaveTime: null },
        orderBy: { joinTime: "desc" },
      });
      if (openSession) {
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

export default router;
