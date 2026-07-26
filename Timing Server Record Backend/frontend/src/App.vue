<template>
  <el-config-provider>
    <el-container class="ts-app">
      <el-aside class="ts-sidebar">
        <router-link to="/" class="ts-brand">
          <el-icon><DataAnalysis /></el-icon>
          <span>TraceSession</span>
        </router-link>
        <el-menu router :default-active="$route.path" class="ts-menu">
          <el-menu-item index="/">
            <el-icon><Monitor /></el-icon>
            <span>总览</span>
          </el-menu-item>
          <el-menu-item index="/about">
            <el-icon><InfoFilled /></el-icon>
            <span>关于</span>
          </el-menu-item>
        </el-menu>
        <div class="ts-sidebar-footer">
          <el-tag v-if="dbType" effect="plain">{{ dbType }}</el-tag>
          <el-switch v-model="isDark" inline-prompt active-text="黑" inactive-text="白" @change="toggleTheme" />
        </div>
      </el-aside>

      <el-container>
        <el-header class="ts-topbar">
          <div>
            <strong>服务器状态、玩家画像与聊天控制台</strong>
            <el-text type="info" size="small">数据优先，操作就近，图表按语义显示</el-text>
          </div>
        </el-header>
        <el-main class="ts-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { DataAnalysis, InfoFilled, Monitor } from "@element-plus/icons-vue";
import { fetchDbType } from "./api/index.js";

const dbType = ref("");
const isDark = ref(true);

function applyTheme(dark: boolean) {
  isDark.value = dark;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("tracesession-theme", dark ? "dark" : "light");
}

function toggleTheme(value: string | number | boolean) {
  applyTheme(Boolean(value));
}

onMounted(async () => {
  const saved = localStorage.getItem("tracesession-theme");
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  applyTheme(saved ? saved !== "light" : !prefersLight);
  try {
    dbType.value = (await fetchDbType()).type;
  } catch {
    dbType.value = "";
  }
});
</script>
