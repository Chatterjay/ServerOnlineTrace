import { Router, Request, Response } from "express";
import prisma from "../prisma.js";

const router = Router();

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
  const rows = await prisma.$queryRawUnsafe<{ date: string; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT DATE("joinTime" AT TIME ZONE 'Asia/Shanghai')::text as date,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "playerUuid" = $1
       AND "joinTime" >= NOW() - INTERVAL '${days} days'
       AND "durationSeconds" IS NOT NULL
     GROUP BY DATE("joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY date`,
    req.params.uuid
  );
  res.json(rows.map(r => ({ date: r.date, totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

// Weekly play time (last N weeks)
router.get("/:uuid/stats/weekly", async (req: Request, res: Response) => {
  const weeks = parseInt(req.query.weeks as string) || 12;
  const rows = await prisma.$queryRawUnsafe<{ date: string; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT DATE_TRUNC('week', "joinTime" AT TIME ZONE 'Asia/Shanghai')::date as date,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "playerUuid" = $1
       AND "joinTime" >= NOW() - INTERVAL '${weeks} weeks'
       AND "durationSeconds" IS NOT NULL
     GROUP BY DATE_TRUNC('week', "joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY date`,
    req.params.uuid
  );
  res.json(rows.map(r => ({ date: r.date, totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

// Hourly heatmap data (last 30 days)
router.get("/:uuid/stats/hourly", async (req: Request, res: Response) => {
  const rows = await prisma.$queryRawUnsafe<{ hour: number; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT EXTRACT(HOUR FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')::int as hour,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "playerUuid" = $1
       AND "joinTime" >= NOW() - INTERVAL '30 days'
       AND "durationSeconds" IS NOT NULL
     GROUP BY EXTRACT(HOUR FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY hour`,
    req.params.uuid
  );
  res.json(rows.map(r => ({ hour: Number(r.hour), totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

// Weekday distribution (last 30 days)
router.get("/:uuid/stats/weekday", async (req: Request, res: Response) => {
  const rows = await prisma.$queryRawUnsafe<{ day: number; totalSeconds: bigint; sessionCount: bigint }[]>(
    `SELECT EXTRACT(DOW FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')::int as day,
            COALESCE(SUM("durationSeconds"), 0) as "totalSeconds",
            COUNT(*) as "sessionCount"
     FROM "Session"
     WHERE "playerUuid" = $1
       AND "joinTime" >= NOW() - INTERVAL '30 days'
       AND "durationSeconds" IS NOT NULL
     GROUP BY EXTRACT(DOW FROM "joinTime" AT TIME ZONE 'Asia/Shanghai')
     ORDER BY day`,
    req.params.uuid
  );
  res.json(rows.map(r => ({ day: Number(r.day), totalSeconds: Number(r.totalSeconds), sessionCount: Number(r.sessionCount) })));
});

export default router;
