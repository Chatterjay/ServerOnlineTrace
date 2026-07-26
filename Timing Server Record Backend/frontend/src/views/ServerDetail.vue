<template>
  <section v-if="server" class="ts-page">
    <div class="ts-page-head">
      <div>
        <el-space wrap>
          <el-button text @click="router.back()">返回上一页</el-button>
          <el-button text @click="router.push('/')">返回总览</el-button>
        </el-space>
        <h1>{{ server.note || server.name || "未命名服务器" }}</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="refreshCurrentTab">刷新当前</el-button>
    </div>

    <el-alert v-if="connectionError" :title="connectionError" type="warning" show-icon :closable="false" />

    <div class="ts-detail-grid">
      <aside class="ts-control-column">
        <el-card shadow="never">
          <template #header>服务器</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="状态">
              <el-tag :type="server.status === 'online' ? 'success' : 'info'">{{ server.status === "online" ? "在线" : "离线" }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="平均 TPS">{{ formatNumber(server.tps, 1) }}</el-descriptions-item>
            <el-descriptions-item label="平均 MSPT">{{ formatNumber(server.mtps, 0) }}</el-descriptions-item>
            <el-descriptions-item label="当前在线">{{ serverPlayersText(server) }}</el-descriptions-item>
            <el-descriptions-item label="地址">{{ server.address || "未知" }}</el-descriptions-item>
            <el-descriptions-item label="版本">MC {{ server.gameVersion || "-" }}</el-descriptions-item>
            <el-descriptions-item label="模组">{{ server.modLoader || "-" }} {{ server.modVersion || "-" }}</el-descriptions-item>
            <el-descriptions-item label="心跳">{{ timeAgo(server.lastHeartbeat) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>维度筛选</template>
          <el-radio-group v-model="selectedDimension" class="ts-radio-stack" @change="handleDimensionFilterChange">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button v-for="row in dimensionRows" :key="row.dimension" :label="row.dimension">
              {{ dimensionLabel(row.dimension) }} · {{ row.count }}
            </el-radio-button>
          </el-radio-group>
        </el-card>

        <el-card shadow="never">
          <template #header>通信</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="聊天">{{ chatMessages.length }} 条</el-descriptions-item>
            <el-descriptions-item label="指令">{{ commandHistory.length }} 条</el-descriptions-item>
            <el-descriptions-item label="事件">{{ events.length }} 条</el-descriptions-item>
          </el-descriptions>
          <el-button class="mt-3" type="primary" @click="activeTab = 'terminal'">打开聊天终端</el-button>
        </el-card>

        <el-card shadow="never">
          <template #header>备注</template>
          <el-input v-model="noteText" type="textarea" :rows="3" maxlength="200" show-word-limit />
          <el-button class="mt-3" type="primary" :loading="savingNote" @click="saveNote">保存</el-button>
        </el-card>
      </aside>

      <main class="ts-content-column">
        <el-row :gutter="12">
          <el-col v-for="card in profileCards" :key="card.label" :xs="12" :md="4">
            <el-card shadow="never" class="ts-metric">
              <div class="ts-metric-value">{{ card.value }}</div>
              <div class="ts-metric-label">{{ card.label }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" class="ts-workbench">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="聊天与下发记录" name="terminal">
              <div class="ts-terminal-workspace">
                <section class="ts-chat-panel">
                  <div class="card-header">
                    <strong>聊天与下发记录</strong>
                    <el-space wrap>
                      <el-tag type="info">普通用户权限</el-tag>
                      <el-button size="small" @click="scrollChatToBottom">回到底部</el-button>
                      <el-button size="small" type="danger" plain :loading="clearingChat" @click="clearCurrentChat">清空聊天</el-button>
                    </el-space>
                  </div>
                  <div ref="chatStreamRef" class="ts-chat-stream">
                    <div v-for="item in terminalTimeline" :key="item.id" class="ts-chat-item" :class="`is-${item.kind}`">
                      <el-avatar
                        :src="item.avatar"
                        shape="square"
                        :size="36"
                        :class="{ 'ts-avatar-link': !!item.playerUuid }"
                        @click="handleTerminalPlayerClick(item.playerUuid)"
                      />
                      <div class="ts-chat-bubble">
                        <div class="ts-chat-meta">
                          <strong :class="{ 'ts-link-text': !!item.playerUuid }" @click="handleTerminalPlayerClick(item.playerUuid)">{{ item.name }}</strong>
                          <span>{{ item.statusText }} · {{ formatDateTime(item.timestamp) }}</span>
                        </div>
                        <div class="ts-chat-text">{{ item.text }}</div>
                      </div>
                    </div>
                    <el-empty v-if="terminalTimeline.length === 0" description="暂无聊天或指令记录" />
                  </div>
                  <div class="ts-chat-composer">
                    <el-space wrap class="ts-command-presets">
                      <el-button v-for="preset in commandPresets" :key="preset.command" size="small" @click="terminalText = preset.command">{{ preset.command }}</el-button>
                    </el-space>
                    <el-input v-model="terminalText" placeholder="输入聊天内容，或 /list /help 等普通权限指令" @keyup.enter="sendTerminal">
                      <template #prepend>网站</template>
                      <template #append>
                        <el-button :loading="sending" :disabled="!terminalText.trim()" @click="sendTerminal">发送</el-button>
                      </template>
                    </el-input>
                  </div>
                </section>

                <aside class="ts-command-panel">
                  <div class="card-header">
                    <strong>指令队列与历史</strong>
                    <el-button size="small" :icon="Refresh" :loading="terminalLoading" @click="refreshTerminal">刷新</el-button>
                  </div>
                  <el-table :data="commandHistorySorted" height="560" stripe row-key="id">
                    <el-table-column label="状态" width="160">
                      <template #default="{ row }">
                        <el-space direction="vertical" alignment="flex-start" :size="2">
                          <el-tag :type="row.delivered ? 'success' : 'warning'">{{ row.delivered ? "已下发" : "待下发" }}</el-tag>
                          <span v-if="!row.delivered" class="ts-countdown">{{ pendingCommandText(row) }}</span>
                          <span v-else-if="row.deliveredAt" class="ts-countdown">下发于 {{ timeAgo(row.deliveredAt) }}</span>
                        </el-space>
                      </template>
                    </el-table-column>
                    <el-table-column prop="command" label="内容" min-width="220" show-overflow-tooltip />
                    <el-table-column label="创建时间" width="160"><template #default="{ row }">{{ formatDateTime(row.timestamp) }}</template></el-table-column>
                  </el-table>
                </aside>
              </div>
            </el-tab-pane>

            <el-tab-pane label="性能" name="performance">
              <div class="ts-two-charts">
                <section>
                  <h3>TPS / MSPT 历史折线</h3>
                  <VChart :option="metricLineOption" autoresize class="ts-chart-lg" />
                </section>
                <section>
                  <h3>在线人数历史折线</h3>
                  <VChart :option="playerLineOption" autoresize class="ts-chart-lg" />
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane label="在线玩家/周边" name="players">
              <div class="ts-split ts-player-overview-split">
                <el-table :data="filteredOnlinePlayers" height="560" stripe row-key="uuid" @row-click="handleOnlinePlayerRowClick">
                  <el-table-column label="玩家" min-width="230" fixed="left" show-overflow-tooltip>
                    <template #default="{ row }">
                      <el-space>
                        <el-avatar :src="avatarUrl(row.uuid, 28)" shape="square" :size="28" />
                        <span>{{ row.name }}</span>
                        <el-button size="small" @click.stop="loadPlayerOverview(row)">周边概览</el-button>
                      </el-space>
                    </template>
                  </el-table-column>
                  <el-table-column label="维度" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ dimensionLabel(row.snapshot?.dimension) }}</template></el-table-column>
                  <el-table-column label="坐标" min-width="140"><template #default="{ row }">{{ snapshotPosition(row.snapshot) }}</template></el-table-column>
                  <el-table-column label="生命" width="110"><template #default="{ row }"><el-tag :type="healthTagType(row.derived.healthState)">{{ healthTextForPlayer(row) }}</el-tag></template></el-table-column>
                  <el-table-column label="饥饿/等级/延迟" min-width="160"><template #default="{ row }">{{ row.snapshot?.foodLevel ?? "-" }} / Lv.{{ row.snapshot?.experienceLevel ?? "-" }} / {{ row.snapshot?.latency ?? "-" }}ms</template></el-table-column>
                  <el-table-column label="行为" width="110"><template #default="{ row }">{{ movementText(row.derived.movementState) }}</template></el-table-column>
                  <el-table-column label="在线时长" width="130"><template #default="{ row }">{{ formatDuration(row.onlineSeconds) }}</template></el-table-column>
                  <el-table-column label="概览" width="110" fixed="right">
                    <template #default="{ row }"><el-button size="small" @click.stop="loadPlayerOverview(row)">周边</el-button></template>
                  </el-table-column>
                </el-table>
                <div class="ts-side-panel">
                  <div class="card-header">
                    <h3>玩家周边概览</h3>
                    <el-button size="small" :icon="Refresh" :loading="overviewLoading" :disabled="!selectedOverviewUuid" @click="refreshPlayerOverview">刷新</el-button>
                  </div>
                  <template v-if="playerOverview">
                    <el-text type="info">{{ playerOverview.playerName }} · {{ playerOverview.centerX }}, {{ playerOverview.centerY }}, {{ playerOverview.centerZ }} · {{ timeAgo(playerOverview.updatedAt) }}</el-text>
                    <div class="ts-overview-grid" :style="{ gridTemplateColumns: `repeat(${overviewSize}, 1fr)` }">
                      <el-tooltip
                        v-for="cell in overviewCells"
                        :key="`${cell.dx}:${cell.dz}`"
                        :content="overviewCellTip(cell)"
                        placement="top"
                        effect="dark"
                        :show-after="220"
                        :hide-after="80"
                        :enterable="false"
                      >
                        <div
                          class="ts-overview-cell"
                          :class="{ 'is-player': cell.dx === 0 && cell.dz === 0 }"
                          :style="{ backgroundColor: cell.color || blockColor(cell.block) }"
                        >
                          <span
                            v-for="(entity, entityIndex) in cellEntities(cell)"
                            :key="`${entity.uuid || entity.type}:${entityIndex}`"
                            class="ts-entity-beam"
                            :class="`is-${entity.category}`"
                            :style="entityBeamStyle(entity, entityIndex)"
                          />
                        </div>
                      </el-tooltip>
                    </div>
                  </template>
                  <el-alert
                    v-if="overviewError"
                    class="mt-3"
                    :title="overviewError"
                    type="warning"
                    show-icon
                    :closable="false"
                  />
                  <el-empty v-else description="点击左侧玩家行的“周边”加载附近地表；新版模组重启并心跳后才会有数据" />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="历史玩家" name="history">
              <el-table :data="historyPlayers" height="620" stripe row-key="uuid" @row-click="handleHistoryPlayerRowClick">
                <el-table-column label="玩家" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    <el-space>
                      <el-avatar :src="avatarUrl(row.uuid, 28)" shape="square" :size="28" />
                      {{ row.name }}
                      <el-tag v-if="row.online" type="success" size="small">在线</el-tag>
                    </el-space>
                  </template>
                </el-table-column>
                <el-table-column label="总在线" width="140"><template #default="{ row }">{{ formatDuration(row.totalSeconds) }}</template></el-table-column>
                <el-table-column prop="sessionCount" label="会话数" width="100" />
                <el-table-column label="首次加入" width="180"><template #default="{ row }">{{ formatDateTime(row.firstJoinTime) }}</template></el-table-column>
                <el-table-column label="最后加入" width="180"><template #default="{ row }">{{ formatDateTime(row.lastJoinTime) }}</template></el-table-column>
                <el-table-column label="最后离开" width="180"><template #default="{ row }">{{ row.lastLeaveTime ? formatDateTime(row.lastLeaveTime) : "在线中" }}</template></el-table-column>
                <el-table-column label="最后维度" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ dimensionLabel(row.latestSnapshot?.dimension) }}</template></el-table-column>
                <el-table-column label="最后坐标" min-width="140"><template #default="{ row }">{{ snapshotPosition(row.latestSnapshot) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="画像" name="profile">
              <div class="ts-split">
                <el-table :data="insights" height="420" stripe>
                  <el-table-column prop="label" label="判断" width="130" />
                  <el-table-column prop="value" label="说明" show-overflow-tooltip />
                </el-table>
                <div class="ts-side-panel">
                  <h3>维度分布</h3>
                  <VChart :option="dimensionOption" autoresize class="ts-chart" />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="活跃" name="activity">
              <div class="ts-two-charts">
                <section>
                  <h3>近 30 天在线趋势</h3>
                  <VChart :option="dailyOption" autoresize class="ts-chart-lg" />
                </section>
                <section>
                  <div class="card-header">
                    <h3>24 小时活跃分布</h3>
                    <el-tag type="info">{{ selectedHourLabel }}</el-tag>
                  </div>
                  <VChart :option="hourlyOption" autoresize class="ts-chart-lg" @click="handleHourlyChartClick" />
                </section>
                <section>
                  <h3>星期分布</h3>
                  <VChart :option="weekdayOption" autoresize class="ts-chart-lg" />
                </section>
                <section>
                  <h3>活跃玩家排行</h3>
                  <VChart :option="topPlayersOption" autoresize class="ts-chart-lg" />
                </section>
              </div>
              <el-card shadow="never" class="mt-3">
                <template #header>
                  <div class="card-header">
                    <strong>{{ selectedHourLabel }} 玩家在线贡献</strong>
                    <el-button size="small" :icon="Refresh" :loading="hourlyPlayersLoading" @click="refreshSelectedHourPlayers">刷新</el-button>
                  </div>
                </template>
                <el-table :data="hourlyPlayers" height="360" stripe row-key="playerUuid" @row-click="handleHourlyPlayerRowClick">
                  <el-table-column label="玩家" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                      <el-space>
                        <el-avatar :src="avatarUrl(row.playerUuid, 28)" shape="square" :size="28" />
                        {{ row.playerName }}
                      </el-space>
                    </template>
                  </el-table-column>
                  <el-table-column label="在线时长" width="140"><template #default="{ row }">{{ formatDuration(row.totalSeconds) }}</template></el-table-column>
                  <el-table-column prop="sessionCount" label="会话片段" width="110" />
                </el-table>
              </el-card>
            </el-tab-pane>

            <el-tab-pane label="游戏事件" name="events">
              <div class="card-header mb-2">
                <strong>游戏事件</strong>
                <el-space wrap>
                  <el-button size="small" :icon="Refresh" :loading="eventsLoading" @click="refreshEvents">刷新</el-button>
                  <el-button size="small" type="danger" plain :loading="clearingEvents" @click="clearServerEvents">清空事件</el-button>
                </el-space>
              </div>
              <el-table :data="events" height="620" stripe row-key="id">
                <el-table-column label="类型" width="90"><template #default="{ row }">{{ eventText(row.type) }}</template></el-table-column>
                <el-table-column label="玩家" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">
                    <el-space class="ts-link-cell" @click.stop="router.push(`/players/${row.playerUuid}`)">
                      <el-avatar :src="avatarUrl(row.playerUuid, 28)" shape="square" :size="28" />
                      {{ row.player.name }}
                    </el-space>
                  </template>
                </el-table-column>
                <el-table-column label="来源" min-width="180" show-overflow-tooltip><template #default="{ row }">{{ row.server.note || row.server.name }}</template></el-table-column>
                <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatDateTime(row.timestamp) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="API" name="api">
              <div class="ts-api-panel">
                <el-alert title="往内：外部系统 POST 到后端，后端排队，模组轮询后把消息或普通权限指令送进游戏内。" type="info" show-icon :closable="false" />
                <el-input type="textarea" :rows="10" readonly :model-value="broadcastExample" />
                <el-input type="textarea" :rows="9" readonly :model-value="globalBroadcastExample" />
                <el-alert title="往外：游戏内聊天/事件进入后端后，后端会主动 POST 到 OUTBOUND_WEBHOOK_URLS；也可以用 GET 接口轮询读取。" type="success" show-icon :closable="false" />
                <el-input type="textarea" :rows="12" readonly :model-value="outboundWebhookExample" />
                <el-input type="textarea" :rows="8" readonly :model-value="outboundPollExample" />
              </div>
            </el-tab-pane>

          </el-tabs>
        </el-card>
      </main>
    </div>
  </section>

  <el-empty v-else :description="connectionError || '加载中...'" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
import { CHART_COLORS, axisLabelStyle, axisYStyle, pieLabelLineStyle, pieLabelStyle, useTheme, useTooltipStyle } from "../composables/useChartTheme";
import {
  clearChatMessages,
  clearEvents,
  fetchChatMessages,
  fetchCommands,
  fetchEvents,
  fetchPlayerOverview,
  fetchServer,
  fetchServerAnalysis,
  fetchServerDailyStats,
  fetchServerHistoryPlayers,
  fetchServerHourlyPlayers,
  fetchServerHourlyStats,
  fetchServerMetricStats,
  fetchServerTopPlayers,
  fetchServerWeekdayStats,
  requestPlayerOverview,
  sendBroadcast,
  sendCommand,
  updateServerNote,
  type ChatMessage,
  type EventData,
  type HourlyPlayerStats,
  type HourlyStats,
  type OnlinePlayer,
  type PlayerOverview,
  type PlayerOverviewCell,
  type PlayerOverviewEntity,
  type PlayerSnapshot,
  type QueuedCommand,
  type Server,
  type ServerAnalysis,
  type ServerHistoryPlayer,
  type ServerMetricPoint,
  type StatsPoint,
  type TopPlayerStats,
  type WeekdayStats,
} from "../api/index.js";

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

type DetailTab = "terminal" | "performance" | "players" | "history" | "profile" | "activity" | "events" | "api";

const route = useRoute();
const router = useRouter();
const dark = useTheme();
const tooltipStyle = useTooltipStyle();
const server = ref<Server | null>(null);
const noteText = ref("");
const savingNote = ref(false);
const activeTab = ref<DetailTab>("terminal");
const selectedDimension = ref("");
const dailyStats = ref<StatsPoint[]>([]);
const hourlyStats = ref<HourlyStats[]>([]);
const weekdayStats = ref<WeekdayStats[]>([]);
const topPlayers = ref<TopPlayerStats[]>([]);
const hourlyPlayers = ref<HourlyPlayerStats[]>([]);
const metricStats = ref<ServerMetricPoint[]>([]);
const onlinePlayers = ref<OnlinePlayer[]>([]);
const historyPlayers = ref<ServerHistoryPlayer[]>([]);
const playerOverview = ref<PlayerOverview | null>(null);
const selectedOverviewUuid = ref("");
const overviewError = ref("");
const analysis = ref<ServerAnalysis | null>(null);
const commandHistory = ref<QueuedCommand[]>([]);
const chatMessages = ref<ChatMessage[]>([]);
const events = ref<EventData[]>([]);
const terminalText = ref("");
const sending = ref(false);
const loading = ref(false);
const terminalLoading = ref(false);
const hourlyPlayersLoading = ref(false);
const clearingChat = ref(false);
const eventsLoading = ref(false);
const clearingEvents = ref(false);
const overviewLoading = ref(false);
const connectionError = ref("");
const selectedHour = ref(new Date().getHours());
const chatStreamRef = ref<HTMLElement | null>(null);
const nowTick = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const COMMAND_POLL_SECONDS = 2;
const commandPresets = [{ command: "/list" }, { command: "/help" }, { command: "/me " }, { command: "/msg " }];
const dimensionRows = computed(() => {
  const counts = new Map<string, number>();
  for (const player of onlinePlayers.value) {
    const dimension = player.snapshot?.dimension || "unknown";
    counts.set(dimension, (counts.get(dimension) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([dimension, count]) => ({ dimension, count }))
    .sort((a, b) => b.count - a.count || dimensionLabel(a.dimension).localeCompare(dimensionLabel(b.dimension), "zh-Hans-CN"));
});
const insights = computed(() => analysis.value?.insights ?? []);
const filteredOnlinePlayers = computed(() => selectedDimension.value ? onlinePlayers.value.filter(player => (player.snapshot?.dimension || "unknown") === selectedDimension.value) : onlinePlayers.value);
const profileCards = computed(() => {
  const summary = analysis.value?.summary;
  return [
    { label: "在线", value: summary?.onlineCount ?? onlinePlayers.value.length },
    { label: "生命风险", value: summary?.dangerCount ?? 0 },
    { label: "高延迟", value: summary?.highLatencyCount ?? 0 },
    { label: "移动", value: summary?.movingCount ?? 0 },
    { label: "静止", value: summary?.idleCount ?? 0 },
    { label: "死亡/30m", value: summary?.deathsLast30m ?? 0 },
  ];
});
const eventAndChatRows = computed(() => [
  ...events.value.map(event => ({ kind: eventText(event.type), name: event.player.name, text: event.server.note || event.server.name, timestamp: event.timestamp })),
  ...chatMessages.value.map(chat => ({ kind: "聊天", name: chat.playerName, text: chat.message, timestamp: chat.timestamp })),
  ...commandHistory.value.map(command => ({ kind: "指令", name: command.delivered ? "已下发" : "待下发", text: command.command, timestamp: command.timestamp })),
].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
const commandHistorySorted = computed(() => [...commandHistory.value].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
const terminalTimeline = computed(() => [
  ...chatMessages.value.map(chat => ({
    id: `chat-${chat.id}`,
    kind: "chat",
    name: chat.playerName,
    playerUuid: chat.playerUuid || onlinePlayers.value.find(player => player.name === chat.playerName)?.uuid || null,
    text: chat.message,
    timestamp: chat.timestamp,
    statusText: "游戏聊天",
    avatar: chat.playerUuid ? avatarUrl(chat.playerUuid, 36) : playerAvatarByName(chat.playerName, 36),
  })),
  ...commandHistory.value.map(command => ({
    id: `command-${command.id}`,
    kind: "command",
    name: "网站终端",
    playerUuid: null,
    text: command.command,
    timestamp: command.timestamp,
    statusText: command.delivered ? "已下发" : `待下发 · ${pendingCommandText(command)}`,
    avatar: `https://mc-heads.net/avatar/MHF_CommandBlock/36`,
  })),
].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-180));
const broadcastExample = computed(() => `POST /api/servers/${server.value?.id || "{serverId}"}/broadcast\nContent-Type: application/json\n\n{\n  "message": "维护将在 10 分钟后开始",\n  "prefix": "公告"\n}`);
const globalBroadcastExample = computed(() => `POST /api/broadcast\nContent-Type: application/json\n\n{\n  "serverId": "${server.value?.id || "{可选：指定服务器}"}",\n  "message": "来自外部系统的提醒",\n  "prefix": "外部"\n}`);
const outboundWebhookExample = computed(() => `# .env\nOUTBOUND_WEBHOOK_URLS=https://example.com/tracesession/webhook\n\n# 后端会主动 POST 到上面的 URL\nContent-Type: application/json\n\n{\n  "kind": "chat.message 或 event.created",\n  "timestamp": "2026-07-26T13:20:00.000Z",\n  "payload": { "serverId": "${server.value?.id || "{serverId}"}", "...": "聊天或事件数据" }\n}\n\nGET /api/outbound\nPOST /api/outbound/test`);
const outboundPollExample = computed(() => `# 不配置 webhook 时，外部系统也可以轮询\nGET /api/servers/${server.value?.id || "{serverId}"}/chat\nGET /api/events?serverId=${server.value?.id || "{serverId}"}\nGET /api/servers/${server.value?.id || "{serverId}"}\nGET /api/servers/${server.value?.id || "{serverId}"}/players`);
const dailyData = computed(() => dailyStats.value.map(d => ({ label: d.date.slice(5), value: +(d.totalSeconds / 3600).toFixed(1) })));
const hourlyData = computed(() => Array.from({ length: 24 }, (_, hour) => {
  const found = hourlyStats.value.find(h => h.hour === hour);
  return { label: `${String(hour).padStart(2, "0")}:00`, value: found ? +(found.totalSeconds / 3600).toFixed(2) : 0 };
}));
const selectedHourLabel = computed(() => `${String(selectedHour.value).padStart(2, "0")}:00-${String((selectedHour.value + 1) % 24).padStart(2, "0")}:00`);
const weekdayData = computed(() => WEEKDAY_NAMES.map((name, day) => {
  const found = weekdayStats.value.find(w => w.day === day);
  return { label: name, value: found ? +(found.totalSeconds / 3600).toFixed(1) : 0 };
}));
const overviewSize = computed(() => playerOverview.value ? playerOverview.value.radius * 2 + 1 : 1);
const overviewCells = computed<PlayerOverviewCell[]>(() => {
  if (!playerOverview.value) return [];
  return [...playerOverview.value.cells].sort((a, b) => a.dz === b.dz ? a.dx - b.dx : a.dz - b.dz);
});
const overviewEntitiesByCell = computed(() => {
  const grouped = new Map<string, PlayerOverviewEntity[]>();
  for (const entity of playerOverview.value?.entities ?? []) {
    const key = `${entity.dx}:${entity.dz}`;
    grouped.set(key, [...(grouped.get(key) ?? []), entity]);
  }
  return grouped;
});

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function load() {
  await Promise.all([refreshCommon(), refreshTab(activeTab.value)]);
}

async function refreshCommon() {
  const id = route.params.id as string;
  const [serverRow, clean] = await Promise.all([
    fetchServer(id),
    fetchServerAnalysis(id),
  ]);
  server.value = serverRow;
  noteText.value = serverRow.note || "";
  analysis.value = clean;
  onlinePlayers.value = clean.players;
}

async function refreshTab(tab: DetailTab) {
  const id = route.params.id as string;
  if (tab === "performance") {
    metricStats.value = await fetchServerMetricStats(id, 6);
    return;
  }
  if (tab === "players" || tab === "profile") {
    const clean = await fetchServerAnalysis(id);
    analysis.value = clean;
    onlinePlayers.value = clean.players;
    return;
  }
  if (tab === "history") {
    historyPlayers.value = await fetchServerHistoryPlayers(id, 150);
    return;
  }
  if (tab === "activity") {
    const [daily, hourly, weekday, players, hourPlayers] = await Promise.all([
      fetchServerDailyStats(id),
      fetchServerHourlyStats(id),
      fetchServerWeekdayStats(id),
      fetchServerTopPlayers(id, 20),
      fetchServerHourlyPlayers(id, selectedHour.value, 20),
    ]);
    dailyStats.value = daily;
    hourlyStats.value = hourly;
    weekdayStats.value = weekday;
    topPlayers.value = players;
    hourlyPlayers.value = hourPlayers;
    return;
  }
  if (tab === "terminal") {
    const [commands, chat] = await Promise.all([
      fetchCommands(id),
      fetchChatMessages(id),
    ]);
    commandHistory.value = commands;
    chatMessages.value = chat;
    return;
  }
  if (tab === "events") {
    const eventPage = await fetchEvents({ serverId: id, page: 1 });
    events.value = eventPage.events;
  }
}

async function refreshCurrentTab() {
  loading.value = true;
  try {
    await Promise.all([
      refreshCommon(),
      refreshTab(activeTab.value),
    ]);
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    loading.value = false;
  }
}

async function refreshTerminal() {
  if (!server.value || terminalLoading.value) return;
  terminalLoading.value = true;
  try {
    const shouldStick = isChatNearBottom();
    await refreshTab("terminal");
    if (shouldStick) await scrollChatToBottom();
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    terminalLoading.value = false;
  }
}

async function refreshSelectedHourPlayers() {
  if (!server.value || hourlyPlayersLoading.value) return;
  hourlyPlayersLoading.value = true;
  try {
    hourlyPlayers.value = await fetchServerHourlyPlayers(server.value.id, selectedHour.value, 20);
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    hourlyPlayersLoading.value = false;
  }
}

async function pollCurrentTab() {
  try {
    await Promise.all([
      refreshCommon(),
      refreshTab(activeTab.value),
    ]);
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  }
}

async function loadInitialData() {
  const id = route.params.id as string;
  loading.value = true;
  try {
    const [serverRow, clean, history, metrics, daily, hourly, weekday, players, hourPlayers, commands, chat, eventPage] = await Promise.all([
      fetchServer(id),
      fetchServerAnalysis(id),
      fetchServerHistoryPlayers(id, 150),
      fetchServerMetricStats(id, 6),
      fetchServerDailyStats(id),
      fetchServerHourlyStats(id),
      fetchServerWeekdayStats(id),
      fetchServerTopPlayers(id, 20),
      fetchServerHourlyPlayers(id, selectedHour.value, 20),
      fetchCommands(id),
      fetchChatMessages(id),
      fetchEvents({ serverId: id, page: 1 }),
    ]);
    server.value = serverRow;
    noteText.value = serverRow.note || "";
    analysis.value = clean;
    onlinePlayers.value = clean.players;
    historyPlayers.value = history;
    metricStats.value = metrics;
    dailyStats.value = daily;
    hourlyStats.value = hourly;
    weekdayStats.value = weekday;
    topPlayers.value = players;
    hourlyPlayers.value = hourPlayers;
    commandHistory.value = commands;
    chatMessages.value = chat;
    events.value = eventPage.events;
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    loading.value = false;
  }
}
async function saveNote() {
  if (!server.value) return;
  savingNote.value = true;
  try {
    const saved = await updateServerNote(server.value.id, noteText.value);
    server.value = { ...server.value, note: saved.note };
    ElMessage.success("备注已保存");
  } finally {
    savingNote.value = false;
  }
}
async function sendTerminal() {
  const text = terminalText.value.trim();
  if (!text || !server.value || sending.value) return;
  sending.value = true;
  try {
    const queued = text.startsWith("/") ? await sendCommand(server.value.id, text) : (await sendBroadcast(server.value.id, text, "网站")).queued;
    commandHistory.value.push(queued);
    terminalText.value = "";
    await scrollChatToBottom();
    ElMessage.success("已加入下发队列");
  } catch {
    ElMessage.error("发送失败，后端当前不可用");
  } finally {
    sending.value = false;
  }
}
async function clearCurrentChat() {
  if (!server.value || clearingChat.value) return;
  clearingChat.value = true;
  try {
    const result = await clearChatMessages(server.value.id);
    chatMessages.value = [];
    ElMessage.success(`已清空 ${result.removed} 条聊天记录`);
  } catch {
    ElMessage.error("清空失败，后端当前不可用");
  } finally {
    clearingChat.value = false;
  }
}
async function refreshEvents() {
  if (!server.value || eventsLoading.value) return;
  eventsLoading.value = true;
  try {
    const eventPage = await fetchEvents({ serverId: server.value.id, page: 1 });
    events.value = eventPage.events;
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    eventsLoading.value = false;
  }
}
async function clearServerEvents() {
  if (!server.value || clearingEvents.value) return;
  clearingEvents.value = true;
  try {
    const result = await clearEvents({ serverId: server.value.id });
    events.value = [];
    ElMessage.success(`已清空 ${result.removed} 条事件`);
  } catch {
    ElMessage.error("清空失败，后端当前不可用");
  } finally {
    clearingEvents.value = false;
  }
}
async function loadPlayerOverview(player: OnlinePlayer) {
  if (!server.value || overviewLoading.value) return;
  selectedOverviewUuid.value = player.uuid;
  overviewLoading.value = true;
  playerOverview.value = null;
  overviewError.value = "已请求模组重新采样，等待下一次玩家周边概览回传...";
  try {
    await requestPlayerOverview(server.value.id, player.uuid);
    for (let attempt = 0; attempt < 14; attempt++) {
      await sleep(700);
      try {
        playerOverview.value = await fetchPlayerOverview(server.value.id, player.uuid);
        break;
      } catch {
        // The mod needs one tick and one heartbeat response before this snapshot exists.
      }
    }
    if (!playerOverview.value) throw new Error("Player overview timed out");
    overviewError.value = "";
    connectionError.value = "";
  } catch {
    playerOverview.value = null;
    overviewError.value = "该玩家周边概览还未上传。请确认 Minecraft 服务端已重启加载新版模组，并等待下一次心跳。";
  } finally {
    overviewLoading.value = false;
  }
}
async function refreshPlayerOverview() {
  const player = onlinePlayers.value.find(row => row.uuid === selectedOverviewUuid.value);
  if (player) await loadPlayerOverview(player);
}
function isChatNearBottom() {
  const el = chatStreamRef.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}
async function scrollChatToBottom() {
  await nextTick();
  const el = chatStreamRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}
function handleOnlinePlayerRowClick(row: OnlinePlayer) { router.push(`/players/${row.uuid}`); }
function handleHistoryPlayerRowClick(row: ServerHistoryPlayer) { router.push(`/players/${row.uuid}`); }
function handleHourlyPlayerRowClick(row: HourlyPlayerStats) { router.push(`/players/${row.playerUuid}`); }
function handleTerminalPlayerClick(uuid?: string | null) {
  if (!uuid) return;
  router.push(`/players/${uuid}`);
}
function handleDimensionFilterChange() {
  activeTab.value = "players";
}
function pendingCommandText(command: QueuedCommand) {
  if (server.value?.status !== "online") return "服务器离线，等待重连";
  const elapsed = Math.max(0, Math.floor((nowTick.value - new Date(command.timestamp).getTime()) / 1000));
  if (elapsed < COMMAND_POLL_SECONDS) return `预计 ${COMMAND_POLL_SECONDS - elapsed} 秒内下发`;
  return `等待模组确认，已等待 ${elapsed} 秒`;
}
function handleHourlyChartClick(params: { dataIndex?: number; name?: string }) {
  const byIndex = typeof params.dataIndex === "number" ? params.dataIndex : Number.parseInt(params.name || "", 10);
  if (!Number.isFinite(byIndex)) return;
  selectedHour.value = Math.max(0, Math.min(23, byIndex));
  refreshSelectedHourPlayers();
}

function blockColor(block: string) {
  const name = block.replace(/^minecraft:/, "").toLowerCase();
  if (name.includes("water")) return "#2f80ed";
  if (name.includes("lava") || name.includes("magma")) return "#f97316";
  if (name.includes("grass_block")) return "#66a84f";
  if (name === "grass" || name.includes("short_grass") || name.includes("fern") || name.includes("vine")) return "#4f9b45";
  if (name.includes("leaves") || name.includes("moss") || name.includes("azalea")) return "#367c3f";
  if (name.includes("flower") || name.includes("tulip") || name.includes("dandelion") || name.includes("poppy")) return "#d946ef";
  if (name.includes("crop") || name.includes("wheat") || name.includes("carrot") || name.includes("potato") || name.includes("beetroot")) return "#a3bf3f";
  if (name.includes("sandstone")) return "#c9aa68";
  if (name.includes("sand")) return "#d9c27e";
  if (name.includes("snow")) return "#f8fafc";
  if (name.includes("ice")) return "#bfdbfe";
  if (name.includes("deepslate")) return "#3f3f46";
  if (name.includes("tuff")) return "#737373";
  if (name.includes("stone") || name.includes("ore") || name.includes("gravel") || name.includes("andesite") || name.includes("diorite") || name.includes("granite")) return "#737b83";
  if (name.includes("dirt") || name.includes("mud") || name.includes("farmland") || name.includes("podzol") || name.includes("path")) return "#8b5e34";
  if (name.includes("clay")) return "#8aa2ad";
  if (name.includes("terracotta")) return "#b45f3c";
  if (name.includes("concrete")) return "#9ca3af";
  if (name.includes("wood") || name.includes("log") || name.includes("planks") || name.includes("stem") || name.includes("hyphae")) return "#9a6a3a";
  if (name.includes("netherrack") || name.includes("crimson")) return "#7f1d1d";
  if (name.includes("warped")) return "#0f766e";
  if (name.includes("soul_sand") || name.includes("soul_soil")) return "#5b4636";
  if (name.includes("basalt") || name.includes("blackstone") || name.includes("bedrock")) return "#27272a";
  if (name.includes("end_stone")) return "#d6d08a";
  if (name.includes("wool") || name.includes("carpet")) return "#e5e7eb";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 38% 58%)`;
}

function overviewCellTip(cell: PlayerOverviewCell) {
  const entities = cellEntities(cell);
  const entityText = entities.length > 0
    ? ` | 实体 ${entities.map(entity => `${entityLabel(entity)} y=${entity.y}`).join("、")}`
    : "";
  return `${cell.block} | 偏移 ${cell.dx}, ${cell.dz} | 高度 y=${cell.y} | 颜色 ${cell.color || "前端回退色"}${entityText}`;
}

function cellEntities(cell: PlayerOverviewCell) {
  return overviewEntitiesByCell.value.get(`${cell.dx}:${cell.dz}`) ?? [];
}

function entityLabel(entity: PlayerOverviewEntity) {
  const categoryText: Record<PlayerOverviewEntity["category"], string> = {
    player: "玩家",
    monster: "怪物",
    animal: "动物",
    item: "物品",
    entity: "实体",
  };
  return `${categoryText[entity.category] || "实体"}:${entity.name || entity.type}`;
}

function entityBeamStyle(entity: PlayerOverviewEntity, index: number) {
  const offset = Math.min(index, 3) * 22;
  const color = entity.color || "#a855f7";
  return {
    "--beam-color": color,
    left: `${50 + offset - Math.min(cellEntities({ dx: entity.dx, dz: entity.dz, y: entity.y, block: entity.type }).length - 1, 3) * 11}%`,
  };
}

function lineOption(labels: string[], series: Array<{ name: string; data: number[]; color: string }>) {
  return {
    tooltip: { ...tooltipStyle.value, trigger: "axis" as const },
    legend: { textStyle: axisLabelStyle(dark.value) },
    grid: { left: 44, right: 20, top: 38, bottom: 32 },
    xAxis: { type: "category" as const, data: labels, axisLabel: axisLabelStyle(dark.value), axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value" as const, ...axisYStyle(dark.value) },
    series: series.map(item => ({ name: item.name, type: "line" as const, data: item.data, smooth: true, showSymbol: false, lineStyle: { color: item.color, width: 2 } })),
  };
}
function barOption(labels: string[], values: number[], color: string) {
  return {
    tooltip: { ...tooltipStyle.value, trigger: "axis" as const },
    grid: { left: 44, right: 20, top: 30, bottom: 32 },
    xAxis: { type: "category" as const, data: labels, axisLabel: axisLabelStyle(dark.value), axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value" as const, ...axisYStyle(dark.value) },
    series: [{ type: "bar" as const, data: values, itemStyle: { color, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 }],
  };
}
const metricLabels = computed(() => metricStats.value.map(row => new Date(row.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));
const metricLineOption = computed(() => lineOption(metricLabels.value, [
  { name: "TPS", data: metricStats.value.map(row => +(row.tps ?? 0).toFixed(1)), color: "#67c23a" },
  { name: "MSPT", data: metricStats.value.map(row => +(row.mtps ?? 0).toFixed(0)), color: "#409eff" },
]));
const playerLineOption = computed(() => lineOption(metricLabels.value, [
  { name: "在线人数", data: metricStats.value.map(row => row.playerCount), color: "#e6a23c" },
]));
const dailyOption = computed(() => lineOption(dailyData.value.map(d => d.label), [{ name: "在线小时", data: dailyData.value.map(d => d.value), color: "#67c23a" }]));
const hourlyOption = computed(() => ({
  tooltip: { ...tooltipStyle.value, trigger: "axis" as const },
  grid: { left: 44, right: 20, top: 30, bottom: 32 },
  xAxis: { type: "category" as const, data: hourlyData.value.map(d => d.label), axisLabel: axisLabelStyle(dark.value), axisTick: { show: false }, axisLine: { show: false } },
  yAxis: { type: "value" as const, ...axisYStyle(dark.value) },
  series: [{
    type: "bar" as const,
    data: hourlyData.value.map((d, index) => ({
      value: d.value,
      itemStyle: { color: index === selectedHour.value ? "#67c23a" : "#409eff", borderRadius: [4, 4, 0, 0] },
    })),
    barMaxWidth: 28,
  }],
}));
const topPlayersOption = computed(() => barOption(topPlayers.value.map(p => p.playerName), topPlayers.value.map(p => +(p.totalSeconds / 3600).toFixed(1)), "#e6a23c"));
const weekdayOption = computed(() => ({
  tooltip: { ...tooltipStyle.value, trigger: "item" as const },
  legend: { bottom: 0, textStyle: axisLabelStyle(dark.value) },
  series: [{ type: "pie" as const, radius: ["38%", "72%"], data: weekdayData.value.filter(d => d.value > 0).map((d, i) => ({ name: d.label, value: d.value, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } })), label: pieLabelStyle(dark.value), labelLine: pieLabelLineStyle(dark.value) }],
}));
const dimensionOption = computed(() => ({
  tooltip: { ...tooltipStyle.value, trigger: "item" as const },
  series: [{ type: "pie" as const, radius: ["38%", "72%"], data: dimensionRows.value.map((d, i) => ({ name: dimensionLabel(d.dimension), value: d.count, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } })), label: pieLabelStyle(dark.value), labelLine: pieLabelLineStyle(dark.value) }],
}));

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
function avatarUrl(uuid: string, size: number) { return `https://mc-heads.net/avatar/${uuid.replace(/-/g, "")}/${size}`; }
function playerAvatarByName(name: string, size: number) {
  const online = onlinePlayers.value.find(player => player.name === name);
  if (online) return avatarUrl(online.uuid, size);
  return `https://mc-heads.net/avatar/${encodeURIComponent(name || "MHF_Steve")}/${size}`;
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
function healthTextForPlayer(player: OnlinePlayer) {
  const health = player.snapshot?.health;
  const max = player.snapshot?.maxHealth;
  if (health == null || max == null) return "未知";
  return `${health.toFixed(0)}/${max.toFixed(0)}`;
}
function healthTagType(state: OnlinePlayer["derived"]["healthState"]) {
  if (state === "danger" || state === "low") return "danger";
  if (state === "healthy") return "success";
  return "info";
}
function movementText(state?: OnlinePlayer["derived"]["movementState"]) {
  if (state === "moving") return "移动";
  if (state === "idle") return "静止";
  return "未知";
}
function eventText(type: string) {
  if (type === "join") return "加入";
  if (type === "leave") return "离开";
  if (type === "death") return "死亡";
  if (type === "debug-playtime") return "时长";
  if (type === "debug-seed") return "测试";
  return type;
}

onMounted(() => {
  loadInitialData().then(scrollChatToBottom);
  timer = setInterval(pollCurrentTab, 3000);
  clockTimer = setInterval(() => { nowTick.value = Date.now(); }, 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (clockTimer) clearInterval(clockTimer);
});

watch(activeTab, () => {
  refreshCurrentTab().then(() => {
    if (activeTab.value === "terminal") scrollChatToBottom();
  });
});

watch(() => terminalTimeline.value.length, async (_next, _prev) => {
  if (activeTab.value !== "terminal") return;
  if (isChatNearBottom()) await scrollChatToBottom();
});
</script>
