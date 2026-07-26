<template>
  <section class="ts-page">
    <div class="ts-page-head">
      <div>
        <h1>总览</h1>
        <el-text type="info">先看状态，再进详情。表格可直接点击进入服务器或玩家。</el-text>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert v-if="connectionError" :title="connectionError" type="warning" show-icon :closable="false" />

    <el-row :gutter="12">
      <el-col v-for="item in statCards" :key="item.label" :xs="12" :md="4">
        <el-card class="ts-metric" shadow="never" @click="activeTab = item.key">
          <div class="ts-metric-value">{{ item.value }}</div>
          <div class="ts-metric-label">{{ item.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="ts-workbench">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="服务器" name="servers">
          <div class="ts-split">
            <el-table :data="sortedServers" height="520" stripe row-key="id" @row-click="handleServerRowClick">
              <el-table-column label="状态" width="84">
                <template #default="{ row }"><el-tag :type="row.status === 'online' ? 'success' : 'info'">{{ row.status === "online" ? "在线" : "离线" }}</el-tag></template>
              </el-table-column>
              <el-table-column label="服务器" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.note || row.name || "未命名服务器" }}</template>
              </el-table-column>
              <el-table-column prop="address" label="地址" min-width="170" show-overflow-tooltip />
              <el-table-column label="模组" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">{{ row.modLoader || "-" }} {{ row.modVersion || "-" }}</template>
              </el-table-column>
              <el-table-column label="TPS" width="90"><template #default="{ row }">{{ formatNumber(row.tps, 1) }}</template></el-table-column>
              <el-table-column label="MSPT" width="90"><template #default="{ row }">{{ formatNumber(row.mtps, 0) }}</template></el-table-column>
              <el-table-column label="在线/上限" width="110">
                <template #default="{ row }">{{ serverPlayersText(row) }}</template>
              </el-table-column>
              <el-table-column label="会话/事件" width="110"><template #default="{ row }">{{ row._count?.sessions ?? 0 }} / {{ row._count?.events ?? 0 }}</template></el-table-column>
              <el-table-column label="最后心跳" width="120"><template #default="{ row }">{{ timeAgo(row.lastHeartbeat) }}</template></el-table-column>
            </el-table>
            <div class="ts-side-panel">
              <h3>事件类型</h3>
              <VChart :option="eventTypeOption" autoresize class="ts-chart" />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="玩家" name="players">
          <el-table :data="playerRows" height="560" stripe row-key="uuid" @row-click="handlePlayerRowClick">
            <el-table-column label="玩家" min-width="180" show-overflow-tooltip>
              <template #default="{ row }"><el-space><el-avatar :src="avatarUrl(row.uuid, 28)" shape="square" :size="28" />{{ row.name }}</el-space></template>
            </el-table-column>
            <el-table-column label="维度" min-width="150" show-overflow-tooltip><template #default="{ row }">{{ dimensionLabel(row.latestSnapshot?.dimension) }}</template></el-table-column>
            <el-table-column label="坐标" min-width="130"><template #default="{ row }">{{ snapshotPosition(row.latestSnapshot) }}</template></el-table-column>
            <el-table-column label="生命" width="100"><template #default="{ row }">{{ row.latestSnapshot?.health ?? "-" }}/{{ row.latestSnapshot?.maxHealth ?? "-" }}</template></el-table-column>
            <el-table-column label="饥饿" width="80"><template #default="{ row }">{{ row.latestSnapshot?.foodLevel ?? "-" }}</template></el-table-column>
            <el-table-column label="延迟" width="90"><template #default="{ row }">{{ row.latestSnapshot?.latency ?? "-" }}ms</template></el-table-column>
            <el-table-column prop="sessionCount" label="会话" width="80" />
            <el-table-column prop="eventCount" label="事件" width="80" />
            <el-table-column label="最后出现" width="120"><template #default="{ row }">{{ timeAgo(row.lastSeen) }}</template></el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="记录" name="records">
          <el-table :data="recordRows" height="560" stripe row-key="id" @row-click="handleRecordRowClick">
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag :type="row.kind === 'session' ? 'primary' : eventTagType(row.eventType || '')">
                  {{ row.kind === "session" ? "会话" : eventText(row.eventType || "") }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="玩家" min-width="160"><template #default="{ row }">{{ row.playerName }}</template></el-table-column>
            <el-table-column label="服务器" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.serverName }}</template></el-table-column>
            <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatDateTime(row.time) }}</template></el-table-column>
            <el-table-column label="详情" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.detail }}</template></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Refresh } from "@element-plus/icons-vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart } from "echarts/charts";
import { LegendComponent, TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
import { CHART_COLORS, axisLabelStyle, pieLabelLineStyle, pieLabelStyle, useTheme, useTooltipStyle } from "../composables/useChartTheme";
import { fetchEvents, fetchPlayerCount, fetchPlayerList, fetchRecentSessions, fetchServers, type EventData, type PlayerListItem, type PlayerSnapshot, type Server, type SessionListItem } from "../api/index.js";

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent]);

type TabKey = "servers" | "players" | "records";
type RecordRow = {
  id: string;
  kind: "session" | "event";
  playerUuid: string;
  playerName: string;
  serverName: string;
  time: string;
  detail: string;
  eventType?: string;
};

const router = useRouter();
const dark = useTheme();
const tooltipStyle = useTooltipStyle();
const servers = ref<Server[]>([]);
const events = ref<EventData[]>([]);
const playerRows = ref<PlayerListItem[]>([]);
const sessionRows = ref<SessionListItem[]>([]);
const playerCount = ref(0);
const activeTab = ref<TabKey>("servers");
const loading = ref(false);
const connectionError = ref("");
let timer: ReturnType<typeof setInterval> | null = null;

const sortedServers = computed(() => [...servers.value].sort((a, b) => Number(b.status === "online") - Number(a.status === "online")));
const onlineServers = computed(() => sortedServers.value.filter(server => server.status === "online"));
const onlinePlayers = computed(() => servers.value.reduce((sum, server) => sum + (server.playerCount ?? 0), 0));
const totalSessions = computed(() => servers.value.reduce((sum, server) => sum + (server._count?.sessions ?? 0), 0));
const totalEvents = computed(() => servers.value.reduce((sum, server) => sum + (server._count?.events ?? 0), 0));
const totalRecords = computed(() => totalSessions.value + totalEvents.value);
const statCards = computed(() => [
  { key: "servers" as const, label: "服务器", value: servers.value.length },
  { key: "servers" as const, label: "在线", value: onlineServers.value.length },
  { key: "servers" as const, label: "在线玩家", value: onlinePlayers.value },
  { key: "players" as const, label: "玩家", value: playerCount.value },
  { key: "records" as const, label: "记录", value: totalRecords.value },
]);
const recordRows = computed<RecordRow[]>(() => [
  ...sessionRows.value.map(session => ({
    id: `session-${session.id}`,
    kind: "session" as const,
    playerUuid: session.playerUuid,
    playerName: session.player.name,
    serverName: session.server.note || session.server.name,
    time: session.joinTime,
    detail: `${session.leaveTime ? `结束 ${formatDateTime(session.leaveTime)}` : "在线中"} · ${formatDuration(session.computedSeconds)}`,
  })),
  ...events.value.map(event => ({
    id: `event-${event.id}`,
    kind: "event" as const,
    playerUuid: event.playerUuid,
    playerName: event.player.name,
    serverName: event.server.note || event.server.name,
    time: event.timestamp,
    detail: eventText(event.type),
    eventType: event.type,
  })),
].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
const eventTypeOption = computed(() => {
  const counts = new Map<string, number>();
  for (const event of events.value) counts.set(event.type, (counts.get(event.type) || 0) + 1);
  return {
    tooltip: { ...tooltipStyle.value, trigger: "item" as const },
    legend: { bottom: 0, textStyle: axisLabelStyle(dark.value) },
    series: [{
      type: "pie" as const,
      radius: ["42%", "72%"],
      data: [...counts.entries()].map(([type, value], index) => ({ name: eventText(type), value, itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] } })),
      label: pieLabelStyle(dark.value),
      labelLine: pieLabelLineStyle(dark.value),
    }],
  };
});

async function load() {
  loading.value = true;
  try {
    const [serverRows, eventRows, players, profiles, sessions] = await Promise.all([
      fetchServers(),
      fetchEvents({ page: 1 }),
      fetchPlayerCount(),
      fetchPlayerList(200),
      fetchRecentSessions(200),
    ]);
    servers.value = serverRows;
    events.value = eventRows.events;
    playerCount.value = players;
    playerRows.value = profiles;
    sessionRows.value = sessions;
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    loading.value = false;
  }
}

function handleServerRowClick(row: Server) { router.push(`/servers/${row.id}`); }
function handlePlayerRowClick(row: PlayerListItem) { router.push(`/players/${row.uuid}`); }
function handleRecordRowClick(row: RecordRow) { router.push(`/players/${row.playerUuid}`); }
function formatNumber(value: number | null | undefined, digits: number) { return value == null ? "--" : value.toFixed(digits); }
function serverPlayersText(row: Server) {
  const online = row.playerCount ?? 0;
  return row.maxPlayers == null ? `${online} / --` : `${online} / ${row.maxPlayers}`;
}
function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "0 分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}
function formatDateTime(value: string) { return new Date(value).toLocaleString(); }
function timeAgo(value: string | null) {
  if (!value) return "从未";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
function dimensionLabel(value?: string | null) {
  if (!value) return "未知维度";
  if (value.endsWith("overworld")) return "主世界";
  if (value.endsWith("the_nether")) return "下界";
  if (value.endsWith("the_end")) return "末地";
  return value;
}
function snapshotPosition(snapshot?: PlayerSnapshot | null) {
  if (!snapshot || snapshot.x == null || snapshot.y == null || snapshot.z == null) return "-";
  return `${snapshot.x}, ${snapshot.y}, ${snapshot.z}`;
}
function eventText(type: string) {
  if (type === "join") return "加入";
  if (type === "leave") return "离开";
  if (type === "death") return "死亡";
  if (type === "debug-playtime") return "时长";
  if (type === "debug-seed") return "测试";
  return type;
}
function eventTagType(type: string) {
  if (type === "join") return "success";
  if (type === "leave") return "info";
  if (type === "death") return "danger";
  return "warning";
}
function avatarUrl(uuid: string, size: number) { return `https://mc-heads.net/avatar/${(uuid || "").replace(/-/g, "")}/${size}`; }

onMounted(() => {
  load();
  timer = setInterval(load, 5000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>
