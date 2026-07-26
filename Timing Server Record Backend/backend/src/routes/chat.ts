import { Router } from "express";
import { dispatchOutbound } from "../outbound.js";
import { sanitizeText } from "../security.js";
import { auditLog } from "../logger.js";

interface ChatMessage {
  id: string;
  serverId: string;
  playerUuid: string | null;
  playerName: string;
  message: string;
  timestamp: Date;
}

const chatMap = new Map<string, ChatMessage[]>();
const MAX_CHAT = 200;

const router = Router();

// Mod reports a player chat message
router.post("/:id/chat", (req, res) => {
  const { playerUuid, playerName, message } = req.body;
  const cleanName = sanitizeText(playerName, 40);
  const cleanMessage = sanitizeText(message, 500);
  if (!cleanName || !cleanMessage) {
    res.status(400).json({ error: "playerName and message are required" });
    return;
  }
  const entry: ChatMessage = {
    id: crypto.randomUUID(),
    serverId: req.params.id,
    playerUuid: typeof playerUuid === "string" && playerUuid.trim() ? playerUuid.trim() : null,
    playerName: cleanName,
    message: cleanMessage,
    timestamp: new Date(),
  };
  if (!chatMap.has(req.params.id)) chatMap.set(req.params.id, []);
  const q = chatMap.get(req.params.id)!;
  q.push(entry);
  if (q.length > MAX_CHAT) q.splice(0, q.length - MAX_CHAT);
  dispatchOutbound("chat.message", entry);
  res.status(201).json(entry);
});

// Frontend polls chat messages
router.get("/:id/chat", (req, res) => {
  res.json(chatMap.get(req.params.id) ?? []);
});

router.delete("/:id/chat", (req, res) => {
  const removed = chatMap.get(req.params.id)?.length ?? 0;
  chatMap.set(req.params.id, []);
  auditLog("chat_cleared", req, { serverId: req.params.id, removed });
  res.json({ ok: true, removed });
});

export default router;
