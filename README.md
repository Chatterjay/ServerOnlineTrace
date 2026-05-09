# TraceSession

Minecraft 服务器在线时长追踪系统。包含 NeoForge 模组（数据采集）和 Web 面板（分析展示）。

## 快速开始

### 1. 启动后端

```bash
# Windows
start.bat

# Mac / Linux
./start.sh
```

脚本会自动检测 Node.js、安装前端依赖、构建前端页面、启动后端服务。

启动后访问 **http://localhost:27890** 即可打开监控面板。

### 2. 安装模组

将编译好的 `tracesession.jar` 放入 Minecraft 服务器的 `mods/` 目录，启动服务器。模组会自动连接后端（`http://localhost:27890`）并开始发送心跳和事件数据。

如果之前运行过模组，请删除 `config/tracesession-common.toml` 让模组重新生成配置。

## 功能

- **多服务器监控** — 实时显示服务器在线状态、TPS、MSPT、玩家数量
- **玩家分析** — 每位玩家的在线时长、活跃趋势、时段分布、死亡统计
- **实时事件** — 玩家加入/离开/死亡事件实时推送
- **远程控制台** — 网页端执行指令，聊天广播同步
- **数据图表** — 日/周/时段/星期多维度可视化分析
- **深色/浅色主题** — 支持跟随系统自动切换

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 图表 | ECharts 5 + vue-echarts 7 |
| 后端 | Express 4 + TypeScript + Prisma ORM |
| 数据库 | SQLite（默认，零配置）/ PostgreSQL |
| 模组 | NeoForge 1.21.1, Java 21 |

## API

后端提供 RESTful API，前缀 `/api`：

| 路径 | 说明 |
|------|------|
| `GET /api/servers` | 服务器列表 |
| `GET /api/servers/:id` | 服务器详情 |
| `POST /api/servers/heartbeat` | 模组心跳 |
| `GET /api/servers/:id/stats/daily\|hourly\|weekday\|players` | 统计数据 |
| `GET /api/players/count` | 玩家总数 |
| `GET /api/players/:uuid/stats/daily\|weekly\|hourly\|weekday` | 玩家统计 |
| `GET /api/events` | 事件列表（支持分页筛选） |
| `GET /api/db-type` | 数据库类型 |

## 数据库切换

默认使用 SQLite（零配置），如需切换到 PostgreSQL：

1. 安装 PostgreSQL 并创建数据库
2. 编辑 `backend/.env`，设置 `DATABASE_URL=postgresql://用户:密码@localhost:5432/tracesession`
3. 重启后端

## 端口

| 端口 | 用途 |
|------|------|
| 27890 | 后端 HTTP |
| 27891 | 后端 HTTPS（需 SSL 证书） |

## 项目结构

```
ServerOnlineTrace/
├── start.bat / start.sh      # 一键启动脚本
├── TraceSession/              # Minecraft 模组 (Java)
│   └── src/main/java/org/chatterjay/tracesession/
│       ├── Tracesession.java        # 主类
│       ├── ApiClient.java           # HTTP 客户端
│       ├── PlayerEventListener.java # 玩家事件监听
│       └── Config.java              # 模组配置
└── Timing Server Record Backend/
    ├── backend/                # Express + Prisma
    │   ├── src/
    │   │   ├── index.ts        # 入口
    │   │   ├── prisma.ts       # Prisma 客户端
    │   │   └── routes/         # API 路由
    │   ├── prisma/schema.prisma
    │   └── startup.mjs         # 启动脚本
    └── frontend/               # Vue 3 前端
        └── src/
            ├── App.vue
            ├── views/          # 页面
            └── api/index.ts    # API 接口
```
