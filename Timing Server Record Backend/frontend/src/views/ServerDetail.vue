<template>
  <div class="space-y-6" v-if="server">
    <router-link to="/" class="text-amber-400 hover:text-amber-300 hover:underline text-sm inline-flex items-center gap-1">&larr; 返回仪表盘</router-link>

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
      <GlowCard cardClass="card-stat p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-amber-400">{{ server._count?.sessions ?? "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">会话数</div>
      </GlowCard>
      <GlowCard cardClass="card-stat p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-purple-400">{{ server._count?.events ?? "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">事件数</div>
      </GlowCard>
      <GlowCard cardClass="card-stat p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-blue-400">{{ server.lastHeartbeat ? timeAgo(server.lastHeartbeat) : "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">最后心跳</div>
      </GlowCard>
      <GlowCard cardClass="card-stat p-4 text-center" hoverClass="">
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
      <div v-if="topPlayersData.length > 0">
        <VChart :option="topPlayersOption" autoresize style="height:300px;width:100%" />
      </div>
      <div v-else class="flex items-center justify-center h-[300px] text-gray-500 text-sm">暂无数据</div>
    </GlowCard>
  </div>

  <div v-else class="flex items-center justify-center py-20">
    <div class="text-gray-500 text-sm">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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
  type Server, type StatsPoint, type HourlyStats, type WeekdayStats,
  type TopPlayerStats,
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
  backgroundColor: "#1f2937",
  borderColor: "#374151",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  textStyle: { color: "#e5e7eb", fontSize: 12 },
};

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

const topPlayersOption = computed(() => ({
  tooltip: {
    ...tooltipStyle,
    trigger: "axis" as const,
    axisPointer: { type: "shadow" as const },
    formatter: (p: any) => {
      const item = p[0];
      return `${item.name}<br/>${Number(item.value || 0).toFixed(1)} 小时 · ${topPlayersData.value[item.dataIndex]?.sessions ?? 0} 次会话`;
    },
  },
  grid: { left: 80, right: 40, top: 8, bottom: 8 },
  xAxis: { type: "value" as const, name: "h", nameTextStyle: { color: "#9ca3af", fontSize: 11 }, axisLabel: { color: "#9ca3af", fontSize: 11 }, splitLine: { lineStyle: { color: "#374151", opacity: 0.5 } } },
  yAxis: {
    type: "category" as const,
    data: topPlayersData.value.map(p => p.name),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#9ca3af", fontSize: 11 },
  },
  series: [{
    type: "bar" as const,
    data: topPlayersData.value.map(p => p.hours),
    barMaxWidth: 24,
    itemStyle: {
      color: { type: "linear" as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "#34d399" }, { offset: 1, color: "#2dd4bf" }] },
      borderRadius: [0, 4, 4, 0],
    },
    label: {
      show: true,
      position: "right" as const,
      color: "#9ca3af",
      fontSize: 11,
      formatter: (p: any) => `${Number(p.value || 0).toFixed(1)}h`,
    },
  }],
}));

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
});
</script>
