#!/bin/bash
set -euo pipefail

app_path="${STUPIDMIRROR_APP:-/Applications/StupidMirror.app}"
for location_file in \
  "$HOME/Library/Application Support/StupidMirror/Clients/app-path" \
  "$HOME/Library/Application Support/StupidMirror/Antigravity/app-path" \
  "$HOME/Library/Application Support/StupidMirror/Codex/app-path"; do
  if [ -z "${STUPIDMIRROR_APP:-}" ] && [ -f "$location_file" ]; then
    IFS= read -r saved_app_path < "$location_file"
    if [ -d "$saved_app_path" ]; then
      app_path="$saved_app_path"
      break
    fi
  fi
done
if [ -z "${STUPIDMIRROR_APP:-}" ] && [ ! -d "$app_path" ] && [ -d "$HOME/Applications/StupidMirror.app" ]; then
  app_path="$HOME/Applications/StupidMirror.app"
fi

helper="$app_path/Contents/Helpers/StupidMirrorMCPBridge"
if [ -x "$helper" ]; then
  exec "$helper" --app "$app_path" --client antigravity
fi

electron_bin="$app_path/Contents/MacOS/StupidMirror"
bridge_js="$app_path/Contents/Resources/app.asar.unpacked/out/bridge/mcpBridge.js"
if [ -x "$electron_bin" ] && [ -f "$bridge_js" ]; then
  ELECTRON_RUN_AS_NODE=1 exec "$electron_bin" "$bridge_js" --app "$app_path" --client antigravity
fi

echo "StupidMirror's MCP helper is missing. Install StupidMirror in Applications, or set STUPIDMIRROR_APP to its .app path. See the stupidmirror-setup skill." >&2
exit 1
