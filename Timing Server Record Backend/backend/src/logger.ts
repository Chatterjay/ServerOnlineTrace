import type { NextFunction, Request, Response } from "express";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const ACCESS_LOG = path.join(LOG_DIR, "access.log");
const AUDIT_LOG = path.join(LOG_DIR, "audit.log");

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-tracesession-key"]);

function clientIp(req: Request) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "")
    .split(",")[0]
    .trim();
}

function writeLog(file: string, entry: Record<string, unknown>) {
  const line = `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`;
  mkdir(LOG_DIR, { recursive: true })
    .then(() => appendFile(file, line, "utf-8"))
    .catch(error => {
      console.warn("[log] write failed:", error instanceof Error ? error.message : error);
    });
}

export function accessLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on("finish", () => {
    writeLog(ACCESS_LOG, {
      ip: clientIp(req),
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      ms: Date.now() - started,
      userAgent: req.header("user-agent") || "",
    });
  });
  next();
}

export function auditLog(action: string, req: Request, details: Record<string, unknown> = {}) {
  writeLog(AUDIT_LOG, {
    action,
    ip: clientIp(req),
    method: req.method,
    path: req.originalUrl.split("?")[0],
    ...details,
  });
}

export function redactHeaders(headers: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return result;
}
