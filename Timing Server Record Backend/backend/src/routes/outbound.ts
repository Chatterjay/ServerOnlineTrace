import { Router } from "express";
import { dispatchOutbound, getOutboundStatus } from "../outbound.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getOutboundStatus());
});

router.post("/test", (req, res) => {
  const message = typeof req.body?.message === "string" && req.body.message.trim()
    ? req.body.message.trim()
    : "TraceSession outbound webhook test";
  dispatchOutbound("event.created", {
    serverId: req.body?.serverId || null,
    type: "webhook-test",
    message,
  });
  res.json({ ok: true, outbound: getOutboundStatus() });
});

export default router;
