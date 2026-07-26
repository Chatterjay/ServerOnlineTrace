import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { enqueueCommand } from "./commands.js";
import { sanitizeText } from "../security.js";
import { auditLog } from "../logger.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const text = sanitizeText(req.body?.message, 300);
  if (!text) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const serverId = sanitizeText(req.body?.serverId, 80);
  const label = sanitizeText(req.body?.prefix, 24) || "外部";
  const command = `[${label}] ${text}`;

  if (serverId) {
    const queued = enqueueCommand(serverId, command);
    auditLog("global_broadcast_queued", req, { targets: [serverId], prefix: label });
    res.status(201).json({ ok: true, targets: [serverId], queued: [queued] });
    return;
  }

  const servers = await prisma.server.findMany({
    where: { status: "online" },
    select: { id: true },
  });
  const queued = servers.map(server => enqueueCommand(server.id, command));
  auditLog("global_broadcast_queued", req, { targets: servers.map(s => s.id), prefix: label });
  res.status(201).json({ ok: true, targets: servers.map(s => s.id), queued });
});

export default router;
