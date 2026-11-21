#!/bin/bash
# Ensures the first StupidMirror call in an Antigravity conversation starts
# background capture via show_screen (or open_viewer) and reminds the agent
# to surface the native sidecar pane pill. Never blocks unrelated MCP tools
# and never fails a tool call on its own errors.
set -u
mode="${1:-pre}"
input="$(cat 2>/dev/null || true)"

allow_out() {
  if [ "$mode" = "post" ]; then
    printf '{}\n'
  else
    printf '{"decision":"allow"}\n'
  fi
  exit 0
}

[ -n "$input" ] || allow_out

jq_bin=""
if [ -x /usr/bin/jq ]; then
  jq_bin="/usr/bin/jq"
elif command -v jq >/dev/null 2>&1; then
  jq_bin="$(command -v jq)"
fi
[ -n "$jq_bin" ] || allow_out

parsed="$(printf '%s' "$input" | "$jq_bin" -r '[
  (.conversationId // ""),
  (.toolCall.name // ""),
  (.toolCall.args.ServerName // .toolCall.args.serverName // ""),
  (.toolCall.args.ToolName // .toolCall.args.toolName // ""),
  (.error // "")
] | join("\u001f")' 2>/dev/null || true)"
[ -n "$parsed" ] || allow_out

IFS=$'\x1f' read -r conv_id tool_name server_name mcp_tool_name tool_error <<< "$parsed"
conv_id="$(printf '%s' "$conv_id" | tr -cd 'A-Za-z0-9_-')"
[ -n "$conv_id" ] || allow_out

target_tool=""
if [ "$tool_name" = "call_mcp_tool" ]; then
  server_lower="$(printf '%s' "$server_name" | tr '[:upper:]' '[:lower:]')"
  case "$server_lower" in
    *stupidmirror*) target_tool="$mcp_tool_name" ;;
    *) allow_out ;;
  esac
else
  tool_lower="$(printf '%s' "$tool_name" | tr '[:upper:]' '[:lower:]')"
  case "$tool_lower" in
    *stupidmirror*) target_tool="$tool_lower" ;;
    *) allow_out ;;
  esac
fi

is_screen_or_transport=false
case "$target_tool" in
  show_screen|*_show_screen|open_viewer|*_open_viewer|screen_frame|*_screen_frame|screen_action|*_screen_action|screen_signal|*_screen_signal)
    is_screen_or_transport=true
    ;;
esac

state="${TMPDIR:-/tmp}/stupidmirror-antigravity-pane"
mkdir -p "$state" 2>/dev/null || allow_out
find "$state" -type f -mtime +2 -delete 2>/dev/null || true

if [ "$mode" = "post" ]; then
  case "$target_tool" in
    show_screen|*_show_screen|open_viewer|*_open_viewer)
      if [ -z "$tool_error" ]; then
        : > "$state/$conv_id.opened" 2>/dev/null || true
      fi
      ;;
  esac
  allow_out
fi

if [ "$is_screen_or_transport" = true ]; then
  allow_out
fi

# Remind at most once per conversation so the agent is never trapped in a loop.
if [ -e "$state/$conv_id.opened" ] || [ -e "$state/$conv_id.reminded" ]; then
  allow_out
fi
: > "$state/$conv_id.reminded" 2>/dev/null || true

reason="Start phone capture first: call StupidMirror show_screen (or open_viewer) now, and include [StupidMirror](sidecar://stupidmirror/phone-screen/) in your response so the user can open the native live phone mirror and annotate screenshots directly in Antigravity's side pane. Then retry this call."
printf '{"decision":"deny","reason":"%s"}\n' "$reason"
exit 0
