# TraceSession

Minecraft 服务器在线时长追踪工具。装上模组后，可以在网页上看到谁在线多久、什么时候上线、服务器状态等。

## 需要准备什么

- 一台电脑（Windows / Mac / Linux 都可以）
- 一个 Minecraft 服务器（装有 NeoForge）

## 第一步：装 Node.js

1. 打开 https://nodejs.org
2. 下载左边的 **LTS** 版本（22.x）
3. 双击安装，一路点"下一步"就行

装好后可以验证一下（不会也无所谓）：
打开命令行输入 `node --version`，能看到版本号就说明装好了。

## 第二步：启动网页后端

找到本文件夹，根据你的系统操作：

- **Windows** → 双击 **`start.bat`**（第一次用这个）或 **`run.bat`**（之后日常用这个）
- **Mac / Linux** → 打开终端，输入 `./start.sh` 或 `./run.sh`

第一次用请双击 **`start.bat`**，它会自动下载依赖并构建网页。等它跑完出现下面的文字就说明启动成功了，这个窗口不要关，关了网页就访问不了了：

```
Backend (HTTP) running at http://localhost:27890
```

关掉这个窗口后，下次再想用的时候双击 **`run.bat`** 就行（这个启动更快，因为不用再下载东西了）。

## 第三步：打开网页

打开浏览器，输入 **http://localhost:27890**，就能看到监控面板了。

## 第四步：装模组

把编译好的 `tracesession.jar` 文件放进 Minecraft 服务器的 `mods/` 文件夹里，然后启动 Minecraft 服务器。模组会自动连上网页后端。

## 日常使用

以后每次想用的时候：

1. 双击 **`run.bat`**（Windows）或运行 **`./run.sh`**（Mac/Linux）
2. 浏览器打开 **http://localhost:27890**

---

> 如果 Minecraft 服务器和网页不在同一台电脑上，需要改模组的配置文件 `config/tracesession-common.toml`，把地址改成网页那台电脑的 IP。
