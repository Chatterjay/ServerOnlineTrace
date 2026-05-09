<template>
  <div class="space-y-6 animate-fade-in">
    <router-link to="/" class="text-amber-400 hover:text-amber-300 hover:underline text-sm inline-flex items-center gap-1">&larr; 返回仪表盘</router-link>

    <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
      <h2 class="text-xl font-bold text-gray-200 mb-2">关于 TraceSession</h2>
      <p class="text-sm text-gray-400 leading-relaxed">
        TraceSession 是一个 Minecraft 服务器在线时长追踪系统，包含一个 NeoForge 模组用于采集数据，
        和一个 Web 面板用于展示分析结果。支持多服务器管理、玩家活跃度分析、实时事件监控等功能。
      </p>
    </GlowCard>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-3 text-amber-400 flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8l2 2 4-4"/></svg>
          服务器管理
        </h3>
        <ul class="space-y-2 text-sm text-gray-400">
          <li class="flex gap-2"><span class="text-amber-400 shrink-0">·</span>多服务器统一监控，实时显示在线状态、TPS、MSPT</li>
          <li class="flex gap-2"><span class="text-amber-400 shrink-0">·</span>自动检测服务器离线（90 秒无心跳）并关闭残留会话</li>
          <li class="flex gap-2"><span class="text-amber-400 shrink-0">·</span>支持为服务器添加备注标识</li>
          <li class="flex gap-2"><span class="text-amber-400 shrink-0">·</span>远程控制台，支持文字聊天广播和玩家等级指令执行</li>
          <li class="flex gap-2"><span class="text-amber-400 shrink-0">·</span>显示游戏模式、模组加载器信息</li>
          <li class="flex gap-2"><span class="text-amber-400 shrink-0">·</span>30 天数据自动清理</li>
        </ul>
      </GlowCard>

      <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-3 text-green-400 flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v14M1 8h14"/><circle cx="8" cy="8" r="3"/></svg>
          玩家分析
        </h3>
        <ul class="space-y-2 text-sm text-gray-400">
          <li class="flex gap-2"><span class="text-green-400 shrink-0">·</span>每位玩家的总在线时长、活跃天数、日均在线统计</li>
          <li class="flex gap-2"><span class="text-green-400 shrink-0">·</span>近 30 天每日/每周在线趋势图表</li>
          <li class="flex gap-2"><span class="text-green-400 shrink-0">·</span>24 小时活跃时段分布分析</li>
          <li class="flex gap-2"><span class="text-green-400 shrink-0">·</span>星期分布饼图</li>
          <li class="flex gap-2"><span class="text-green-400 shrink-0">·</span>死亡总数统计</li>
          <li class="flex gap-2"><span class="text-green-400 shrink-0">·</span>最近会话记录列表</li>
        </ul>
      </GlowCard>

      <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-3 text-blue-400 flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8a6 6 0 0 1 12 0"/><path d="M2 8a6 6 0 0 0 12 0"/><circle cx="8" cy="8" r="2"/></svg>
          实时监控
        </h3>
        <ul class="space-y-2 text-sm text-gray-400">
          <li class="flex gap-2"><span class="text-blue-400 shrink-0">·</span>仪表盘 5 秒自动刷新，实时显示玩家加入/离开事件</li>
          <li class="flex gap-2"><span class="text-blue-400 shrink-0">·</span>服务器在线状态实时检测</li>
          <li class="flex gap-2"><span class="text-blue-400 shrink-0">·</span>各服务器玩家数量统计</li>
          <li class="flex gap-2"><span class="text-blue-400 shrink-0">·</span>服务器活跃玩家排行榜</li>
        </ul>
      </GlowCard>

      <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
        <h3 class="text-base font-semibold mb-3 text-purple-400 flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 3h8v10H4zM7 6h2v1H7zM7 8h2v1H7z"/></svg>
          技术栈
        </h3>
        <ul class="space-y-2 text-sm text-gray-400">
          <li class="flex gap-2"><span class="text-purple-400 shrink-0">·</span><span class="text-gray-500">前端：</span>Vue 3 + TypeScript + Vite + Tailwind CSS 4</li>
          <li class="flex gap-2"><span class="text-purple-400 shrink-0">·</span><span class="text-gray-500">图表：</span>ECharts 5 + vue-echarts 7</li>
          <li class="flex gap-2"><span class="text-purple-400 shrink-0">·</span><span class="text-gray-500">后端：</span>Express + TypeScript + Prisma ORM + PostgreSQL</li>
          <li class="flex gap-2"><span class="text-purple-400 shrink-0">·</span><span class="text-gray-500">模组：</span>NeoForge (Minecraft 1.21.1, Java 21)</li>
          <li class="flex gap-2"><span class="text-purple-400 shrink-0">·</span><span class="text-gray-500">通信：</span>HTTPS 加密</li>
        </ul>
      </GlowCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import GlowCard from "../components/GlowCard.vue";
</script>
