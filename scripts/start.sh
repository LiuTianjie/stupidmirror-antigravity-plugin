#!/bin/bash
set -euo pipefail

app_path="${STUPIDMIRROR_APP:-/Applications/StupidMirror.app}"
for location_file in \
  "$HOME/Library/Application Support/StupidMirror/Antigravity/app-path" \
  "$HOME/Library/Application Support/StupidMirror/Codex/app-path"; do
  if [ -z "${STUPIDMIRROR_APP:-}" ] && [ -f "$location_file" ]; then
    IFS= read -r saved_app_path < "$location_file"
    if [ -x "$saved_app_path/Contents/Helpers/StupidMirrorMCPBridge" ]; then
      app_path="$saved_app_path"
      break
    fi
  fi
done
if [ -z "${STUPIDMIRROR_APP:-}" ] && [ ! -x "$app_path/Contents/Helpers/StupidMirrorMCPBridge" ] && [ -d "$HOME/Applications/StupidMirror.app" ]; then
  app_path="$HOME/Applications/StupidMirror.app"
fi
helper="$app_path/Contents/Helpers/StupidMirrorMCPBridge"
if [ ! -x "$helper" ]; then
  echo "StupidMirror's MCP helper is missing. Install StupidMirror in Applications, or set STUPIDMIRROR_APP to its .app path. See the stupidmirror-setup skill." >&2
  exit 1
fi
exec "$helper" --app "$app_path"
