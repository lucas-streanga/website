#!/usr/bin/bash

rsync -a --delete "$(podman volume inspect website_node_modules --format '{{.Mountpoint}}')/" ./app/node_modules/
ext="$HOME/.local/share/zed/extensions/work/astro/node_modules"
ts="$PWD/app/node_modules/typescript"
if [ -f "$ts/lib/typescript.js" ]; then
  rm -rf "$ext/typescript"          # remove Zed's native TS (and the stray nested link)
  ln -s "$ts" "$ext/typescript"     # point the extension at our classic build
else
  echo "WARN: $ts has no lib/typescript.js (native TS?) — astro LSP needs the classic build" >&2
fi
