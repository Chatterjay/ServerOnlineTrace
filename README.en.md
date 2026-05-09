# TraceSession

A Minecraft server playtime tracker. Install the mod and view player activity, server status, and statistics through a web panel.

中文版：[README.md](README.md)

## Prerequisites

- A computer (Windows / Mac / Linux)
- A Minecraft server with NeoForge

## Step 1: Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (22.x) on the left
3. Run the installer, click "Next" all the way through

To verify (optional): open a terminal and type `node --version`. If you see a version number, it worked.

## Step 2: Start the Backend

- **Windows** → Double-click **`start.bat`** (first time) or **`run.bat`** (daily use)
- **Mac / Linux** → Open a terminal and run `./start.sh` or `./run.sh`

First time users: double-click **`start.bat`**. It will download dependencies and build the web page. When you see the line below, it's ready. Keep this window open (closing it stops the server):

```
Backend (HTTP) running at http://localhost:27890
```

After the first setup, use **`run.bat`** next time (it starts faster since everything is already downloaded).

## Step 3: Open the Web Panel

Open your browser and go to **http://localhost:27890**.

## Step 4: Install the Mod

Put the compiled `tracesession.jar` into your Minecraft server's `mods/` folder, then start the server. The mod will automatically connect to the web backend.

## Daily Use

1. Double-click **`run.bat`** (Windows) or run `./run.sh` (Mac/Linux)
2. Open **http://localhost:27890** in your browser

## What the Mod Does

The mod runs silently in the background once installed:

- **Heartbeat** — Sends a signal every 30 seconds to confirm the server is online, along with TPS, MSPT, game mode, and mod loader info
- **Player tracking** — Records when players join, leave, or die
- **Chat sync** — In-game chat appears on the web panel; you can also broadcast messages from the web to the game
- **Command execution** — Enter commands in the web console and the mod runs them in-game

## Web Panel Features

- **Dashboard** — See all servers' online status and player counts at a glance
- **Server details** — TPS/MSPT charts, online players, console, chat log
- **Player analytics** — Playtime, daily trends, active hours, death count for each player
- **Live events** — Real-time player join/leave notifications

---

> If your Minecraft server and web panel are on different computers, edit the mod's config file `config/tracesession-common.toml` and change the address to the web server's IP.