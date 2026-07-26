import { PrismaClient } from "@prisma/client";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const envPath = resolve(backendRoot, ".env");

if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL) {
  const dataDir = resolve(backendRoot, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dataDir, 0o700);
  } catch {
    // Best effort: Windows and some panel hosts may ignore POSIX modes.
  }
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_URL = "file:./data/tracesession.db";
} else if (!process.env.DATABASE_PROVIDER) {
  process.env.DATABASE_PROVIDER = process.env.DATABASE_URL.startsWith("postgresql") ? "postgresql" : "sqlite";
}

const prisma = new PrismaClient();

export default prisma;
