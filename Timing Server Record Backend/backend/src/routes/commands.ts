import { Router } from "express";
import { requireTrustedRequest, sanitizeText } from "../security.js";

export interface QueuedCommand {
  id: string;
  serverId: string;
  command: string;
  timestamp: Date;
  delivered: boolean;
  deliveredAt: Date | null;
}

const queues = new Map<string, QueuedCommand[]>();
const MAX_QUEUE = 200;

export function takePending(serverId: string): { id: string; command: string }[] {
  const q = queues.get(serverId) ?? [];
  const pending = q.filter(c => !c.delivered);
  const now = new Date();
  for (const c of pending) {
    c.delivered = true;
    c.deliveredAt = now;
  }
  return pending.map(c => ({ id: c.id, command: c.command }));
}

export function enqueueCommand(serverId: string, command: string): QueuedCommand {
  const entry: QueuedCommand = {
    id: crypto.randomUUID(),
    serverId,
    command,
    timestamp: new Date(),
    delivered: false,
    deliveredAt: null,
  };
  if (!queues.has(serverId)) queues.set(serverId, []);
  const q = queues.get(serverId)!;
  q.push(entry);
  if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
  return entry;
}

const router = Router();

router.get("/:id/commands", (req, res) => {
  res.json((queues.get(req.params.id) ?? []).slice(-100));
});

router.get("/:id/commands/pending", (req, res) => {
  requireTrustedRequest(req, res, () => {
    res.json({ commands: takePending(req.params.id) });
  });
});

router.post("/:id/command", (req, res) => {
  const text = sanitizeText(req.body?.command, 300);
  if (!text) {
    res.status(400).json({ error: "command is required" });
    return;
  }
  const entry = enqueueCommand(req.params.id, text);
  res.status(201).json(entry);
});

router.post("/:id/broadcast", (req, res) => {
  const text = sanitizeText(req.body?.message, 300);
  if (!text) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const label = sanitizeText(req.body?.prefix, 24) || "网站";
  const entry = enqueueCommand(req.params.id, `[${label}] ${text}`);
  res.status(201).json({ ok: true, broadcast: text, queued: entry });
});

export default router;
