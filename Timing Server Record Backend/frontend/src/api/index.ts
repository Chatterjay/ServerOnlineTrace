const BASE = import.meta.env.DEV ? "http://127.0.0.1:27890/api" : "/api";

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiJson<T>(path: string, init?: RequestInit, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(350 * (attempt + 1));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Backend unavailable");
}

export interface Server {
  id: string;
  name: string;
  address: string;
  status: string;
  note: string;
  lastHeartbeat: string | null;
  firstSeen: string;
  tps?: number | null;
  mtps?: number | null;
  playerCount?: number;
  gameMode?: string;
  modLoader?: string;
  modVersion?: string;
  gameVersion?: string;
  _count?: { sessions: number; events: number };
  maxPlayers?: number | null;
}

export interface AppVersion {
  name: string;
  version: string;
}

export interface PlayerProfile {
  uuid: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  _count?: { sessions: number; events: number };
  recentSessions: {
    id: string;
    joinTime: string;
    leaveTime: string | null;
    durationSeconds: number | null;
    server: { id?: string; name: string; note?: string | null };
  }[];
  stats: { totalPlayTime: number; deaths: number };
  latestSnapshot?: PlayerSnapshot | null;
}

export interface PlayerSnapshot {
  id: string;
  playerUuid: string;
  serverId: string;
  timestamp: string;
  name: string;
  dimension?: string | null;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  health?: number | null;
  maxHealth?: number | null;
  foodLevel?: number | null;
  experienceLevel?: number | null;
  gameMode?: string | null;
  latency?: number | null;
}

export interface OnlinePlayer {
  uuid: string;
  name: string;
  sessionId: string;
  joinTime: string;
  onlineSeconds: number;
  firstSeen: string;
  lastSeen: string;
  snapshot: PlayerSnapshot | null;
  derived: {
    healthState: "unknown" | "danger" | "low" | "healthy";
    activityState: "fresh-session" | "long-session";
    latencyState?: "unknown" | "good" | "high";
    movementState?: "unknown" | "idle" | "moving";
    movedBlocks?: number | null;
  };
}

export interface ServerAnalysis {
  serverId: string;
  generatedAt: string;
  summary: {
    status: string;
    health: "offline" | "attention" | "healthy";
    onlineCount: number;
    dangerCount: number;
    highLatencyCount: number;
    movingCount: number;
    idleCount: number;
    joinsLast30m: number;
    leavesLast30m: number;
    deathsLast30m: number;
  };
  dimensions: { dimension: string; count: number }[];
  players: OnlinePlayer[];
  insights: { label: string; value: string }[];
}

export interface StatsPoint {
  date: string;
  totalSeconds: number;
  sessionCount: number;
}

export interface HourlyStats {
  hour: number;
  totalSeconds: number;
  sessionCount: number;
}

export interface WeekdayStats {
  day: number;
  totalSeconds: number;
  sessionCount: number;
}

export interface TopPlayerStats {
  playerUuid: string;
  playerName: string;
  totalSeconds: number;
  sessionCount: number;
}

export interface HourlyPlayerStats extends TopPlayerStats {
  hour: number;
}

export interface ServerHistoryPlayer {
  uuid: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  firstJoinTime: string;
  lastJoinTime: string;
  lastLeaveTime: string | null;
  totalSeconds: number;
  sessionCount: number;
  online: boolean;
  latestSnapshot: PlayerSnapshot | null;
}

export interface PlayerOverviewCell {
  dx: number;
  dz: number;
  y: number;
  block: string;
  color?: string;
}

export interface PlayerOverviewEntity {
  uuid: string;
  type: string;
  name: string;
  category: "player" | "monster" | "animal" | "item" | "entity";
  dx: number;
  dz: number;
  y: number;
  color?: string;
}

export interface PlayerOverview {
  radius: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  updatedAt: string;
  playerUuid: string;
  playerName: string;
  cells: PlayerOverviewCell[];
  entities?: PlayerOverviewEntity[];
}

export interface ServerMetricPoint {
  id: string;
  serverId: string;
  timestamp: string;
  tps?: number | null;
  mtps?: number | null;
  playerCount: number;
}

export interface EventData {
  id: string;
  playerUuid: string;
  serverId: string;
  type: string;
  timestamp: string;
  player: { name: string };
  server: { name: string; note?: string };
}

export interface PaginatedEvents {
  events: EventData[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PlayerListItem {
  uuid: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  eventCount: number;
  latestSnapshot: PlayerSnapshot | null;
  latestSession: {
    id: string;
    serverId: string;
    joinTime: string;
    leaveTime: string | null;
    durationSeconds: number | null;
    server: { id: string; name: string };
  } | null;
}

export interface SessionListItem {
  id: string;
  playerUuid: string;
  serverId: string;
  joinTime: string;
  leaveTime: string | null;
  durationSeconds: number | null;
  computedSeconds: number;
  player: { uuid: string; name: string };
  server: { id: string; name: string; note?: string };
}

export async function fetchServers(): Promise<Server[]> {
  return apiJson<Server[]>("/servers");
}

export async function fetchVersion(): Promise<AppVersion> {
  return apiJson<AppVersion>("/version");
}

export async function fetchServer(id: string): Promise<Server> {
  return apiJson<Server>(`/servers/${id}`);
}

export async function updateServerNote(id: string, note: string): Promise<Server> {
  return apiJson<Server>(`/servers/${id}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

export async function fetchPlayerCount(): Promise<number> {
  const data = await apiJson<{ count: number }>("/players/count");
  return data.count;
}

export async function fetchPlayerList(limit = 80): Promise<PlayerListItem[]> {
  return apiJson<PlayerListItem[]>(`/players?limit=${limit}`);
}

export async function fetchRecentSessions(limit = 80): Promise<SessionListItem[]> {
  return apiJson<SessionListItem[]>(`/players/sessions/recent?limit=${limit}`);
}

export async function fetchPlayer(uuid: string): Promise<PlayerProfile> {
  return apiJson<PlayerProfile>(`/players/${uuid}`);
}

export async function fetchPlayerDailyStats(uuid: string, days = 30): Promise<StatsPoint[]> {
  return apiJson<StatsPoint[]>(`/players/${uuid}/stats/daily?days=${days}`);
}

export async function fetchPlayerWeeklyStats(uuid: string, weeks = 12): Promise<StatsPoint[]> {
  return apiJson<StatsPoint[]>(`/players/${uuid}/stats/weekly?weeks=${weeks}`);
}

export async function fetchPlayerHourlyStats(uuid: string): Promise<HourlyStats[]> {
  return apiJson<HourlyStats[]>(`/players/${uuid}/stats/hourly`);
}

export async function fetchPlayerWeekdayStats(uuid: string): Promise<WeekdayStats[]> {
  return apiJson<WeekdayStats[]>(`/players/${uuid}/stats/weekday`);
}

export async function fetchServerDailyStats(id: string, days = 30): Promise<StatsPoint[]> {
  return apiJson<StatsPoint[]>(`/servers/${id}/stats/daily?days=${days}`);
}

export async function fetchServerHourlyStats(id: string): Promise<HourlyStats[]> {
  return apiJson<HourlyStats[]>(`/servers/${id}/stats/hourly`);
}

export async function fetchServerHourlyPlayers(id: string, hour: number, limit = 20): Promise<HourlyPlayerStats[]> {
  return apiJson<HourlyPlayerStats[]>(`/servers/${id}/stats/hourly/${hour}/players?limit=${limit}`);
}

export async function fetchServerWeekdayStats(id: string): Promise<WeekdayStats[]> {
  return apiJson<WeekdayStats[]>(`/servers/${id}/stats/weekday`);
}

export async function fetchServerTopPlayers(id: string, limit = 10): Promise<TopPlayerStats[]> {
  return apiJson<TopPlayerStats[]>(`/servers/${id}/stats/players?limit=${limit}`);
}

export async function fetchServerMetricStats(id: string, hours = 6): Promise<ServerMetricPoint[]> {
  return apiJson<ServerMetricPoint[]>(`/servers/${id}/stats/metrics?hours=${hours}`);
}

export async function fetchServerOnlinePlayers(id: string): Promise<OnlinePlayer[]> {
  return apiJson<OnlinePlayer[]>(`/servers/${id}/players`);
}

export async function fetchPlayerOverview(serverId: string, playerUuid: string): Promise<PlayerOverview> {
  return apiJson<PlayerOverview>(`/servers/${serverId}/players/${playerUuid}/overview`);
}

export async function requestPlayerOverview(serverId: string, playerUuid: string): Promise<{ ok: boolean }> {
  return apiJson<{ ok: boolean }>(`/servers/${serverId}/players/${playerUuid}/overview/request`, {
    method: "POST",
  });
}

export async function fetchServerHistoryPlayers(id: string, limit = 120): Promise<ServerHistoryPlayer[]> {
  return apiJson<ServerHistoryPlayer[]>(`/servers/${id}/history/players?limit=${limit}`);
}

export async function fetchServerAnalysis(id: string): Promise<ServerAnalysis> {
  return apiJson<ServerAnalysis>(`/servers/${id}/analysis`);
}

export async function fetchEvents(params?: {
  page?: number;
  serverId?: string;
  playerUuid?: string;
}): Promise<PaginatedEvents> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.serverId) q.set("serverId", params.serverId);
  if (params?.playerUuid) q.set("playerUuid", params.playerUuid);
  return apiJson<PaginatedEvents>(`/events?${q}`);
}

export async function clearEvents(params: { serverId?: string; playerUuid?: string }): Promise<{ ok: boolean; removed: number }> {
  const q = new URLSearchParams();
  if (params.serverId) q.set("serverId", params.serverId);
  if (params.playerUuid) q.set("playerUuid", params.playerUuid);
  return apiJson<{ ok: boolean; removed: number }>(`/events?${q}`, {
    method: "DELETE",
  });
}

export interface QueuedCommand {
  id: string;
  serverId: string;
  command: string;
  timestamp: string;
  delivered: boolean;
  deliveredAt?: string | null;
}

export async function sendCommand(serverId: string, command: string): Promise<QueuedCommand> {
  return apiJson<QueuedCommand>(`/servers/${serverId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
}

export async function sendBroadcast(serverId: string, message: string, prefix = "网站"): Promise<{
  ok: boolean;
  broadcast: string;
  queued: QueuedCommand;
}> {
  return apiJson<{
    ok: boolean;
    broadcast: string;
    queued: QueuedCommand;
  }>(`/servers/${serverId}/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, prefix }),
  });
}

export async function sendGlobalBroadcast(message: string, serverId?: string, prefix = "外部"): Promise<{
  ok: boolean;
  targets: string[];
  queued: QueuedCommand[];
}> {
  return apiJson<{
    ok: boolean;
    targets: string[];
    queued: QueuedCommand[];
  }>("/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, serverId, prefix }),
  });
}

export async function fetchCommands(serverId: string): Promise<QueuedCommand[]> {
  return apiJson<QueuedCommand[]>(`/servers/${serverId}/commands`);
}

export interface ChatMessage {
  id: string;
  serverId: string;
  playerUuid?: string | null;
  playerName: string;
  message: string;
  timestamp: string;
}

export async function fetchChatMessages(serverId: string): Promise<ChatMessage[]> {
  return apiJson<ChatMessage[]>(`/servers/${serverId}/chat`);
}

export async function clearChatMessages(serverId: string): Promise<{ ok: boolean; removed: number }> {
  return apiJson<{ ok: boolean; removed: number }>(`/servers/${serverId}/chat`, {
    method: "DELETE",
  });
}

export interface DbInfo {
  type: "SQLite" | "PostgreSQL";
  file: string | null;
}

export async function fetchDbType(): Promise<DbInfo> {
  return apiJson<DbInfo>("/db-type");
}
