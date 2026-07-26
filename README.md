# TraceSession

TraceSession is a Minecraft server playtime and status tracking system.

It has two parts:

- **TraceSession Mod**: put this JAR into the Minecraft server `mods` folder.
- **Web panel/backend**: stores data in SQLite and provides the browser dashboard.

Default panel URL:

```text
http://localhost:27890
```

## End User Install

For normal users, distribute these files:

- Windows: `TraceSession-OneClick.bat`
- Linux/macOS: `TraceSession-OneClick.sh`
- Mod JAR: `tracesession-1.21.1-1.0.neoforge.jar`

First run:

```bat
TraceSession-OneClick.bat
```

or:

```bash
chmod +x TraceSession-OneClick.sh
./TraceSession-OneClick.sh
```

The first run downloads Node.js if needed, downloads the Web panel, installs dependencies, builds the frontend, initializes SQLite, and starts the server.

Later runs use the same script for fast startup.

## Updating The Web Panel

The Mod JAR is still updated manually by replacing the file in the Minecraft server `mods` folder.

The Web panel can be updated with one command.

Windows:

```bat
TraceSession-OneClick.bat update
```

Linux/macOS:

```bash
./TraceSession-OneClick.sh update
```

`update` will:

- stop an existing TraceSession process on port `27890`
- save SQLite data into `TraceSession-Data`
- download the latest Web panel from `master`
- reinstall dependencies
- rebuild the frontend
- restore the database
- start the updated Web panel

## Reinstalling The Web Panel

Use this when dependencies are broken or the local Web panel folder is damaged.

Windows:

```bat
TraceSession-OneClick.bat reinstall
```

Linux/macOS:

```bash
./TraceSession-OneClick.sh reinstall
```

`reinstall` keeps the SQLite database, removes the old `TraceSession-Web` folder, downloads a fresh copy, installs dependencies, rebuilds, and starts.

## Data Location

The one-click scripts keep user data in:

```text
TraceSession-Data/tracesession.db
```

During startup the database is restored into the Web backend folder so Prisma can use it. Do not delete `TraceSession-Data` unless you intentionally want to remove tracking history.

## Minecraft Server Config

After the Mod starts once, it creates:

```text
config/tracesession-common.toml
```

Default local setup:

```toml
backendUrl = "http://localhost:27890"
```

If the Minecraft server and Web panel are on different machines, replace `localhost` with the Web panel machine IP:

```toml
backendUrl = "http://192.168.1.100:27890"
```

Restart the Minecraft server after changing the config.

## Source Checkout Usage

If you downloaded the full source repository, use:

Windows:

```bat
start.bat
```

Linux/macOS:

```bash
chmod +x start.sh
./start.sh
```

For development mode, use:

```bat
dev.bat
```

or:

```bash
./dev.sh
```

## Features

The Mod reports:

- server online/offline state
- TPS, MSPT, game mode, game version, and mod loader
- player join, leave, and death events
- player playtime
- in-game chat
- commands sent from the Web panel

The Web panel shows:

- dashboard
- server details
- online players
- TPS/MSPT charts
- player statistics
- realtime events
- chat and command console

## Common Issues

### `No DATABASE_URL found, using SQLite...`

This is normal. It means PostgreSQL is not configured and the app is using the default SQLite database.

### `A datasource block is missing in the Prisma schema file`

`Timing Server Record Backend/backend/prisma/schema.prisma` is missing or damaged. Restore the full schema from the repository.

### Mod heartbeat fails

The Web backend is probably not running, or `backendUrl` is wrong.

Check that this opens in a browser:

```text
http://localhost:27890
```

Then check:

```text
config/tracesession-common.toml
```

If the Web panel is on another machine, do not use `localhost`; use that machine's IP.

### `listen EADDRINUSE: address already in use :::27890`

Port `27890` is already in use.

The current scripts first check the port:

- if TraceSession is already running, the old process is stopped and a fresh one starts
- if another program owns the port, the script prints the PID and exits

Manual Windows check:

```powershell
Get-NetTCPConnection -LocalPort 27890 -State Listen
```

Manual Linux check:

```bash
ss -ltnp 'sport = :27890'
```
