<template>
  <div class="min-h-screen" :class="resolved === 'light' ? 'text-gray-800' : 'text-gray-100'">
    <!-- 标题栏 -->
    <header class="border-b sticky top-0 z-50 backdrop-blur-md"
      :style="{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div class="w-2.5 h-2.5 rounded-full live-dot" />
        <h1 class="title-gradient text-xl sm:text-2xl font-bold tracking-wide">TraceSession</h1>
        <span class="ml-auto text-xs" :class="resolved === 'light' ? 'text-gray-400' : 'text-gray-600'">实时监控面板</span>

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

.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from { opacity: 0; transform: translateX(12px); }
.page-leave-to { opacity: 0; transform: translateX(-12px); }
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";

type Theme = "dark" | "light" | "auto";
const KEY = "tracesession-theme";

const ICONS: Record<Theme, string> = { dark: "☾", light: "☀", auto: "◐" };
const LABELS: Record<Theme, string> = { dark: "深色", light: "浅色", auto: "跟随系统" };

const theme = ref<Theme>((localStorage.getItem(KEY) as Theme) || "auto");
const sysDark = ref(true);

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
  sysDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    sysDark.value = e.matches;
  });
});
</script>
