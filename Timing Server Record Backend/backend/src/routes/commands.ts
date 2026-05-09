import { Router } from "express";

export interface QueuedCommand {
  id: string;
  serverId: string;
  command: string;
  timestamp: Date;
  delivered: boolean;
}

const queues = new Map<string, QueuedCommand[]>();

export function takePending(serverId: string): { id: string; command: string }[] {
  const q = queues.get(serverId) ?? [];
  const pending = q.filter(c => !c.delivered);
  for (const c of pending) c.delivered = true;
  return pending.map(c => ({ id: c.id, command: c.command }));
}

const router = Router();

router.get("/:id/commands", (req, res) => {
  res.json((queues.get(req.params.id) ?? []).slice(-100));
});

router.post("/:id/command", (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== "string") {
    res.status(400).json({ error: "command is required" });
    return;
  }
  const entry: QueuedCommand = {
    id: crypto.randomUUID(),
    serverId: req.params.id,
    command,
    timestamp: new Date(),
    delivered: false,
  };
  if (!queues.has(req.params.id)) queues.set(req.params.id, []);
  queues.get(req.params.id)!.push(entry);
  res.status(201).json(entry);
});

export default router;
