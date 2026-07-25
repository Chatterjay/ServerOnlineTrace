# TraceSession Release

This branch is for end users.

Download these two files:

- `TraceSession-OneClick.bat`
- `tracesession-1.21.1-1.0.neoforge.jar`

## Usage

1. Put `tracesession-1.21.1-1.0.neoforge.jar` into your Minecraft server `mods` folder.
2. Double-click `TraceSession-OneClick.bat`.
3. Open `http://localhost:27890`.

The first run downloads and prepares the Web panel. Later runs use the same BAT for fast startup.

If the Minecraft server and Web panel are on different machines, edit:

```text
config/tracesession-common.toml
```

Set `backendUrl` to the Web panel machine IP:

```toml
backendUrl = "http://192.168.1.100:27890"
```

Source code is kept on the `master` branch.
