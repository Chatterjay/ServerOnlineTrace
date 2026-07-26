<template>
  <el-space direction="vertical" fill size="large" class="page-stack">
    <el-page-header title="返回总览" content="关于 TraceSession" @back="router.push('/')" />

    <el-card shadow="never">
      <template #header>系统说明</template>
      <el-text>
        TraceSession 是 Minecraft 服务器在线时长追踪系统，由 NeoForge 模组负责采集心跳、玩家快照、事件和聊天，由 Web 面板负责数据清洗、画像分析、图表展示和网页终端。
      </el-text>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>连接机制</template>
          <el-steps direction="vertical" :active="6" finish-status="success">
            <el-step title="模组安装" description="将 TraceSession jar 放入 mods 目录，启动后读取后端地址和 serverId。" />
            <el-step title="心跳检测" description="模组定时上报平均 TPS、平均 MSPT、版本、模式和在线玩家快照。" />
            <el-step title="事件上报" description="玩家加入、离开、死亡会异步写入后端，后端维护会话。" />
            <el-step title="数据清洗" description="后端交叉心跳快照、session 和事件，补齐缺失 join/leave 并计算画像。" />
            <el-step title="网页终端" description="网页端文字广播到游戏，/ 开头以普通用户权限执行。" />
            <el-step title="图表展示" description="前端展示总览、服务器画像、玩家画像、趋势、时段和维度分布。" />
          </el-steps>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>数据库</template>
          <el-descriptions v-if="dbInfo" :column="1" border>
            <el-descriptions-item label="当前类型">
              <el-tag :type="dbInfo.type === 'SQLite' ? 'success' : 'primary'">{{ dbInfo.type }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="文件">{{ dbInfo.file || "外部数据库" }}</el-descriptions-item>
          </el-descriptions>
          <el-skeleton v-else :rows="4" animated />

          <el-divider />
          <el-tabs>
            <el-tab-pane label="SQLite">
              <el-text>默认使用 SQLite，无需额外配置，适合本机测试和小型服务器。</el-text>
              <el-input class="mt-3" type="textarea" :rows="2" readonly model-value="DATABASE_URL=file:./data/tracesession.db" />
            </el-tab-pane>
            <el-tab-pane label="PostgreSQL">
              <el-text>生产环境可切换 PostgreSQL，适合多服务器和长期数据。</el-text>
              <el-input class="mt-3" type="textarea" :rows="3" readonly model-value="DATABASE_PROVIDER=postgresql&#10;DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/tracesession" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col v-for="card in featureCards" :key="card.title" :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="feature-card">
          <template #header>
            <el-space>
              <el-icon><component :is="card.icon" /></el-icon>
              <span>{{ card.title }}</span>
            </el-space>
          </template>
          <el-check-tag v-for="item in card.items" :key="item" checked class="mr-2 mb-2">{{ item }}</el-check-tag>
        </el-card>
      </el-col>
    </el-row>
  </el-space>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ChatLineRound, DataAnalysis, Monitor, User } from "@element-plus/icons-vue";
import { fetchDbType, type DbInfo } from "../api/index.js";

const router = useRouter();
const dbInfo = ref<DbInfo | null>(null);
const featureCards = [
  { title: "服务器管理", icon: Monitor, items: ["状态检测", "TPS/MSPT", "备注", "多服务器"] },
  { title: "玩家画像", icon: User, items: ["在线时长", "活跃分层", "维度快照", "死亡统计"] },
  { title: "数据图表", icon: DataAnalysis, items: ["每日趋势", "每周趋势", "时段分布", "维度分布"] },
  { title: "聊天终端", icon: ChatLineRound, items: ["广播", "普通权限指令", "外部 API", "聊天记录"] },
];

onMounted(() => {
  fetchDbType().then(info => { dbInfo.value = info; }).catch(() => {});
});
</script>
