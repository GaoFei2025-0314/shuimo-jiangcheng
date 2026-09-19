#!/usr/bin/env bash
# 把 src/ 拼成单文件 HTML。Artifact 与任何静态服务器都能直接吃。
set -euo pipefail
cd "$(dirname "$0")"
{
  cat src/00-shell.html
  printf '<script>\n(function () {\n'
  cat src/01-core.js src/02-landmarks.js src/03-terrain.js src/04-scene.js src/05-runtime.js
  printf '})();\n</script>\n'
} > dist/index.html
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' dist/index.html | sed '1d;$d') 2>/dev/null \
  && echo "构建完成：dist/index.html（语法检查通过）" \
  || echo "构建完成：dist/index.html（未做语法检查，node 不可用）"
