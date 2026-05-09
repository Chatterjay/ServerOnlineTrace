<template>
  <div class="min-h-screen" :class="resolved === 'light' ? 'text-gray-800' : 'text-gray-100'">
    <div class="deco-particles" aria-hidden="true">
      <span class="d-p" style="top:15%;left:8%;width:3px;height:3px;--c:rgba(251,191,36,0.3);--d:0s;--t:25s"></span>
      <span class="d-p" style="top:70%;left:92%;width:4px;height:4px;--c:rgba(52,211,153,0.25);--d:-7s;--t:30s"></span>
      <span class="d-p" style="top:35%;left:95%;width:2px;height:2px;--c:rgba(129,140,248,0.3);--d:-12s;--t:20s"></span>
      <span class="d-p" style="top:80%;left:5%;width:5px;height:5px;--c:rgba(251,191,36,0.15);--d:-5s;--t:35s"></span>
      <span class="d-p" style="top:50%;left:50%;width:3px;height:3px;--c:rgba(52,211,153,0.2);--d:-18s;--t:28s"></span>
      <span class="d-p" style="top:10%;left:50%;width:2px;height:2px;--c:rgba(251,191,36,0.35);--d:-10s;--t:22s"></span>
    </div>
    <!-- 标题栏 -->
    <header class="border-b sticky top-0 z-50 backdrop-blur-md"
      :style="{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div class="w-2.5 h-2.5 rounded-full live-dot" />
        <h1 class="title-gradient text-xl sm:text-2xl font-bold tracking-wide">TraceSession</h1>
        <span class="ml-auto text-xs" :class="resolved === 'light' ? 'text-gray-400' : 'text-gray-600'">实时监控面板</span>

        <router-link to="/about"
          class="ml-2 text-xs px-2 py-1 rounded transition-colors"
          :class="resolved === 'light' ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'">
          关于
        </router-link>

        <span v-if="dbType"
          class="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
          :class="dbType === 'SQLite'
            ? (resolved === 'light' ? 'bg-green-100 text-green-700' : 'bg-green-900/30 text-green-400')
            : (resolved === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-400')">
          {{ dbType }}
        </span>

        <!-- 主题切换按钮 -->
        <button @click="cycleTheme"
          class="cursor-pointer ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:scale-110"
          :style="{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }"
          :title="label">
          {{ icon }}
        </button>
      </div>
    </header>

    <!-- 页面内容 -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.title-gradient {
  background: linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24, #f59e0b);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 4s ease-in-out infinite;
}
@keyframes shimmer {
  0%, 100% { background-position: 0% center; }
  50% { background-position: 200% center; }
}

.deco-particles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.d-p {
  position: absolute;
  border-radius: 50%;
  background: var(--c);
  animation: particleFloat var(--t, 25s) ease-in-out infinite;
  animation-delay: var(--d, 0s);
  opacity: 0;
}

@keyframes particleFloat {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
  15% { opacity: 1; }
  25% { transform: translate(20px, -30px) scale(1.4); }
  50% { transform: translate(-15px, -20px) scale(0.8); }
  75% { transform: translate(10px, -40px) scale(1.2); }
  85% { opacity: 1; }
  100% { transform: translate(-5px, -10px) scale(0.6); opacity: 0; }
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from { opacity: 0; transform: translateX(12px); }
.page-leave-to { opacity: 0; transform: translateX(-12px); }
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { fetchDbType } from "./api/index.js";

type Theme = "dark" | "light" | "auto";
const KEY = "tracesession-theme";

const ICONS: Record<Theme, string> = { dark: "☾", light: "☀", auto: "◐" };
const LABELS: Record<Theme, string> = { dark: "深色", light: "浅色", auto: "跟随系统" };

const theme = ref<Theme>((localStorage.getItem(KEY) as Theme) || "auto");
const sysDark = ref(true);
const dbType = ref<string | null>(null);

const resolved = computed(() => {
  if (theme.value === "auto") return sysDark.value ? "dark" : "light";
  return theme.value;
});

const icon = computed(() => ICONS[theme.value]);
const label = computed(() => LABELS[theme.value]);

function cycleTheme() {
  const order: Theme[] = ["dark", "light", "auto"];
  const idx = order.indexOf(theme.value);
  theme.value = order[(idx + 1) % order.length];
  localStorage.setItem(KEY, theme.value);
}

watch(resolved, (v) => {
  document.documentElement.setAttribute("data-theme", v);
}, { immediate: true });

onMounted(() => {
  fetchDbType().then(info => { dbType.value = info.type; }).catch(() => {});
  sysDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    sysDark.value = e.matches;
  });
});
</script>
