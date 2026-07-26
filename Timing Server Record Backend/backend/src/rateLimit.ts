import type { NextFunction, Request, Response } from "express";
import { auditLog } from "./logger.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function keyFor(req: Request) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "unknown")
    .split(",")[0]
    .trim();
  return `${ip}:${req.path.split("/").slice(0, 3).join("/")}`;
}

export function rateLimit(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyFor(req);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      auditLog("rate_limited", req, { retryAfter });
      res.status(429).json({ error: "Too many requests", retryAfter });
      return;
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();
