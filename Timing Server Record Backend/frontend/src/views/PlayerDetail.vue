<template>
  <section v-if="player" class="ts-page">
    <div class="ts-page-head">
      <div>
        <el-space wrap>
          <el-button text @click="router.back()">返回上一页</el-button>
          <el-button text @click="router.push('/')">返回总览</el-button>
        </el-space>
        <h1>{{ player.name }}</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert v-if="connectionError" :title="connectionError" type="warning" show-icon :closable="false" />

    <div class="ts-detail-grid">
      <aside class="ts-control-column">
        <el-card shadow="never">
          <template #header>玩家资料</template>
          <div class="ts-player-card">
            <el-avatar :src="avatarUrl(player.uuid, 96)" shape="square" :size="96" />
            <el-tag :type="profileTagType">{{ profileLabel }}</el-tag>
          </div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="UUID">{{ player.uuid }}</el-descriptions-item>
            <el-descriptions-item label="首次记录">{{ formatDateTime(player.firstSeen) }}</el-descriptions-item>
            <el-descriptions-item label="最后出现">{{ timeAgo(player.lastSeen) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>最新快照</template>
          <el-descriptions v-if="player.latestSnapshot" :column="1" border>
            <el-descriptions-item label="维度">{{ dimensionLabel(player.latestSnapshot.dimension) }}</el-descriptions-item>
            <el-descriptions-item label="坐标">{{ snapshotPosition(player.latestSnapshot) }}</el-descriptions-item>
            <el-descriptions-item label="生命">{{ player.latestSnapshot.health ?? "-" }} / {{ player.latestSnapshot.maxHealth ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="饥饿">{{ player.latestSnapshot.foodLevel ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="等级">{{ player.latestSnapshot.experienceLevel ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="延迟">{{ player.latestSnapshot.latency ?? "-" }}ms</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="暂无快照" />
        </el-card>
      </aside>

      <main class="ts-content-column">
        <el-row :gutter="12">
          <el-col v-for="card in statCards" :key="card.label" :xs="12" :md="4">
            <el-card shadow="never" class="ts-metric">
              <div class="ts-metric-value">{{ card.value }}</div>
              <div class="ts-metric-label">{{ card.label }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" class="ts-workbench">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="画像" name="profile">
              <el-table :data="insights" height="420" stripe>
                <el-table-column prop="label" label="判断" width="130" />
                <el-table-column prop="value" label="说明" show-overflow-tooltip />
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="趋势" name="trend">
              <div class="ts-two-charts">
                <section>
                  <h3>每日在线折线</h3>
                  <VChart :option="dailyOption" autoresize class="ts-chart-lg" />
                </section>
                <section>
                  <h3>每周在线柱状</h3>
                  <VChart :option="weeklyOption" autoresize class="ts-chart-lg" />
                </section>
              </div>
            </el-tab-pane>
            <el-tab-pane label="分布" name="distribution">
              <div class="ts-two-charts">
                <section>
                  <h3>24 小时分布</h3>
                  <VChart :option="hourlyOption" autoresize class="ts-chart-lg" />
                </section>
                <section>
                  <h3>星期占比</h3>
                  <VChart :option="weekdayOption" autoresize class="ts-chart-lg" />
                </section>
              </div>
            </el-tab-pane>
            <el-tab-pane label="会话" name="sessions">
              <el-table :data="player.recentSessions" height="520" stripe row-key="id">
                <el-table-column label="服务器" min-width="180" show-overflow-tooltip><template #default="{ row }">{{ row.server.note || row.server.name }}</template></el-table-column>
                <el-table-column label="开始" width="180"><template #default="{ row }">{{ formatDateTime(row.joinTime) }}</template></el-table-column>
                <el-table-column label="结束" width="180"><template #default="{ row }">{{ row.leaveTime ? formatDateTime(row.leaveTime) : "在线中" }}</template></el-table-column>
                <el-table-column label="时长" width="130"><template #default="{ row }">{{ formatDuration(row.durationSeconds) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </main>
    </div>
  </section>

  <el-empty v-else :description="connectionError || '加载中...'" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Refresh } from "@element-plus/icons-vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
import { CHART_COLORS, axisLabelStyle, axisYStyle, pieLabelLineStyle, pieLabelStyle, useTheme, useTooltipStyle } from "../composables/useChartTheme";
import { fetchPlayer, fetchPlayerDailyStats, fetchPlayerHourlyStats, fetchPlayerWeekdayStats, fetchPlayerWeeklyStats, type HourlyStats, type PlayerProfile, type PlayerSnapshot, type StatsPoint, type WeekdayStats } from "../api/index.js";

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

type PlayerTab = "profile" | "trend" | "distribution" | "sessions";

const route = useRoute();
const router = useRouter();
const uuid = route.params.uuid as string;
const dark = useTheme();
const tooltipStyle = useTooltipStyle();
const player = ref<PlayerProfile | null>(null);
const dailyStats = ref<StatsPoint[]>([]);
const weeklyStats = ref<StatsPoint[]>([]);
const hourlyStats = ref<HourlyStats[]>([]);
const weekdayStats = ref<WeekdayStats[]>([]);
const activeTab = ref<PlayerTab>("profile");
const connectionError = ref("");
const loading = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const totalSeconds = computed(() => player.value?.stats.totalPlayTime ?? 0);
const activeDays = computed(() => dailyStats.value.filter(d => d.totalSeconds > 0).length);
const avgDaily = computed(() => activeDays.value ? totalSeconds.value / activeDays.value : 0);
const peakHour = computed(() => {
  if (hourlyStats.value.length === 0) return null;
  const best = hourlyStats.value.reduce((a, b) => b.totalSeconds > a.totalSeconds ? b : a, hourlyStats.value[0]);
  return best.totalSeconds > 0 ? best.hour : null;
});
const favoriteWeekday = computed(() => {
  if (weekdayStats.value.length === 0) return "暂无";
  const best = weekdayStats.value.reduce((a, b) => b.totalSeconds > a.totalSeconds ? b : a, weekdayStats.value[0]);
  return best.totalSeconds > 0 ? WEEKDAY_NAMES[best.day] : "暂无";
});
const daysSinceLastSeen = computed(() => player.value?.lastSeen ? Math.floor((Date.now() - new Date(player.value.lastSeen).getTime()) / 86_400_000) : 9999);
const profileLabel = computed(() => {
  if (totalSeconds.value < 3600) return "新玩家";
  if (daysSinceLastSeen.value >= 14) return "回流风险";
  if (activeDays.value >= 12 || totalSeconds.value >= 72 * 3600) return "高活跃";
  if (activeDays.value >= 4) return "稳定活跃";
  return "轻度活跃";
});
const profileTagType = computed(() => profileLabel.value === "回流风险" ? "warning" : profileLabel.value === "新玩家" ? "info" : "success");
const statCards = computed(() => [
  { label: "总在线", value: formatDuration(totalSeconds.value) },
  { label: "活跃天数", value: `${activeDays.value} 天` },
  { label: "日均", value: formatDuration(avgDaily.value) },
  { label: "偏好时段", value: peakHour.value == null ? "暂无" : `${peakHour.value}:00` },
  { label: "偏好星期", value: favoriteWeekday.value },
  { label: "死亡", value: player.value?.stats.deaths ?? 0 },
]);
const insights = computed(() => [
  { label: "活跃分层", value: `当前判断为 ${profileLabel.value}。` },
  { label: "时间偏好", value: `常见时段 ${peakHour.value == null ? "暂无" : `${peakHour.value}:00`}，星期偏好 ${favoriteWeekday.value}。` },
  { label: "留存状态", value: daysSinceLastSeen.value >= 14 ? `已 ${daysSinceLastSeen.value} 天未出现。` : `最近 ${Math.max(0, daysSinceLastSeen.value)} 天内出现过。` },
  { label: "数据质量", value: `${player.value?._count?.sessions ?? 0} 条会话，${player.value?._count?.events ?? 0} 条事件。` },
]);
const dailyData = computed(() => dailyStats.value.map(d => ({ label: d.date.slice(5), value: +(d.totalSeconds / 3600).toFixed(1) })));
const weeklyData = computed(() => weeklyStats.value.map(w => ({ label: w.date.slice(5), value: +(w.totalSeconds / 3600).toFixed(1) })));
const hourlyData = computed(() => Array.from({ length: 24 }, (_, hour) => {
  const found = hourlyStats.value.find(h => h.hour === hour);
  return { label: `${String(hour).padStart(2, "0")}:00`, value: found ? +(found.totalSeconds / 3600).toFixed(2) : 0 };
}));
const weekdayData = computed(() => WEEKDAY_NAMES.map((name, day) => {
  const found = weekdayStats.value.find(w => w.day === day);
  return { label: name, value: found ? +(found.totalSeconds / 3600).toFixed(1) : 0 };
}));

async function load() {
  loading.value = true;
  try {
    const [profile, daily, weekly, hourly, weekday] = await Promise.all([
      fetchPlayer(uuid),
      fetchPlayerDailyStats(uuid),
      fetchPlayerWeeklyStats(uuid),
      fetchPlayerHourlyStats(uuid),
      fetchPlayerWeekdayStats(uuid),
    ]);
    player.value = profile;
    dailyStats.value = daily;
    weeklyStats.value = weekly;
    hourlyStats.value = hourly;
    weekdayStats.value = weekday;
    connectionError.value = "";
  } catch {
    connectionError.value = "后端暂时不可用，正在等待恢复。";
  } finally {
    loading.value = false;
  }
}
function lineOption(labels: string[], values: number[], color: string) {
  return {
    tooltip: { ...tooltipStyle.value, trigger: "axis" as const },
    grid: { left: 44, right: 20, top: 30, bottom: 32 },
    xAxis: { type: "category" as const, data: labels, axisLabel: axisLabelStyle(dark.value), axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: "value" as const, ...axisYStyle(dark.value) },
    series: [{ type: "line" as const, data: values, smooth: true, showSymbol: false, lineStyle: { color, width: 2 } }],
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
const dailyOption = computed(() => lineOption(dailyData.value.map(d => d.label), dailyData.value.map(d => d.value), "#67c23a"));
const weeklyOption = computed(() => barOption(weeklyData.value.map(d => d.label), weeklyData.value.map(d => d.value), "#409eff"));
const hourlyOption = computed(() => barOption(hourlyData.value.map(d => d.label), hourlyData.value.map(d => d.value), "#e6a23c"));
const weekdayOption = computed(() => ({
  tooltip: { ...tooltipStyle.value, trigger: "item" as const },
  legend: { bottom: 0, textStyle: axisLabelStyle(dark.value) },
  series: [{ type: "pie" as const, radius: ["38%", "72%"], data: weekdayData.value.filter(d => d.value > 0).map((d, i) => ({ name: d.label, value: d.value, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } })), label: pieLabelStyle(dark.value), labelLine: pieLabelLineStyle(dark.value) }],
}));

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "0 分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}
function formatDateTime(value: string) { return new Date(value).toLocaleString(); }
function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
function avatarUrl(id: string, size: number) { return `https://mc-heads.net/avatar/${id.replace(/-/g, "")}/${size}`; }
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

onMounted(() => {
  load();
  timer = setInterval(load, 10_000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>
