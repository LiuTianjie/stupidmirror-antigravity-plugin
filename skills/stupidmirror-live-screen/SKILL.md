---
name: stupidmirror-live-screen
description: Open and display the live StupidMirror phone screen in Antigravity's native side pane (`sidecar://stupidmirror/phone-screen/`), switch devices, and receive screenshot annotations sent directly from the phone panel into the Antigravity chat. Trigger whenever the user asks to show/open their phone screen in the side panel, watch the live phone mirror, or annotate the phone screen for Antigravity.
---

# Show the Live Phone Screen in Antigravity's Side Pane

The `stupidmirror` Antigravity plugin includes a native side-pane UI extension (`sidecar://stupidmirror/phone-screen/`) with live video, manual touch control, device switching, and **freeze-and-annotate** (`标注`) that sends numbered screenshot boxes and notes straight into this Antigravity chat.

## 1. Show the Live Side Pane (Default, Instant)

1. Start background capture immediately by calling `show_screen` (from `stupidmirror_mcp`).
   - Omit `device_id` if only one connected device is expected; StupidMirror automatically selects the sole connected device (even if other paired wireless devices are offline).
   - If `show_screen` asks to choose among multiple **connected** devices, call `list_devices`, pick the intended connected device, and call `show_screen` with its `device_id`.
2. In your reply, always surface the one-click native side-pane pill on its own line:

```markdown
[StupidMirror](sidecar://stupidmirror/phone-screen/)
```

   The user can click this pill (or the **StupidMirror** icon in Antigravity's auxiliary side pane) to open or toggle the live phone mirror immediately—no expiring tickets, no reloads, and full support for **标注** (screenshot annotations sent directly back to Antigravity).

## 2. Auto-Open in the Built-In Browser Pane (Only When Explicitly Asked to Open Without Clicking)

If the user explicitly says they want you to open the side pane automatically right now without clicking the pill (for example: "你帮我直接打开侧边画面", "open the screen pane for me"):

1. Call `open_viewer` (passing `device_id` when known) to start capture and get a fresh single-use viewer URL (`http://127.0.0.1:<port>/viewer#ticket=...`).
2. Immediately delegate opening that URL to the `browser` subagent (`Model: "flash"`) with a single clean instruction:
   - Open a clean tab to that exact URL **once** (never reload it; never click inside the phone screen) and leave the tab open.
3. Also include `[StupidMirror](sidecar://stupidmirror/phone-screen/)` in your reply so the user knows they can switch to the native StupidMirror side pane anytime for persistent viewing and direct screenshot annotations.

## 3. Receiving Screenshot Annotations from the Side Pane

In the native StupidMirror side pane, the user can click **标注** (Annotate) to freeze the live screen, draw numbered orange boxes (`1`, `2`, …), write an optional note, and press `⌘↵` to send directly into this conversation.

When a message arrives with `[StupidMirror 截图标注]` and a PNG file path:

1. Immediately call `read_file` on that PNG path to inspect the numbered boxes and the user's note.
2. Treat the annotated screenshot as a frozen reference—reobserve with `observe_screen` before tapping if the phone screen may have changed.
3. Never click or tap the phone unless the user explicitly asks you to act.
