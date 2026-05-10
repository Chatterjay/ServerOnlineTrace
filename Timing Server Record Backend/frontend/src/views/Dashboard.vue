<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <button
        @click="tooltipMode = !tooltipMode"
        class="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors border"
        :class="tooltipMode ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'text-gray-500 border-gray-700/40 hover:text-gray-400 hover:border-gray-600'"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/>
        </svg>
        {{ tooltipMode ? '说明提示 开' : '说明提示' }}
      </button>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in">
      <GlowCard cardClass="card-stat card-stat-accent-amber p-4 text-center !overflow-visible" hoverClass="">
        <div class="text-2xl sm:text-3xl font-bold text-amber-400">{{ stats.total }}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
          服务器总数
          <span class="relative group inline-flex items-center">
            <svg class="w-3 h-3 cursor-help text-gray-500 hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
            <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">注册到后端的所有服务器数量，包含在线和离线</div>
          </span>
        </div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-green p-4 text-center !overflow-visible" hoverClass="">
        <div class="text-2xl sm:text-3xl font-bold text-green-400">{{ stats.online }}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
          在线服务器
          <span class="relative group inline-flex items-center">
            <svg class="w-3 h-3 cursor-help text-gray-500 hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
            <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">最近90秒内发送过心跳的服务器</div>
          </span>
        </div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-blue p-4 text-center !overflow-visible" hoverClass="">
        <div class="text-2xl sm:text-3xl font-bold text-blue-400">{{ stats.players }}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
          玩家总数
          <span class="relative group inline-flex items-center">
            <svg class="w-3 h-3 cursor-help text-gray-500 hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
            <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">当前所有在线服务器上的玩家总人数</div>
          </span>
        </div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-cyan p-4 text-center !overflow-visible" hoverClass="">
        <div class="text-2xl sm:text-3xl font-bold text-cyan-400">{{ stats.sessions }}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
          会话总数
          <span class="relative group inline-flex items-center">
            <svg class="w-3 h-3 cursor-help text-gray-500 hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
            <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">所有玩家完整的连接次数，一次完整的加入+离开计为一个会话</div>
          </span>
        </div>
      </GlowCard>
      <GlowCard cardClass="card-stat card-stat-accent-purple p-4 text-center !overflow-visible" hoverClass="">
        <div class="text-2xl sm:text-3xl font-bold text-purple-400">{{ stats.events }}</div>
        <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
          事件总数
          <span class="relative group inline-flex items-center">
            <svg class="w-3 h-3 cursor-help text-gray-500 hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
            <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">所有玩家加入和离开事件的累计记录数。每次加入或离开都计为一个事件</div>
          </span>
        </div>
      </GlowCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div class="lg:col-span-3 space-y-3 animate-fade-in-d1">
        <h3 class="text-base font-semibold text-gray-200 flex items-center gap-2">
          服务器列表
          <span class="text-xs text-gray-600 font-normal">({{ servers.length }})</span>
        </h3>
        <GlowCard v-for="srv in servers" :key="srv.id" cardClass="card card-hover p-4 !overflow-visible" hoverClass="cursor-pointer">
          <div class="flex items-center gap-3" @click="goServer(srv.id)">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="srv.status === 'online' ? 'bg-green-400 live-dot' : 'bg-gray-600'" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-gray-200 truncate max-w-[200px]">{{ srv.name }}</span>
                <span v-if="srv.note" class="text-[10px] text-gray-500 truncate max-w-[150px]">— {{ srv.note }}</span>
              </div>
              <div class="text-xs text-gray-600 mt-0.5">
                {{ srv.address || "未知地址" }}
                <span v-if="srv.lastHeartbeat" class="ml-2">最后心跳 {{ timeAgo(srv.lastHeartbeat) }}</span>
                <span v-if="srv.gameVersion" class="ml-2 font-mono text-gray-500">MC {{ srv.gameVersion }}</span>
                <span v-if="srv.modVersion" class="ml-2 font-mono">v{{ srv.modVersion }}</span>
              </div>
            </div>
            <div class="text-xs text-right shrink-0 leading-relaxed min-w-[80px]">
              <div class="text-gray-600 whitespace-nowrap">{{ srv.playerCount ?? "-" }} 玩家</div>
              <div class="text-gray-600">
                <span v-if="srv.status === 'online' && srv.tps != null" :class="srv.tps < 18 ? 'text-red-400' : 'text-green-400'">{{ srv.tps.toFixed(1) }}</span>
                <span v-else class="text-gray-500">--</span>
                <span class="text-gray-500"> TPS</span>
              </div>
              <div class="text-gray-500">
                <span v-if="srv.status === 'online' && srv.mtps != null">{{ srv.mtps.toFixed(0) }}ms</span>
                <span v-else>--</span>
              </div>
              <div class="text-gray-500 flex justify-end gap-1">
                <span class="relative group inline-flex items-center gap-0.5">
                  {{ srv._count?.sessions ?? 0 }}会话
                  <svg class="w-2.5 h-2.5 cursor-help hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
                  <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">玩家完整连接次数，一次加入+离开计为一个会话</div>
                </span>
                <span class="text-gray-600">·</span>
                <span class="relative group inline-flex items-center gap-0.5">
                  {{ srv._count?.events ?? 0 }}事件
                  <svg class="w-2.5 h-2.5 cursor-help hover:text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v4M8 5v.5" stroke-linecap="round"/></svg>
                  <div class="tooltip-box" :class="tooltipMode ? 'hidden group-hover:block' : 'hidden'">所有加入/离开事件的累计记录数</div>
                </span>
              </div>
            </div>
          </div>
        </GlowCard>
        <div v-if="servers.length === 0" class="card p-6 text-center text-gray-500 text-sm">暂无服务器数据</div>
      </div>

      <div class="lg:col-span-2 space-y-3 animate-fade-in-d2">
        <h3 class="text-base font-semibold text-gray-200 flex items-center gap-2">
          实时事件
          <span class="text-xs text-gray-600 font-normal">最新 {{ events.length }}</span>
          <button @click="showServerNote = !showServerNote"
            class="ml-auto text-[10px] px-1.5 py-0.5 rounded border transition-colors shrink-0"
            :class="showServerNote ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'text-gray-500 border-gray-700/40 hover:text-gray-400'">
            {{ showServerNote ? '名称' : '备注' }}
          </button>
        </h3>
        <div class="card-list max-h-[600px] overflow-y-auto">
          <div class="min-w-[320px]">
            <div v-for="ev in events" :key="ev.id"
              class="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 border-b border-gray-700/50 last:border-0 text-xs hover:bg-gray-700/20 transition-colors">
              <img :src="`https://mc-heads.net/avatar/${(ev.playerUuid || '').replace(/-/g, '')}/24`" alt=""
                class="w-5 h-5 rounded shrink-0"
                @error="(e: any) => { if (!e.target.src.includes('MHF_Steve')) e.target.src = 'https://mc-heads.net/avatar/MHF_Steve/24'; }" />
              <span
                class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                :class="ev.type === 'join' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'"
              >{{ ev.type === "join" ? "加入" : ev.type === "death" ? "死亡" : "离开" }}</span>
              <router-link :to="`/players/${ev.playerUuid}`"
                class="text-gray-200 hover:text-amber-400 truncate max-w-[100px] shrink-0">
                {{ ev.player.name }}
              </router-link>
              <span class="text-gray-600 truncate shrink-0" :title="ev.server.name">{{ showServerNote ? (ev.server.note || ev.server.name) : ev.server.name }}</span>
              <span class="text-gray-600 ml-auto shrink-0 whitespace-nowrap">{{ timeAgo(ev.timestamp) }}</span>
            </div>
            <div v-if="events.length === 0" class="p-6 text-gray-500 text-center text-sm">暂无事件</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import GlowCard from "../components/GlowCard.vue";
import { fetchServers, fetchEvents, fetchPlayerCount, type Server, type EventData } from "../api/index.js";

const router = useRouter();
const servers = ref<Server[]>([]);
const events = ref<EventData[]>([]);
const tooltipMode = ref(false);
const showServerNote = ref(false);
const stats = ref({ total: 0, online: 0, players: 0, sessions: 0, events: 0 });

let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    const [srvData, evData, playerCount] = await Promise.all([fetchServers(), fetchEvents({ page: 1 }), fetchPlayerCount()]);
    servers.value = srvData;
    events.value = evData.events.slice(0, 50);
    stats.value = {
      total: srvData.length,
      online: srvData.filter(s => s.status === "online").length,
      players: playerCount,
      sessions: srvData.reduce((sum, s) => sum + (s._count?.sessions || 0), 0),
      events: evData.total,
    };
  } catch { /* ignore polling errors */ }
}

function goServer(id: string) {
  router.push(`/servers/${id}`);
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

onMounted(() => {
  load();
  timer = setInterval(load, 5000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
