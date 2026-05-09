# TraceSession

TraceSession 是一个 Minecraft 服务器在线时长追踪系统。

## 快速开始

### 1. 安装 Node.js

从 **https://nodejs.org** 下载 **LTS 版本**（22.x）并安装。安装时全部默认选项即可。

Node.js 安装包自带 npm，无需额外安装。安装完成后打开命令行验证：

```
node --version
npm --version
```

两条命令都有版本号输出即表示安装成功。

### 2. 启动

```bash
# Windows：双击 start.bat
start.bat

# Mac / Linux：
./start.sh
```

脚本会自动安装前端依赖、构建页面、启动后端。启动后浏览器访问 **http://localhost:27890**。

### 3. 安装模组

将编译好的 `tracesession.jar` 放入 Minecraft 服务器 `mods/` 目录，启动服务器。模组自动连接后端开始上报数据。

## 端口

| 端口 | 用途 |
|------|------|
| 27890 | 后端 HTTP |
| 27891 | 后端 HTTPS（需 SSL 证书） |

## API

| 路径 | 说明 |
|------|------|
| `GET /api/servers` | 服务器列表 |
| `GET /api/servers/:id` | 服务器详情 |
| `POST /api/servers/heartbeat` | 模组心跳 |
| `GET /api/servers/:id/stats/daily\|hourly\|weekday\|players` | 统计数据 |
| `GET /api/players/count` | 玩家总数 |
| `GET /api/players/:uuid/stats/daily\|weekly\|hourly\|weekday` | 玩家统计 |
| `GET /api/events` | 事件列表 |
| `GET /api/db-type` | 数据库类型 |

## 项目结构

```
ServerOnlineTrace/
├── start.bat / start.sh
├── TraceSession/              # Minecraft 模组
│   └── src/main/java/org/chatterjay/tracesession/
│       ├── Tracesession.java
│       ├── ApiClient.java
│       ├── PlayerEventListener.java
│       └── Config.java
└── Timing Server Record Backend/
    ├── backend/                # Express + Prisma
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── prisma.ts
    │   │   └── routes/
    │   ├── prisma/schema.prisma
    │   └── startup.mjs
    └── frontend/               # Vue 3
        └── src/
            ├── App.vue
            ├── views/
            └── api/index.ts
```
