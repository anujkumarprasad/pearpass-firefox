#!/usr/bin/env bash
# PearPass native messaging host for Firefox.
# Speaks the same stdio bridge as the desktop app. Stdout is the protocol
# stream, so status text goes to stderr only.
set -euo pipefail
shopt -s nullglob

mount=""
for dir in /tmp/.mount_Pear*; do
  if [[ -x "$dir/pearpass-app-desktop.bin" && -f "$dir/resources/app/dist/native-messaging-bridge.bundle.cjs" ]]; then
    mount="$dir"
    break
  fi
done

if [[ -z "$mount" ]]; then
  echo "PearPass desktop is not running. Start the PearPass AppImage, then try the extension again." >&2
  exit 1
fi

export ELECTRON_RUN_AS_NODE=1
exec "$mount/pearpass-app-desktop.bin" "$mount/resources/app/dist/native-messaging-bridge.bundle.cjs"
