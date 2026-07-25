# TraceSession

TraceSession 是一个 Minecraft 服务器在线时长追踪系统。

它由两部分组成：

- **TraceSession Mod**：安装到 Minecraft 服务端，负责上报服务器状态、玩家进出、聊天、命令等数据。
- **Web 面板 / 后端**：运行在本机或服务器上，负责保存 SQLite 数据库并提供网页面板。

默认面板地址：

```text
http://localhost:27890
```

English version: [README.en.md](README.en.md)

## 最简单的分发方式

如果只是给别人使用，可以只发两个文件：

- `TraceSession-OneClick.bat`
- `tracesession-1.21.1-1.0.neoforge.jar`

使用步骤：

1. 把 `tracesession-1.21.1-1.0.neoforge.jar` 放进 Minecraft 服务端的 `mods` 文件夹。
2. 双击 `TraceSession-OneClick.bat`。
3. 等待脚本自动完成 Node.js 下载、网站下载、依赖安装、前端构建、数据库初始化和后端启动。
4. 打开浏览器访问 `http://localhost:27890`。

这个方式需要联网，因为脚本会下载 Node.js 和 TraceSession Web 程序。

第一次部署完成后，后续仍然双击同一个 `TraceSession-OneClick.bat` 启动即可。脚本会检测已经部署好的文件，能直接启动就直接启动，不会每次都重新下载和重装。

如果想强制重新部署，删除同目录下的 `TraceSession-Web` 文件夹后再运行 `TraceSession-OneClick.bat`。

## 仓库完整部署

如果你已经下载了整个项目，Windows 下推荐直接双击：

```text
start.bat
```

`start.bat` 会自动完成：

- 检查 Node.js 版本
- 如果没有 Node.js，下载项目内置 portable Node.js
- 安装前端依赖
- 构建前端网站
- 安装后端依赖
- 初始化 Prisma / SQLite 数据库
- 启动 Web 面板

启动成功后会看到类似输出：

```text
Backend (HTTP) running at http://localhost:27890
```

窗口不要关闭，关闭后 Web 面板也会停止。

## 日常启动

完整部署过一次后，可以使用：

```text
run.bat
```

`run.bat` 不会重新安装依赖或构建前端，只会启动后端并自动检查数据库。

如果你改了前端代码、更新了依赖，或者换了一台新电脑，请重新运行：

```text
start.bat
```

## Minecraft 服务端配置

Mod 第一次启动后会生成配置文件：

```text
config/tracesession-common.toml
```

默认配置：

```toml
backendUrl = "http://localhost:27890"
```

如果 Minecraft 服务端和 Web 面板在同一台电脑上，保持默认即可。

如果 Minecraft 服务端和 Web 面板不在同一台电脑上，把 `localhost` 改成 Web 面板所在电脑或服务器的 IP：

```toml
backendUrl = "http://192.168.1.100:27890"
```

改完配置后重启 Minecraft 服务端。

## 数据库

默认不需要配置数据库。

没有设置 `DATABASE_URL` 时，后端会自动使用 SQLite：

```text
prisma/data/tracesession.db
```

如果需要 PostgreSQL，可以在后端 `.env` 中配置：

```env
DATABASE_URL="postgresql://user:password@host:5432/tracesession"
```

## 功能

Mod 会自动上报：

- 服务器在线 / 离线状态
- TPS、MSPT、游戏模式、游戏版本、Mod Loader
- 玩家加入、离开、死亡等事件
- 玩家在线时长
- 游戏内聊天
- Web 面板下发的命令

Web 面板可以查看：

- 仪表盘
- 服务器详情
- 在线玩家
- TPS / MSPT 曲线
- 玩家统计
- 实时事件
- 聊天与命令控制台

## 常见问题

### `No DATABASE_URL found, using SQLite...` 是错误吗？

不是。这表示没有配置 PostgreSQL，程序正在使用默认 SQLite 数据库。

### `A datasource block is missing in the Prisma schema file`

这是 `backend/prisma/schema.prisma` 文件损坏或为空导致的。项目中必须存在完整的 Prisma schema，里面至少要包含 `generator`、`datasource` 和数据模型。

### Mod 一直提示心跳发送失败

通常是 Web 后端没有启动，或者 `backendUrl` 配错了。

先确认浏览器能打开：

```text
http://localhost:27890
```

再检查：

```text
config/tracesession-common.toml
```

如果 Web 面板不在 Minecraft 服务端同一台机器上，不能使用 `localhost`，要改成 Web 面板机器的 IP。
