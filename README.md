# TraceSession Release

This branch is for end users.

Download the files you need:

- Windows: `TraceSession-OneClick.bat`
- Linux/macOS: `TraceSession-OneClick.sh`
- Minecraft Mod: `tracesession-1.21.1-1.0.neoforge.jar`

## Start

Windows:

```bat
TraceSession-OneClick.bat
```

Linux/macOS:

```bash
chmod +x TraceSession-OneClick.sh
./TraceSession-OneClick.sh
```

Open:

```text
http://localhost:27890
```

## Update Web Panel

The Mod JAR is updated manually by replacing the file in the Minecraft server `mods` folder.

The Web panel can update itself:

```bat
TraceSession-OneClick.bat update
```

or:

```bash
./TraceSession-OneClick.sh update
```

## Reinstall Web Panel

Use this if the local Web panel is broken:

```bat
TraceSession-OneClick.bat reinstall
```

or:

```bash
./TraceSession-OneClick.sh reinstall
```

`update` and `reinstall` keep the SQLite database in:

```text
TraceSession-Data/tracesession.db
```

## Minecraft Config

Put the JAR into your Minecraft server `mods` folder.

If the Web panel and Minecraft server are on the same machine, keep:

```toml
backendUrl = "http://localhost:27890"
```

If they are on different machines, edit:

```text
config/tracesession-common.toml
```

Use the Web panel machine IP:

```toml
backendUrl = "http://192.168.1.100:27890"
```

Source code is kept on the `master` branch.
