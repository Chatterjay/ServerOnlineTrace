<template>
  <div class="space-y-6" v-if="player">
    <router-link to="/"
      class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all text-gray-500 hover:text-gray-300"
      :style="{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }">
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 12L6 8l4-4"/></svg>
      返回
    </router-link>

    <GlowCard cardClass="card card-deco-bar card-deco-corner p-4 sm:p-6" hoverClass="">
      <div class="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5">
        <img :src="`https://mc-heads.net/avatar/${(player?.uuid || '').replace(/-/g, '')}/100`" :alt="player.name"
          class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl ring-2 ring-gray-700 shrink-0"
          @error="(e: any) => { if (!e.target.src.includes('MHF_Steve')) e.target.src = 'https://mc-heads.net/avatar/MHF_Steve/100'; }" />
        <div class="text-center sm:text-left min-w-0 flex-1">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-200 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
            {{ player.name }}
            <span class="text-xs font-mono text-gray-500 font-normal truncate max-w-full">{{ player.uuid }}</span>
          </h2>
          <p class="text-xs sm:text-sm text-gray-500 mt-1">总在线 {{ totalHours }} 小时 · 首次记录 {{ new Date(player.firstSeen).toLocaleDateString() }}</p>
        </div>
        <img :src="`https://mc-heads.net/body/${(player?.uuid || '').replace(/-/g, '')}/64`" alt=""
          class="hidden sm:block w-16 h-24 opacity-60" />
      </div>
    </GlowCard>

    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <GlowCard cardClass="card-stat card-stat-accent-amber p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-amber-400">{{ totalHours }}h</div>
        <div class="text-xs text-gray-500 mt-1">总在线</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-green p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-green-400">{{ activeDays }}天</div>
        <div class="text-xs text-gray-500 mt-1">活跃天数</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-blue p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-blue-400">{{ activeDays > 0 ? fmt(avgDaily) : "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">日均在线</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-purple p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-purple-400">{{ peakHour !== null ? `${peakHour}:00` : "-" }}</div>
        <div class="text-xs text-gray-500 mt-1">最活跃时段</div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-pink p-4 text-center" hoverClass="">
        <div class="text-xl sm:text-2xl font-bold text-pink-400">{{ player.stats?.deaths ?? 0 }}</div>
        <div class="text-xs text-gray-500 mt-1">死亡总数</div>
      </GlowCard>
    </div>

    <div class="flex gap-1 bg-gray-800/30 rounded-lg p-1 border border-gray-700/30 overflow-x-auto w-fit animate-fade-in-d1">
      <button v-for="tab in tabs" :key="tab.key" @click="chartTab = tab.key"
        class="cursor-pointer px-4 py-2 text-sm rounded-md transition-all whitespace-nowrap"
        :class="chartTab === tab.key ? 'bg-amber-500/20 text-amber-400 font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'">
        {{ tab.label }}
      </button>
    </div>

    <GlowCard cardClass="card card-deco-side card-deco-foot p-4 sm:p-6" hoverClass="">
      <template v-if="chartTab === 'daily'">
        <h3 class="text-base font-semibold mb-4 text-gray-200 deco-title">近 30 天每日在线时长</h3>
        <VChart :option="dailyOption" autoresize style="height:260px;width:100%" />
      </template>
      <template v-if="chartTab === 'weekly'">
        <h3 class="text-base font-semibold mb-4 text-gray-200 deco-title">近 12 周每周在线时长</h3>
        <VChart :option="weeklyOption" autoresize style="height:260px;width:100%" />
      </template>
      <template v-if="chartTab === 'hourly'">
        <h3 class="text-base font-semibold mb-4 text-gray-200 deco-title">24 小时活跃时段分布</h3>
        <VChart :option="hourlyOption" autoresize style="height:200px;width:100%" />
        <div class="flex justify-between text-xs text-gray-600 mt-2 px-2">
          <span>0点</span><span>4点</span><span>8点</span><span>12点</span><span>16点</span><span>20点</span><span>24点</span>
        </div>
      </template>
    </GlowCard>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-fade-in-d2">
      <GlowCard cardClass="card card-deco-dash card-deco-ring p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-4 text-gray-200 deco-title">星期分布</h3>
        <div v-if="weekdayData.some(d => d.hours > 0)">
          <VChart :option="weekdayOption" autoresize style="height:260px;width:100%" />
        </div>
        <div v-else class="flex items-center justify-center h-[260px] text-gray-500 text-sm">暂无数据</div>
      </GlowCard>
      <GlowCard cardClass="card card-deco-bar card-deco-corner p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-4 text-gray-200 deco-title">每日曲线</h3>
        <VChart :option="dailyOption2" autoresize style="height:260px;width:100%" />
      </GlowCard>
    </div>

    <GlowCard cardClass="card card-deco-side card-deco-ring p-4 space-y-3 animate-fade-in-d3" hoverClass="" radius="12px">
      <h3 class="text-lg font-semibold text-gray-200 deco-title">最近会话</h3>
      <div class="card-list">
        <div class="min-w-[520px]">
          <div v-for="s in player.recentSessions" :key="s.id"
            class="flex items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3 border-b border-gray-700/50 last:border-0 text-xs sm:text-sm hover:bg-gray-700/30 transition-colors">
            <span class="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span class="text-gray-300 w-16 sm:w-24 shrink-0 truncate">{{ s.server.name }}</span>
            <span class="text-gray-500 whitespace-nowrap">{{ new Date(s.joinTime).toLocaleString() }}</span>
            <span class="text-gray-600 shrink-0">&rarr;</span>
            <span class="text-gray-500 whitespace-nowrap">{{ s.leaveTime ? new Date(s.leaveTime).toLocaleString() : "在线中" }}</span>
            <span class="ml-auto text-gray-400 font-mono shrink-0">{{ fmt(s.durationSeconds) }}</span>
          </div>
          <div v-if="player.recentSessions.length === 0" class="p-6 text-gray-500 text-center text-sm">暂无会话</div>
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
  CalendarComponent,
} from "echarts/components";
import VChart from "vue-echarts";
import GlowCard from "../components/GlowCard.vue";
import { CHART_COLORS, useTheme, useTooltipStyle, axisLabelStyle, axisYStyle, pieLabelStyle, pieLabelLineStyle } from "../composables/useChartTheme";
import {
  fetchPlayer, fetchPlayerDailyStats, fetchPlayerWeeklyStats,
  fetchPlayerHourlyStats, fetchPlayerWeekdayStats,
  type PlayerProfile, type StatsPoint, type HourlyStats, type WeekdayStats,
} from "../api/index.js";

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CalendarComponent]);

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const dark = useTheme();
const tooltipStyle = useTooltipStyle();

const route = useRoute();
const uuid = route.params.uuid as string;

const player = ref<PlayerProfile | null>(null);
const dailyStats = ref<StatsPoint[]>([]);
const weeklyStats = ref<StatsPoint[]>([]);
const hourlyStats = ref<HourlyStats[]>([]);
const weekdayStats = ref<WeekdayStats[]>([]);
const chartTab = ref<"daily" | "weekly" | "hourly">("daily");

const tabs = [
  { key: "daily" as const, label: "每日趋势" },
  { key: "weekly" as const, label: "每周趋势" },
  { key: "hourly" as const, label: "时段分布" },
];

const fmt = (sec: number | null) => {
  if (!sec) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const totalHours = computed(() => player.value ? (player.value.stats.totalPlayTime > 0 ? (player.value.stats.totalPlayTime / 3600).toFixed(1) : "0") : "0");

const activeDays = computed(() => dailyStats.value.filter(d => d.totalSeconds > 0).length);

const avgDaily = computed(() => {
  if (activeDays.value === 0) return 0;
  return dailyStats.value.reduce((s, d) => s + d.totalSeconds, 0) / activeDays.value;
});

const peakHour = computed(() => {
  if (hourlyStats.value.length === 0) return null;
  return hourlyStats.value.reduce((b, h) => h.totalSeconds > (b?.totalSeconds || 0) ? h : b, hourlyStats.value[0]).hour;
});

const dailyData = computed(() => dailyStats.value.map(d => ({ date: d.date.slice(5), hours: +(d.totalSeconds / 3600).toFixed(1) })));
const weeklyData = computed(() => weeklyStats.value.map(w => ({ week: w.date.slice(5), hours: +(w.totalSeconds / 3600).toFixed(1) })));
const hourlyData = computed(() => {
  return Array.from({ length: 24 }, (_, i) => {
    const found = hourlyStats.value.find(h => h.hour === i);
    return { hour: `${i.toString().padStart(2, "0")}:00`, hours: found ? +(found.totalSeconds / 3600).toFixed(2) : 0 };
  });
});
const weekdayData = computed(() => WEEKDAY_NAMES.map((name, i) => {
  const found = weekdayStats.value.find(w => w.day === i);
  return { name, hours: found ? +(found.totalSeconds / 3600).toFixed(1) : 0 };
}));


const dailyOption = computed(() => {
  const al = axisLabelStyle(dark.value);
  const ay = axisYStyle(dark.value);
  return {
    tooltip: { ...tooltipStyle.value, trigger: "axis" as const, formatter: (p: any) => `${Number(p[0]?.value || 0).toFixed(1)} 小时` },
    grid: { left: 40, right: 16, top: 8, bottom: 20 },
    xAxis: { type: "category" as const, data: dailyData.value.map(d => d.date), axisLine: { show: false }, axisTick: { show: false }, axisLabel: al },
    yAxis: { type: "value" as const, name: "h", ...ay },
    series: [{
      type: "line" as const, data: dailyData.value.map(d => d.hours),
      smooth: true, showSymbol: false,
      lineStyle: { color: "#fbbf24", width: 2 },
      areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(251,191,36,0.25)" }, { offset: 1, color: "rgba(251,191,36,0)" }] } },
    }],
  };
});

const weeklyOption = computed(() => {
  const al = axisLabelStyle(dark.value);
  const ay = axisYStyle(dark.value);
  return {
    tooltip: { ...tooltipStyle.value, trigger: "axis" as const, formatter: (p: any) => `${Number(p[0]?.value || 0).toFixed(1)} 小时` },
    grid: { left: 40, right: 16, top: 8, bottom: 20 },
    xAxis: { type: "category" as const, data: weeklyData.value.map(w => w.week), axisLine: { show: false }, axisTick: { show: false }, axisLabel: al },
    yAxis: { type: "value" as const, name: "h", ...ay },
    series: [{
      type: "bar" as const, data: weeklyData.value.map(w => w.hours),
      itemStyle: { color: "#34d399", borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 40,
    }],
  };
});

const hourlyOption = computed(() => ({
  tooltip: { ...tooltipStyle.value, trigger: "axis" as const, formatter: (p: any) => `${Number(p[0]?.value || 0).toFixed(1)} 小时` },
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
  tooltip: { ...tooltipStyle.value, trigger: "item" as const, formatter: (p: any) => `${p.name}: ${Number(p.value || 0).toFixed(1)} 小时` },
  series: [{
    type: "pie" as const,
    data: weekdayData.value.filter(d => d.hours > 0).map((d, i) => ({ value: d.hours, name: d.name, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } })),
    center: ["50%", "50%"],
    radius: ["0%", "70%"],
    label: { ...pieLabelStyle(dark.value), formatter: (p: any) => `${p.name} ${Number(p.value || 0).toFixed(1)}h` },
    labelLine: pieLabelLineStyle(dark.value),
  }],
}));

const dailyOption2 = computed(() => {
  const al = axisLabelStyle(dark.value);
  const ay = axisYStyle(dark.value);
  return {
    tooltip: { ...tooltipStyle.value, trigger: "axis" as const, formatter: (p: any) => `${Number(p[0]?.value || 0).toFixed(1)} 小时` },
    grid: { left: 36, right: 16, top: 8, bottom: 20 },
    xAxis: { type: "category" as const, data: dailyData.value.map(d => d.date), axisLine: { show: false }, axisTick: { show: false }, axisLabel: al },
    yAxis: { type: "value" as const, name: "h", ...ay },
    series: [{
      type: "line" as const, data: dailyData.value.map(d => d.hours),
      smooth: true, showSymbol: false,
      lineStyle: { color: "#34d399", width: 2 },
      areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(52,211,153,0.2)" }, { offset: 1, color: "rgba(52,211,153,0)" }] } },
    }],
  };
});

let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  if (!uuid) return;
  player.value = await fetchPlayer(uuid);
  dailyStats.value = await fetchPlayerDailyStats(uuid);
  weeklyStats.value = await fetchPlayerWeeklyStats(uuid);
  hourlyStats.value = await fetchPlayerHourlyStats(uuid);
  weekdayStats.value = await fetchPlayerWeekdayStats(uuid);
}

onMounted(() => {
  load();
  timer = setInterval(load, 30000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
