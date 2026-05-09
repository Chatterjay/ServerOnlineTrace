import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually if it exists (don't require dotenv dependency)
const envPath = resolve(__dirname, ".env");
if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim();
    let v = t.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

// Auto-detect: if no DATABASE_URL, default to SQLite
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_PROVIDER = "sqlite";
  const dataDir = resolve(__dirname, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  process.env.DATABASE_URL = "file:./data/tracesession.db";
  console.log("No DATABASE_URL found, using SQLite (file:./data/tracesession.db)");
} else {
  // Infer provider from URL
  process.env.DATABASE_PROVIDER = process.env.DATABASE_URL.startsWith("postgresql")
    ? "postgresql" : "sqlite";
  console.log(`Using ${process.env.DATABASE_PROVIDER}: ${process.env.DATABASE_URL.replace(/\/\/.*@/, "//***@")}`);
}

// Make sure provider is set
if (!process.env.DATABASE_PROVIDER) {
  console.error("Could not determine DATABASE_PROVIDER");
  process.exit(1);
}

// Sync database schema
try {
  execSync("npx prisma generate", { stdio: "inherit", cwd: __dirname });
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", cwd: __dirname });
} catch {
  console.error("Database setup failed");
  process.exit(1);
}

// Start backend
console.log("\nStarting TraceSession backend...\n");
execSync("npx tsx src/index.ts", { stdio: "inherit", cwd: __dirname });
