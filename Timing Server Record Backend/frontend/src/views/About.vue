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

    <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
      <h3 class="text-base font-semibold mb-3 text-cyan-400 flex items-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/></svg>
        服务器与网站连接机制
      </h3>
      <div class="space-y-3 text-sm text-gray-400 leading-relaxed">
        <p>
          <span class="text-cyan-400 font-medium">① 模组安装</span> — 将 TraceSession 模组放入 Minecraft 服务器
          <code class="text-gray-300">mods/</code> 目录，启动后模组自动读取配置文件中的后端地址和服务器标识。
        </p>
        <p>
          <span class="text-cyan-400 font-medium">② 心跳检测</span> — 模组每 30 秒向后端发送一次心跳请求，携带服务器名称、地址、TPS、MSPT、游戏模式（生存/创造等）、模组加载器信息。后端收到心跳后更新服务器状态，若超过 90 秒未收到心跳则判定服务器离线。
        </p>
        <p>
          <span class="text-cyan-400 font-medium">③ 事件上报</span> — 玩家加入、离开或死亡时，模组通过异步 HTTP 请求立即通知后端，后端记录事件并维护对应的 Session（会话开始/结束）。
        </p>
        <p>
          <span class="text-cyan-400 font-medium">④ 指令队列</span> — 在网页端控制台输入指令后，指令暂存在后端内存队列中。模组下一次心跳时拉取待处理指令，在游戏内以玩家权限执行。
        </p>
        <p>
          <span class="text-cyan-400 font-medium">⑤ 聊天同步</span> — 模组监听玩家聊天事件（<code class="text-gray-300">ServerChatEvent</code>），将玩家名和消息内容异步上报后端。网页端每 5 秒轮询获取最新聊天记录，与指令历史合并按时间排序展示。
        </p>
        <p>
          <span class="text-cyan-400 font-medium">⑥ 前端轮询</span> — 网页仪表盘每 5 秒刷新服务器列表和实时事件，服务器详情页同步刷新状态、指令历史和聊天记录。所有 API 通信均通过 HTTPS 加密。
        </p>
      </div>
    </GlowCard>

    <GlowCard cardClass="card p-4 sm:p-6" hoverClass="">
      <h3 class="text-base font-semibold mb-3 flex items-center gap-2"
        :class="dbInfo ? (dbInfo.type === 'SQLite' ? 'text-green-400' : 'text-blue-400') : 'text-gray-400'">
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <ellipse cx="8" cy="4" rx="6" ry="2.5"/>
          <path d="M2 4v8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V4"/>
          <path d="M2 8c0 1.4 2.7 2.5 6 2.5S14 9.4 14 8"/>
        </svg>
        数据库
      </h3>

      <div v-if="dbInfo" class="space-y-3 text-sm">
        <div class="flex items-center gap-2">
          <span class="text-gray-500">当前类型：</span>
          <span class="px-2 py-0.5 rounded text-xs font-mono"
            :class="dbInfo.type === 'SQLite'
              ? 'bg-green-900/30 text-green-400'
              : 'bg-blue-900/30 text-blue-400'">
            {{ dbInfo.type }}
          </span>
          <span v-if="dbInfo.file" class="text-gray-500 text-xs font-mono">({{ dbInfo.file }})</span>
        </div>

        <div v-if="dbInfo.type === 'SQLite'" class="text-gray-400 leading-relaxed space-y-2">
          <p>系统当前使用 <span class="text-green-400 font-medium">SQLite</span> 作为数据库，数据存储在本地文件中，无需额外配置即可使用，适合单机调试和小规模使用。</p>
          <div class="bg-gray-800/50 border border-gray-700/50 rounded p-3 space-y-1.5">
            <p class="text-gray-300 font-medium">切换到 PostgreSQL（生产环境）</p>
            <ol class="list-decimal list-inside space-y-1 text-gray-400">
              <li>安装 PostgreSQL 并创建数据库（例如 <code class="text-gray-300">tracesession</code>）</li>
              <li>编辑 <code class="text-gray-300">backend/.env</code> 文件，设置数据库连接：
                <pre class="mt-1 bg-gray-900/60 rounded px-2 py-1.5 text-xs text-gray-300 overflow-x-auto">DATABASE_URL=postgresql://用户:密码@localhost:5432/tracesession</pre>
              </li>
              <li>重启后端服务即可自动切换</li>
            </ol>
          </div>
        </div>

        <div v-else class="text-gray-400 leading-relaxed">
          <p>系统当前使用 <span class="text-blue-400 font-medium">PostgreSQL</span> 作为数据库，适合多服务器并发和生产环境部署。</p>
          <p class="mt-2">如需切换回 SQLite，清空 <code class="text-gray-300">.env</code> 中的 <code class="text-gray-300">DATABASE_URL</code> 或将其注释掉，重启后端即可。</p>
        </div>
      </div>

      <p v-else class="text-sm text-gray-500">加载中...</p>
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
import { ref, onMounted } from "vue";
import { fetchDbType } from "../api/index.js";
import type { DbInfo } from "../api/index.js";
import GlowCard from "../components/GlowCard.vue";

const dbInfo = ref<DbInfo | null>(null);
onMounted(() => {
  fetchDbType().then(info => { dbInfo.value = info; }).catch(() => {});
});
</script>
