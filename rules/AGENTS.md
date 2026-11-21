# StupidMirror Phone Automation

Whenever the user asks to view, show, mirror, annotate, inspect, test, or operate a real iPhone, Android phone, iOS Simulator, or Android emulator, use the StupidMirror MCP server (`stupidmirror_mcp`) together with its bundled skills:

- Load `stupidmirror-live-screen` whenever the user wants to see the phone screen in Antigravity's side pane, open the live mirror, or send screenshot annotations (`[StupidMirror 截图标注]`) from the side panel.
- Load `stupidmirror-device-use` when reading the screen or performing device actions.
- Load `stupidmirror-setup` for installation, pairing, or connection troubleshooting.

Always call `show_screen` first in a phone conversation to start background capture, and surface the native side-pane pill `[StupidMirror](sidecar://stupidmirror/phone-screen/)` so the user can open the live phone mirror and annotate screenshots directly into chat. When a `[StupidMirror 截图标注]` message arrives with a PNG path, read that PNG with `read_file` first.
