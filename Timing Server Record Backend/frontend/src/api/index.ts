const BASE = "/api";

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
  _count?: { sessions: number; events: number };
}

export interface PlayerProfile {
  uuid: string;
  name: string;
  firstSeen: string;
  lastSeen: string;
  recentSessions: {
    id: string;
    joinTime: string;
    leaveTime: string | null;
    durationSeconds: number | null;
    server: { name: string };
  }[];
  stats: { totalPlayTime: number; deaths: number };
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

export async function fetchServers(): Promise<Server[]> {
  const res = await fetch(`${BASE}/servers`);
  return res.json();
}

export async function fetchServer(id: string): Promise<Server> {
  const res = await fetch(`${BASE}/servers/${id}`);
  if (!res.ok) throw new Error("Server not found");
  return res.json();
}

export async function updateServerNote(id: string, note: string): Promise<Server> {
  const res = await fetch(`${BASE}/servers/${id}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  return res.json();
}

export async function fetchPlayerCount(): Promise<number> {
  const res = await fetch(`${BASE}/players/count`);
  const data = await res.json();
  return data.count;
}

export async function fetchPlayer(uuid: string): Promise<PlayerProfile> {
  const res = await fetch(`${BASE}/players/${uuid}`);
  if (!res.ok) throw new Error("Player not found");
  return res.json();
}

export async function fetchPlayerDailyStats(uuid: string, days = 30): Promise<StatsPoint[]> {
  const res = await fetch(`${BASE}/players/${uuid}/stats/daily?days=${days}`);
  return res.json();
}

export async function fetchPlayerWeeklyStats(uuid: string, weeks = 12): Promise<StatsPoint[]> {
  const res = await fetch(`${BASE}/players/${uuid}/stats/weekly?weeks=${weeks}`);
  return res.json();
}

export async function fetchPlayerHourlyStats(uuid: string): Promise<HourlyStats[]> {
  const res = await fetch(`${BASE}/players/${uuid}/stats/hourly`);
  return res.json();
}

export async function fetchPlayerWeekdayStats(uuid: string): Promise<WeekdayStats[]> {
  const res = await fetch(`${BASE}/players/${uuid}/stats/weekday`);
  return res.json();
}

export async function fetchServerDailyStats(id: string, days = 30): Promise<StatsPoint[]> {
  const res = await fetch(`${BASE}/servers/${id}/stats/daily?days=${days}`);
  return res.json();
}

export async function fetchServerHourlyStats(id: string): Promise<HourlyStats[]> {
  const res = await fetch(`${BASE}/servers/${id}/stats/hourly`);
  return res.json();
}

export async function fetchServerWeekdayStats(id: string): Promise<WeekdayStats[]> {
  const res = await fetch(`${BASE}/servers/${id}/stats/weekday`);
  return res.json();
}

export async function fetchServerTopPlayers(id: string, limit = 10): Promise<TopPlayerStats[]> {
  const res = await fetch(`${BASE}/servers/${id}/stats/players?limit=${limit}`);
  return res.json();
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
  const res = await fetch(`${BASE}/events?${q}`);
  return res.json();
}

export interface QueuedCommand {
  id: string;
  serverId: string;
  command: string;
  timestamp: string;
  delivered: boolean;
}

export async function sendCommand(serverId: string, command: string): Promise<QueuedCommand> {
  const res = await fetch(`${BASE}/servers/${serverId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error("Failed to send command");
  return res.json();
}

export async function fetchCommands(serverId: string): Promise<QueuedCommand[]> {
  const res = await fetch(`${BASE}/servers/${serverId}/commands`);
  return res.json();
}

