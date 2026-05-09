import { Router } from "express";

interface ChatMessage {
  id: string;
  serverId: string;
  playerName: string;
  message: string;
  timestamp: Date;
}

const chatMap = new Map<string, ChatMessage[]>();
const MAX_CHAT = 200;

const router = Router();

// Mod reports a player chat message
router.post("/:id/chat", (req, res) => {
  const { playerName, message } = req.body;
  if (!playerName || !message) {
    res.status(400).json({ error: "playerName and message are required" });
    return;
  }
  const entry: ChatMessage = {
    id: crypto.randomUUID(),
    serverId: req.params.id,
    playerName,
    message,
    timestamp: new Date(),
  };
  if (!chatMap.has(req.params.id)) chatMap.set(req.params.id, []);
  const q = chatMap.get(req.params.id)!;
  q.push(entry);
  if (q.length > MAX_CHAT) q.splice(0, q.length - MAX_CHAT);
  res.status(201).json(entry);
});

// Frontend polls chat messages
router.get("/:id/chat", (req, res) => {
  res.json(chatMap.get(req.params.id) ?? []);
});

export default router;
