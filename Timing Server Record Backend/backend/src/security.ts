import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { auditLog } from "./logger.js";

const API_KEY_HEADER = "x-tracesession-key";

export function configuredApiKey() {
  return (process.env.TRACESESSION_API_KEY || "").trim();
}

export function isLoopbackRequest(req: Request) {
  const candidates = [
    req.ip,
    req.socket.remoteAddress,
    String(req.headers["x-forwarded-for"] || "").split(",")[0]?.trim(),
  ].filter(Boolean);

  return candidates.some(address =>
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1" ||
    address === "localhost",
  );
}

export function hasValidApiKey(req: Request) {
  const key = configuredApiKey();
  if (!key) return false;
  const supplied = req.header(API_KEY_HEADER) || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied) return false;
  const expected = Buffer.from(key);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function requireTrustedRequest(req: Request, res: Response, next: NextFunction) {
  if (process.env.TRACESESSION_REQUIRE_API_KEY_FOR_WRITES === "true") {
    if (hasValidApiKey(req)) {
      next();
      return;
    }
    auditLog("auth_failed", req, { required: "api-key-for-writes" });
    res.status(401).json({
      error: "TraceSession API key required",
      header: API_KEY_HEADER,
    });
    return;
  }

  if (isLoopbackRequest(req) || hasValidApiKey(req)) {
    next();
    return;
  }

  auditLog("auth_failed", req);
  res.status(401).json({
    error: "TraceSession API key required",
    header: API_KEY_HEADER,
  });
}

export function allowedCorsOrigins() {
  return (process.env.TRACESESSION_CORS_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r?\n/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isDebugApiEnabled() {
  return process.env.TRACESESSION_ENABLE_DEBUG_API === "true";
}
