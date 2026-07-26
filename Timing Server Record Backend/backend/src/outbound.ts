export type OutboundKind = "chat.message" | "event.created";

export interface OutboundEnvelope<T> {
  kind: OutboundKind;
  timestamp: string;
  payload: T;
}

const WEBHOOK_ENV = "OUTBOUND_WEBHOOK_URLS";
const OUTBOUND_TIMEOUT_MS = 4_000;

function webhookUrls() {
  return (process.env[WEBHOOK_ENV] || "")
    .split(",")
    .map(url => url.trim())
    .filter(url => url.startsWith("http://") || url.startsWith("https://"));
}

export function getOutboundStatus() {
  const urls = webhookUrls();
  return {
    enabled: urls.length > 0,
    env: WEBHOOK_ENV,
    targets: urls.map(url => maskUrl(url)),
  };
}

export function dispatchOutbound<T>(kind: OutboundKind, payload: T) {
  const urls = webhookUrls();
  if (urls.length === 0) return;

  const body = JSON.stringify({
    kind,
    timestamp: new Date().toISOString(),
    payload,
  } satisfies OutboundEnvelope<T>);
  if (body.length > 128_000) {
    console.warn(`[outbound] ${kind} skipped because payload is too large`);
    return;
  }

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "TraceSession-Outbound/1.0" },
      body,
      signal: controller.signal,
    }).catch(error => {
      console.warn(`[outbound] ${kind} -> ${maskUrl(url)} failed:`, error instanceof Error ? error.message : error);
    }).finally(() => {
      clearTimeout(timeout);
    });
  }
}

function maskUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return url;
  }
}
