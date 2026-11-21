# StupidMirror for Antigravity

Lets Antigravity see and operate a real iPhone or Android phone, an iOS Simulator, or an Android emulator through the [StupidMirror](https://stupidmirror.itool.tech/) Mac app, with a native live phone mirror and screenshot annotation panel in Antigravity's side pane.

## Requirements

- **macOS 15 or later** with [StupidMirror](https://downloads.itool.tech/stupidmirror/index.html) installed in `/Applications/StupidMirror.app` (or point `STUPIDMIRROR_APP` to a custom `.app` path).
- Enable the local MCP server in **StupidMirror → Settings → MCP Automation**.
- One device is free; mirroring/controlling multiple devices simultaneously requires an [iTool Pro membership](https://www.itool.tech/pro?product=stupidmirror).

## Install

- **Antigravity Marketplace / CLI**: Install this plugin from the Antigravity Marketplace, or via CLI:
  ```bash
  agy plugin install https://github.com/LiuTianjie/stupidmirror-antigravity-plugin
  ```
- **From StupidMirror App**: Open **Settings → MCP Automation** and click **Connect** on the Antigravity card.

## What is in this plugin

- `mcp_config.json`: connects Antigravity to the local StupidMirror MCP server via the app's signed stdio helper (`StupidMirrorMCPBridge`).
- `sidecars/phone-screen`: native Antigravity auxiliary side-pane UI extension (`sidecar://stupidmirror/phone-screen/`) showing the live phone mirror with touch control and freeze-and-annotate directly into the active Antigravity chat.
- `skills/stupidmirror-live-screen`: opens the live side pane, switches devices, and handles annotated screenshots sent from the side pane.
- `skills/stupidmirror-device-use`: reads the screen and operates the phone efficiently.
- `skills/stupidmirror-setup`: installs, connects, and repairs the app and its devices.
- `rules/AGENTS.md`: guides Antigravity to use StupidMirror's side pane, skills, and screenshot annotations when a task involves a phone.
- `hooks.json`: reminds the agent once per conversation to start capture with `show_screen` (or `open_viewer`) and surface the side-pane pill.

## Network and data

- The MCP server runs inside the StupidMirror app and listens only on `127.0.0.1`. Antigravity reaches it through the app's signed stdio helper (`StupidMirror.app/Contents/Helpers/StupidMirrorMCPBridge`) and the local sidecar proxy (`sidecars/phone-screen/main.mjs`), which both read the local port and bearer token themselves—no token is written into Antigravity's configuration or exposed to browser pages.
- Screenshots, screen text, annotated PNGs, and the device's UI tree stay local on your Mac and are sent to Antigravity only when a tool returns them or when you click Send in the annotation editor.
- This plugin itself makes no external network requests. See the [Privacy Policy](https://www.itool.tech/en/privacy).

## License

StupidMirror is licensed under [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). For commercial licensing, see [iTool Pro / Commercial Licensing](https://www.itool.tech/pro?product=stupidmirror).
