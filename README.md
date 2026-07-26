# TraceSession

TraceSession 是一个 Minecraft 服务器在线时长、状态、事件和聊天追踪面板。它由两部分组成：

- **TraceSession Mod**：放入 Minecraft 服务端 `mods` 文件夹，负责上报玩家、事件、聊天和服务器状态。
- **Web 面板/后端**：保存 SQLite 数据库，提供浏览器面板、网页终端、广播 API 和统计分析。

默认面板地址：

```text
http://localhost:27890
```

## 普通用户安装

推荐从 `release` 分支或 GitHub Releases 下载：

- Windows：`TraceSession-OneClick.bat`
- Linux/macOS：`TraceSession-OneClick.sh`
- Mod：`tracesession-1.21.1-1.0.neoforge.jar`

Windows 启动：

```bat
TraceSession-OneClick.bat
```

Linux/macOS 启动：

```bash
chmod +x TraceSession-OneClick.sh
./TraceSession-OneClick.sh
```

第一次运行会自动下载 Node.js、下载网站程序、安装依赖、构建前端、初始化 SQLite 数据库并启动面板。后续直接运行同一个脚本会快速启动。

## 网站更新

Mod JAR 需要手动替换到 Minecraft 服务端 `mods` 文件夹。网站可以一键更新：

Windows：

```bat
TraceSession-OneClick.bat update
```

Linux/macOS：

```bash
./TraceSession-OneClick.sh update
```

`update` 会保留数据库，关闭旧面板进程，下载最新网站代码，重新安装依赖、构建并启动。

## 网站重装

当本地网站目录损坏或依赖异常时使用：

```bat
TraceSession-OneClick.bat reinstall
```

或：

```bash
./TraceSession-OneClick.sh reinstall
```

`reinstall` 会保留数据库并重建 `TraceSession-Web`。

## 数据位置

一键脚本会把用户数据保存在：

```text
TraceSession-Data/tracesession.db
```

不要删除 `TraceSession-Data`，除非你想清空历史记录。

## Minecraft 配置

Mod 首次启动后会生成：

```text
config/tracesession-common.toml
```

面板和 Minecraft 服务端在同一台机器时：

```toml
backendUrl = "http://localhost:27890"
```

如果面板在另一台服务器，把 `localhost` 改成面板服务器 IP：

```toml
backendUrl = "http://192.168.1.100:27890"
```

改完后重启 Minecraft 服务端。

## 网页终端与广播 API

服务器详情页提供轻量终端：

- 输入普通文字：广播到游戏内聊天。
- 输入 `/` 开头内容：作为服务器命令下发。

注意：Mod 默认跟随后端心跳轮询，网页消息会在下一次心跳时进入服务器。

外部程序也可以调用广播 API。

向指定服务器广播：

```http
POST /api/servers/{serverId}/broadcast
Content-Type: application/json

{
  "message": "维护将在 10 分钟后开始",
  "prefix": "公告"
}
```

向所有在线服务器广播：

```http
POST /api/broadcast
Content-Type: application/json

{
  "message": "欢迎来到服务器",
  "prefix": "外部"
}
```

也可以在全局接口中指定 `serverId`：

```json
{
  "serverId": "your-server-id",
  "message": "你好",
  "prefix": "机器人"
}
```

## 源码部署

完整源码仓库中：

Windows：

```bat
start.bat
```

Linux/macOS：

```bash
chmod +x start.sh
./start.sh
```

开发模式：

```bat
dev.bat
```

或：

```bash
./dev.sh
```

## 常见问题

### `No DATABASE_URL found, using SQLite...`

这不是错误。它表示没有配置 PostgreSQL，程序正在使用默认 SQLite。

### `A datasource block is missing in the Prisma schema file`

说明 `Timing Server Record Backend/backend/prisma/schema.prisma` 缺失或损坏，需要从仓库恢复。

### `listen EADDRINUSE: address already in use :::27890`

表示端口 `27890` 已被占用。当前一键脚本会先检测端口：

- 如果是 TraceSession 正在运行，会关闭旧进程并启动新进程。
- 如果是其他程序占用，会显示 PID 并退出。

Windows 手动查看：

```powershell
Get-NetTCPConnection -LocalPort 27890 -State Listen
```

Linux 手动查看：

```bash
ss -ltnp 'sport = :27890'
```

## API 方向说明（清晰版）

### 往内：外部系统 -> TraceSession -> Minecraft 服务器

这些接口用于把外部消息送进游戏内聊天或命令队列。

指定服务器广播：

```http
POST /api/servers/{serverId}/broadcast
Content-Type: application/json

{
  "message": "维护将在 10 分钟后开始",
  "prefix": "公告"
}
```

全局广播；不传 `serverId` 时发送给所有在线服务器，传了则只发给该服务器：

```http
POST /api/broadcast
Content-Type: application/json

{
  "serverId": "your-server-id",
  "message": "来自外部系统的提醒",
  "prefix": "外部"
}
```

下发普通权限命令：

```http
POST /api/servers/{serverId}/command
Content-Type: application/json

{
  "command": "/list"
}
```

### 往外：Minecraft 服务器 -> TraceSession -> 外部系统

方式一：Webhook 主动推送。配置后端 `.env`：

```env
OUTBOUND_WEBHOOK_URLS=https://example.com/tracesession/webhook
```

可以配置多个地址，用英文逗号分隔。游戏聊天或事件进入后端后，后端会主动 POST：

```json
{
  "kind": "chat.message",
  "timestamp": "2026-07-26T13:20:00.000Z",
  "payload": {
    "serverId": "your-server-id",
    "playerUuid": "player-uuid",
    "playerName": "Dev",
    "message": "hello"
  }
}
```

事件 payload 的 `kind` 是 `event.created`，`payload.type` 可能是 `join`、`leave`、`death`、`debug-playtime` 等。

查看出站 Webhook 状态：

```http
GET /api/outbound
```

发送一条测试 Webhook：

```http
POST /api/outbound/test
Content-Type: application/json

{
  "serverId": "your-server-id",
  "message": "webhook test"
}
```

方式二：外部系统轮询读取。

```http
GET /api/servers/{serverId}/chat
GET /api/events?serverId={serverId}
GET /api/servers/{serverId}
GET /api/servers/{serverId}/players
```

## 安全部署建议

本机测试可以零配置运行。只要面板会被局域网、面板服或公网访问，建议在后端 `.env` 配置：

```env
TRACESESSION_API_KEY=change-this-long-random-key
TRACESESSION_REQUIRE_API_KEY_FOR_WRITES=true
TRACESESSION_REQUIRE_API_KEY_FOR_READS=true
TRACESESSION_CORS_ORIGINS=https://panel.example.com
TRACESESSION_RATE_LIMIT_WINDOW_MS=60000
TRACESESSION_RATE_LIMIT_MAX=240
TRACESESSION_ENABLE_DEBUG_API=false
OUTBOUND_WEBHOOK_SECRET=change-this-webhook-signing-secret
```

同时在 Minecraft 服务端 `config/tracesession-common.toml` 中设置同一个：

```toml
apiKey = "change-this-long-random-key"
```

后端会写两类本地日志：

```text
backend/logs/access.log
backend/logs/audit.log
```

`access.log` 记录请求方法、路径、状态码和耗时；`audit.log` 记录命令下发、广播、清空记录、debug 写入、鉴权失败和限流事件。日志文件已被 `.gitignore` 忽略。

数据库防护：

- 后端使用 Prisma 参数化查询，避免拼接 SQL。
- SQLite 数据目录会尽量设置为仅当前用户可访问。
- SQLite 文件透明加密不是 Prisma 原生能力；需要强加密时建议使用系统磁盘加密，或切换 PostgreSQL 并启用磁盘加密、备份加密和 TLS。

基础安全自检：

```bash
cd "Timing Server Record Backend/backend"
npm run security:check
```
