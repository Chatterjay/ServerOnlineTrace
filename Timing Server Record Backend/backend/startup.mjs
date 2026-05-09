import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  process.env.DATABASE_PROVIDER = process.env.DATABASE_URL.startsWith("postgresql")
    ? "postgresql" : "sqlite";
  console.log(`Using ${process.env.DATABASE_PROVIDER}: ${process.env.DATABASE_URL.replace(/\/\/.*@/, "//***@")}`);
}

if (!process.env.DATABASE_PROVIDER) {
  console.error("Could not determine DATABASE_PROVIDER");
  process.exit(1);
}

// Prisma 6 doesn't support env() in provider field, so patch schema.prisma temporarily
const schemaPath = resolve(__dirname, "prisma", "schema.prisma");
const originalSchema = readFileSync(schemaPath, "utf-8");
const patchedSchema = originalSchema.replace(/env\("DATABASE_PROVIDER"\)/, `"${process.env.DATABASE_PROVIDER}"`);
writeFileSync(schemaPath, patchedSchema);

try {
  execSync("npx prisma generate", { stdio: "inherit", cwd: __dirname });
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", cwd: __dirname });
} catch {
  writeFileSync(schemaPath, originalSchema);
  console.error("Database setup failed");
  process.exit(1);
}

// Restore original schema (with env() for reference)
writeFileSync(schemaPath, originalSchema);

// Note: SSL cert generation is disabled by default.
// For HTTPS, install OpenSSL and generate certs manually:
//   openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 3650 -nodes -subj "/CN=localhost"
// The backend serves HTTP on port 27890 which works without certs.

// Start backend
// Use compiled JS if available (production build), otherwise tsx (development)
const entry = existsSync(resolve(__dirname, "dist/index.js"))
  ? "node dist/index.js"
  : "npx tsx src/index.ts";

console.log(`\nStarting TraceSession backend (${entry})...\n`);
execSync(entry, { stdio: "inherit", cwd: __dirname });
