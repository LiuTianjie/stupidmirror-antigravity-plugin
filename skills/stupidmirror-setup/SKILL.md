---
name: stupidmirror-setup
description: Set up or repair the StupidMirror Antigravity plugin and its real iPhone or Android connection. Use for plugin installation, missing tools, side-pane troubleshooting, device discovery or connection errors; ordinary phone tasks use stupidmirror-device-use and live screen viewing uses stupidmirror-live-screen.
---

# StupidMirror setup for Antigravity

StupidMirror is a local macOS app. This Antigravity plugin launches its signed MCP helper (`StupidMirror.app/Contents/Helpers/StupidMirrorMCPBridge`), which starts the app in the background if needed and connects to its authenticated loopback MCP service, plus a native Antigravity sidecar UI extension (`sidecars/phone-screen`) that renders the live phone mirror and screenshot annotation editor directly inside Antigravity's auxiliary side pane.

1. If StupidMirror tools are available, call `list_devices` and `get_diagnostics` before changing configuration. Reuse healthy device sessions.
2. The normal installation path is **StupidMirror → Settings → MCP Automation → Connect Antigravity**. That installs this plugin into `~/.gemini/config/plugins/stupidmirror/` and records the app path so Antigravity picks it up automatically with no token or config file to edit. If the helper is missing, install StupidMirror in `/Applications/StupidMirror.app` (or set `STUPIDMIRROR_APP` to a custom `.app` path).
3. In StupidMirror, **Settings → MCP Automation** must have the MCP server enabled. The app manages its own port and Bearer token; never print or copy `~/Library/Application Support/StupidMirror/MCP/connection.json` into chat, the repository or any plugin directory. Do not disable authentication or expose the listener beyond `127.0.0.1`.
4. After installing or updating the plugin, Antigravity discovers it automatically and its skills, sidecar pane, and MCP tools are available on the next turn. If the `stupidmirror` plugin was disabled in Antigravity Customizations, re-enable it there.
5. With several connected devices, select the user's intended device and pass its `device_id`. Call `show_screen` to start background capture, surface `[StupidMirror](sidecar://stupidmirror/phone-screen/)` to open the live side pane (or `open_viewer` if opening in the built-in browser pane), and call `connect_control` only when actions or native hierarchy are needed. Do not open a separate native mirror window unless explicitly requested.

For initial iPhone setup, use StupidMirror's iPhone setup guide with the user's own Xcode team and bundle identifier. Apple account login, device trust, Developer Mode and unlocking may need the user. Existing paired devices should not be rebuilt just to recover a connection. Do not start a second WDA/Appium stack alongside StupidMirror. Android requires USB debugging and the phone's authorization prompt.

Verify tool availability separately from device readiness: `list_devices` proves the plugin can reach the app; `observe_screen` proves an actual frame is available; a user-authorized reversible action followed by observation proves control. If no device is attached, report that boundary without claiming a successful phone test.
