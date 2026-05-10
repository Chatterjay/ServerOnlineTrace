<template>
  <div class="space-y-6" v-if="server">
    <router-link to="/"
      class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all text-gray-500 hover:text-gray-300"
      :style="{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }">
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 12L6 8l4-4"/></svg>
      返回
    </router-link>

    <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
      <div class="flex items-center gap-3 sm:gap-4">
        <span class="w-3 h-3 rounded-full shrink-0" :class="server.status === 'online' ? 'bg-green-400 live-dot' : 'bg-gray-600'" />
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-200 flex items-center gap-3">
            {{ server.name }}
            <span class="text-xs font-mono text-gray-500 font-normal">{{ server.id.slice(0, 8) }}...</span>
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ server.address || "未知地址" }}
            <span v-if="server.lastHeartbeat" class="ml-3">最后心跳 {{ timeAgo(server.lastHeartbeat) }}</span>
          </p>
          <p v-if="server.gameMode || server.modLoader || server.modVersion || server.gameVersion" class="text-xs text-gray-600 mt-2 flex items-center gap-3 flex-wrap">
            <span v-if="server.gameVersion" class="inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M4 2v12M12 2v12M1.5 6h13M1.5 10h13" />
              </svg>
              MC {{ server.gameVersion }}
            </span>
            <span v-if="server.gameMode" class="inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2" /><circle cx="8" cy="8" r="2" />
              </svg>
              {{ gameModeLabel(server.gameMode) }}
            </span>
            <span v-if="server.modLoader" class="inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM4 6h8M4 9h5" />
              </svg>
              {{ server.modLoader }}
            </span>
            <span v-if="server.modVersion" class="inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="8" cy="8" r="5" /><path d="M8 5v3l2 1" stroke-linecap="round" />
              </svg>
              v{{ server.modVersion }}
            </span>
          </p>
        </div>
      </div>
    </GlowCard>

    <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
      <h3 class="text-base font-semibold mb-3 text-gray-200">备注</h3>
      <div class="flex gap-2">
        <input
          v-model="noteText"
          type="text"
          placeholder="添加备注..."
          class="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-amber-500/50 transition-colors"
          @keyup.enter="saveNote"
        />
        <button @click="saveNote"
          class="cursor-pointer px-4 py-2 text-sm rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors font-medium shrink-0">
          保存
        </button>
      </div>
      <p v-if="noteSaved" class="text-green-400 text-xs mt-2">备注已保存</p>
    </GlowCard>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <GlowCard cardClass="card-stat card-stat-accent-amber p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-amber-400">{{ server._count?.sessions ?? "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">会话数</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-purple p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-purple-400">{{ server._count?.events ?? "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">事件数</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-blue p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-blue-400">{{ server.lastHeartbeat ? timeAgo(server.lastHeartbeat) : "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">最后心跳</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-green p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-green-400">{{ new Date(server.firstSeen).toLocaleDateString() }}</div>
        <div class="text-xs text-gray-500 mt-1">首次记录</div>
      </GlowCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-fade-in-d1">
      <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-4 text-gray-200">时段分布 (24h)</h3>
        <VChart :option="hourlyOption" autoresize style="height:200px;width:100%" />
        <div class="flex justify-between text-xs text-gray-600 mt-2 px-2">
          <span>0点</span><span>4点</span><span>8点</span><span>12点</span><span>16点</span><span>20点</span><span>24点</span>
        </div>
      </GlowCard>
      <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-4 text-gray-200">星期分布</h3>
        <div v-if="weekdayData.some(d => d.hours > 0)">
          <VChart :option="weekdayOption" autoresize style="height:260px;width:100%" />
        </div>
        <div v-else class="flex items-center justify-center h-[260px] text-gray-500 text-sm">暂无数据</div>
      </GlowCard>
    </div>

    <GlowCard cardClass="card p-4 sm:p-6 animate-fade-in-d2" hoverClass="">
      <h3 class="text-base font-semibold mb-4 text-gray-200">每日趋势 (近 30 天)</h3>
      <VChart :option="dailyOption" autoresize style="height:260px;width:100%" />
    </GlowCard>

    <GlowCard cardClass="card p-4 sm:p-6 animate-fade-in-d3" hoverClass="">
      <h3 class="text-base font-semibold mb-4 text-gray-200">玩家活跃排行</h3>
      <div v-if="topPlayersData.length > 0" class="space-y-1">
        <div v-for="(p, i) in topPlayersData" :key="p.uuid"
          class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700/30 transition-colors">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            :class="rankBadge(i)">
            {{ i + 1 }}
          </div>
          <img :src="`https://mc-heads.net/avatar/${p.uuid.replace(/-/g, '')}/24`" alt=""
            class="w-6 h-6 rounded shrink-0" />
          <router-link :to="`/players/${p.uuid}`"
            class="text-sm text-gray-200 hover:text-amber-400 truncate min-w-0 flex-1">
            {{ p.name }}
          </router-link>
          <span class="text-xs text-gray-400 font-mono shrink-0 whitespace-nowrap">{{ p.hours }}h</span>
          <span class="text-xs text-gray-500 shrink-0 whitespace-nowrap">{{ p.sessions }}次会话</span>
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-[200px] text-gray-500 text-sm">暂无数据</div>
    </GlowCard>

    <GlowCard cardClass="card p-4 sm:p-6 animate-fade-in-d3" hoverClass="">
      <h3 class="text-base font-semibold mb-4 text-gray-200 flex items-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 3h12v10H2zM5 7h6M5 9.5h4" stroke-linecap="round" />
        </svg>
        服务器控制台
        <span class="text-xs text-gray-600 font-normal">玩家等级 · 可输入文字聊天或 / 开头执行指令</span>
      </h3>
      <div class="terminal-box">
        <div class="terminal-output" ref="terminalRef">
          <div v-for="entry in terminalEntries" :key="entry.id" class="terminal-line">
            <template v-if="entry.type === 'command'">
              <span class="terminal-prompt">&gt;</span>
              <span class="terminal-cmd">{{ entry.text }}</span>
            </template>
            <template v-else>
              <span class="text-green-400/80 font-medium">{{ entry.playerName }}</span>
              <span class="text-gray-400">: {{ entry.text }}</span>
            </template>
            <span class="terminal-time">{{ entry.timestamp.toLocaleTimeString() }}</span>
          </div>
          <div v-if="terminalEntries.length === 0" class="terminal-line text-gray-600">暂无聊天或指令记录</div>
        </div>
        <form @submit.prevent="doSendCommand" class="terminal-input-row">
          <span class="terminal-prompt">&gt;</span>
          <input
            ref="inputRef"
            v-model="commandText"
            placeholder="聊天或输入指令..."
            class="terminal-input"
            :disabled="sending"
          />
          <button type="submit" :disabled="!commandText.trim() || sending"
            class="terminal-btn">发送</button>
        </form>
        <button @click="showHints = !showHints"
          class="w-full text-xs py-1.5 text-center transition-colors border-t border-gray-700/30"
          :class="showHints ? 'text-amber-500/70' : 'text-gray-600 hover:text-gray-500'">
          {{ showHints ? '收起指令提示 ▲' : '指令提示 ▼' }}
        </button>
        <div v-show="showHints" class="px-4 py-3 space-y-1.5 text-sm">
          <div class="text-gray-400 font-medium mb-1.5">直接输入文字 → 以 §7[网站] §f前缀广播聊天</div>
          <div class="flex flex-wrap gap-x-6 gap-y-1.5 text-gray-400">
            <span><code class="text-gray-300">/msg &lt;玩家&gt; &lt;内容&gt;</code> 私聊</span>
            <span><code class="text-gray-300">/list</code> 在线列表</span>
            <span><code class="text-gray-300">/help</code> 帮助</span>
            <span><code class="text-gray-300">/me &lt;动作&gt;</code> 表情</span>
          </div>
        </div>
      </div>
    </GlowCard>
  </div>

  <div v-else class="flex items-center justify-center py-20">
    <div class="text-gray-500 text-sm">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, LegendComponent,
} from "echarts/components";
import VChart from "vue-echarts";
import GlowCard from "../components/GlowCard.vue";
import {
  fetchServer, updateServerNote, fetchServerDailyStats,
  fetchServerHourlyStats, fetchServerWeekdayStats, fetchServerTopPlayers,
  sendCommand, fetchCommands, fetchChatMessages,
  type Server, type StatsPoint, type HourlyStats, type WeekdayStats,
  type TopPlayerStats, type QueuedCommand, type ChatMessage,
} from "../api/index.js";

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const PIE_COLORS = ["#34d399", "#fbbf24", "#818cf8", "#f472b6", "#fb923c", "#a78bfa", "#2dd4bf", "#f87171"];

const route = useRoute();
const server = ref<Server | null>(null);
const noteText = ref("");
const noteSaved = ref(false);
const dailyStats = ref<StatsPoint[]>([]);
const hourlyStats = ref<HourlyStats[]>([]);
const weekdayStats = ref<WeekdayStats[]>([]);
const topPlayers = ref<TopPlayerStats[]>([]);

const fmt = (sec: number | null) => {
  if (!sec) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

async function load() {
  const id = route.params.id as string;
  const data = await fetchServer(id);
  server.value = data;
  noteText.value = data.note;
}

async function saveNote() {
  if (!server.value) return;
  await updateServerNote(server.value.id, noteText.value);
  server.value.note = noteText.value;
  noteSaved.value = true;
  setTimeout(() => { noteSaved.value = false; }, 2000);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const h = Math.floor(min / 60);
  return `${h}小时前`;
}

const dailyData = computed(() =>
  dailyStats.value.map(d => ({ date: d.date.slice(5), hours: +(d.totalSeconds / 3600).toFixed(1) }))
);

const hourlyData = computed(() => {
  return Array.from({ length: 24 }, (_, i) => {
    const found = hourlyStats.value.find(h => h.hour === i);
    return { hour: `${i.toString().padStart(2, "0")}:00`, hours: found ? +(found.totalSeconds / 3600).toFixed(2) : 0 };
  });
});

const weekdayData = computed(() =>
  WEEKDAY_NAMES.map((name, i) => {
    const found = weekdayStats.value.find(w => w.day === i);
    return { name, hours: found ? +(found.totalSeconds / 3600).toFixed(1) : 0 };
  })
);

const topPlayersData = computed(() =>
  topPlayers.value.map(p => ({
    name: p.playerName,
    hours: +(p.totalSeconds / 3600).toFixed(1),
    sessions: p.sessionCount,
    uuid: p.playerUuid,
  }))
);

const tooltipStyle = {
  backgroundColor: "rgba(17,24,39,0.95)",
  borderColor: "rgba(139,92,246,0.25)",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  textStyle: { color: "#e5e7eb", fontSize: 12 },
};

const rankBadge = (i: number) => {
  if (i === 0) return "bg-amber-500/20 text-amber-400";
  if (i === 1) return "bg-gray-400/20 text-gray-300";
  if (i === 2) return "bg-orange-500/20 text-orange-400";
  return "bg-gray-700/50 text-gray-500";
};

const gameModeLabel = (mode: string) => {
  const map: Record<string, string> = {
    survival: "生存模式",
    creative: "创造模式",
    adventure: "冒险模式",
    spectator: "旁观模式",
  };
  return map[mode] || mode;
};

const commandText = ref("");
const commandHistory = ref<QueuedCommand[]>([]);
const chatMessages = ref<ChatMessage[]>([]);
const sending = ref(false);
const showHints = ref(false);
const terminalRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

const terminalEntries = computed(() => {
  const entries: { id: string; type: "command" | "chat"; text: string; playerName?: string; timestamp: Date }[] = [];
  for (const cmd of commandHistory.value) {
    entries.push({ id: cmd.id, type: "command", text: cmd.command, timestamp: new Date(cmd.timestamp) });
  }
  for (const chat of chatMessages.value) {
    entries.push({ id: chat.id, type: "chat", text: chat.message, playerName: chat.playerName, timestamp: new Date(chat.timestamp) });
  }
  entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return entries;
});

async function loadCommands() {
  const id = route.params.id as string;
  if (!id) return;
  commandHistory.value = await fetchCommands(id);
}

async function loadChat() {
  const id = route.params.id as string;
  if (!id) return;
  chatMessages.value = await fetchChatMessages(id);
}

function scrollTerminal() {
  setTimeout(() => {
    if (terminalRef.value) {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
    }
  }, 50);
}

async function doSendCommand() {
  const text = commandText.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  try {
    const cmd = await sendCommand(route.params.id as string, text);
    commandHistory.value.push(cmd);
    commandText.value = "";
    scrollTerminal();
  } catch {
    // ignore
  } finally {
    sending.value = false;
    setTimeout(() => inputRef.value?.focus(), 100);
  }
}

const dailyOption = computed(() => ({
  tooltip: { ...tooltipStyle, trigger: "axis" as const, formatter: (p: any) => `${Number(p[0]?.value || 0).toFixed(1)} 小时` },
  grid: { left: 40, right: 16, top: 8, bottom: 20 },
  xAxis: { type: "category" as const, data: dailyData.value.map(d => d.date), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#9ca3af", fontSize: 11 } },
  yAxis: { type: "value" as const, name: "h", nameTextStyle: { color: "#9ca3af", fontSize: 11 }, axisLabel: { color: "#9ca3af", fontSize: 11 }, splitLine: { lineStyle: { color: "#374151", opacity: 0.5 } } },
  series: [{
    type: "line" as const, data: dailyData.value.map(d => d.hours),
    smooth: true, showSymbol: false,
    lineStyle: { color: "#fbbf24", width: 2 },
    areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(251,191,36,0.25)" }, { offset: 1, color: "rgba(251,191,36,0)" }] } },
  }],
}));

const hourlyOption = computed(() => ({
  tooltip: { ...tooltipStyle, trigger: "axis" as const, formatter: (p: any) => `${Number(p[0]?.value || 0).toFixed(1)} 小时` },
  grid: { left: 4, right: 4, top: 4, bottom: 0 },
  xAxis: { type: "category" as const, data: hourlyData.value.map(h => h.hour), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
  yAxis: { type: "value" as const, show: false },
  series: [{
    type: "bar" as const, data: hourlyData.value.map(h => h.hours),
    itemStyle: { color: "#818cf8", borderRadius: [2, 2, 0, 0] },
    barMaxWidth: 20,
  }],
}));

const weekdayOption = computed(() => ({
  tooltip: { ...tooltipStyle, trigger: "item" as const, formatter: (p: any) => `${p.name}: ${Number(p.value || 0).toFixed(1)} 小时` },
  series: [{
    type: "pie" as const,
    data: weekdayData.value.filter(d => d.hours > 0).map((d, i) => ({ value: d.hours, name: d.name, itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] } })),
    center: ["50%", "50%"],
    radius: ["0%", "70%"],
    label: { color: "#9ca3af", fontSize: 11, formatter: (p: any) => `${p.name} ${Number(p.value || 0).toFixed(1)}h` },
    labelLine: { lineStyle: { color: "#4b5563" } },
  }],
}));

let cmdTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await load();
  const id = route.params.id as string;
  if (!id) return;
  [dailyStats.value, hourlyStats.value, weekdayStats.value, topPlayers.value] = await Promise.all([
    fetchServerDailyStats(id),
    fetchServerHourlyStats(id),
    fetchServerWeekdayStats(id),
    fetchServerTopPlayers(id),
  ]);
  await loadCommands();
  await loadChat();
  cmdTimer = setInterval(() => {
    load();
    loadCommands();
    loadChat();
  }, 5000);
});

onUnmounted(() => {
  if (cmdTimer) clearInterval(cmdTimer);
});
</script>
