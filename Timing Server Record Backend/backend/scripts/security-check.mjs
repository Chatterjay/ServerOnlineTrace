import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const backend = path.resolve(import.meta.dirname, "..");
const checks = [];

function pass(name) {
  checks.push({ name, ok: true });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

function gitLsFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf-8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

const tracked = gitLsFiles();
const forbidden = tracked.filter(file =>
  /(^|\/)\.env$/.test(file) ||
  /\.db$/i.test(file) ||
  /(^|\/)node_modules\//.test(file) ||
  /(^|\/)dist\//.test(file) ||
  /(^|\/)ssl\//.test(file) ||
  (/\.jar$/i.test(file) && !file.endsWith("gradle-wrapper.jar"))
);
if (forbidden.length === 0) pass("no sensitive/generated files tracked");
else fail("no sensitive/generated files tracked", forbidden.join(", "));

const envExample = readFileSync(path.join(backend, ".env.example"), "utf-8");
for (const key of [
  "TRACESESSION_API_KEY",
  "TRACESESSION_REQUIRE_API_KEY_FOR_WRITES",
  "TRACESESSION_REQUIRE_API_KEY_FOR_READS",
  "TRACESESSION_ENABLE_DEBUG_API",
  "OUTBOUND_WEBHOOK_SECRET",
]) {
  if (envExample.includes(key)) pass(`env documents ${key}`);
  else fail(`env documents ${key}`, "missing from .env.example");
}

const securitySource = readFileSync(path.join(backend, "src", "security.ts"), "utf-8");
if (securitySource.includes("timingSafeEqual")) pass("api key comparison uses timingSafeEqual");
else fail("api key comparison uses timingSafeEqual", "timing-safe comparison missing");

const indexSource = readFileSync(path.join(backend, "src", "index.ts"), "utf-8");
if (indexSource.includes("rateLimit(")) pass("api rate limiter is mounted");
else fail("api rate limiter is mounted", "rateLimit middleware missing");
if (indexSource.includes("accessLogger")) pass("access logger is mounted");
else fail("access logger is mounted", "accessLogger middleware missing");

const outboundSource = readFileSync(path.join(backend, "src", "outbound.ts"), "utf-8");
if (outboundSource.includes("createHmac") && outboundSource.includes("X-TraceSession-Signature")) pass("outbound webhook supports HMAC signature");
else fail("outbound webhook supports HMAC signature", "signature support missing");

const distPath = path.join(backend, "dist");
if (!existsSync(distPath) || !tracked.some(file => file.includes("/dist/"))) pass("build output remains untracked");
else fail("build output remains untracked", "dist appears tracked");

const failed = checks.filter(check => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? `: ${check.detail}` : ""}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
