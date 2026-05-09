# 更新日志

## 2026-05-10

### 一键启动与前端集成
- 新增 `start.bat` / `start.sh` 一键启动脚本，自动检测 Node.js、构建前端、启动后端
- 后端集成前端静态文件服务，单进程即可运行完整 Web 面板
- `startup.mjs` 自动检测数据库类型、修补 Prisma schema、同步数据库结构
- 添加 SSL 证书自动生成脚本 `gencert.mjs`

### 数据库双兼容重构
- 后端全面重构，移除 PostgreSQL 独占的原始 SQL 查询
- 改用 Prisma ORM + JavaScript 时区计算，支持 SQLite / PostgreSQL 自动切换
- 默认使用 SQLite，零配置即可启动
- SQLite 数据库文件自动创建在 `backend/data/`

### 配置与页面优化
- 关于页面新增数据库切换教程（SQLite ↔ PostgreSQL 详细步骤）
- 标题栏显示当前数据库类型标签（SQLite 绿色 / PostgreSQL 蓝色）
- 深色/浅色主题下终端配色适配

### 端口调整
- 默认端口统一为 5 位数：后端 HTTP 27890，HTTPS 27891，前端开发 27892
- 模组默认连接地址改为 `http://localhost:27890`

### 模组改进
- 终端权限降低至玩家等级，支持聊天广播
- 网页端控制台指令 + 聊天记录合并按时间排序展示
- 移除玩家进服/退服消息中的 UUID 显示
- 配置新增 `modLoader` 字段

## 2026-05-09

### 初始化
- 项目创建：TraceSession NeoForge 模组 + Express 后端 + Vue 3 前端
- 模组心跳检测（30 秒间隔）、玩家事件上报（加入/离开/死亡）
- 后端 Prisma ORM + PostgreSQL 数据模型（Server/Player/Session/Event）
- 前端仪表盘：服务器列表、在线状态、TPS/MSPT 监控
- 实时事件推送、5 秒自动刷新
- 玩家详情页：活跃度图表、会话记录
- 服务器详情页：备注编辑、远程控制台
- 深色/浅色/自动主题切换
- Docker Compose 部署方案
