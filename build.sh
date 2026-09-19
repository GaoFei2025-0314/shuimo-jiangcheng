#!/usr/bin/env bash
# 把 src/ 拼成单文件 HTML。Artifact 与任何静态服务器都能直接吃。
set -euo pipefail
cd "$(dirname "$0")"

RAW="$(mktemp)"
JS="$(mktemp --suffix=.js)"
MINJS_OUT="${JS%.js}.min.js"
trap 'rm -f "$RAW" "$JS" "$MINJS_OUT"' EXIT

{
  cat src/00-shell.html
  printf '<script>\n(function () {\n'
  cat src/01-core.js src/02-landmarks.js src/03-terrain.js src/04-scene.js src/05-runtime.js
  printf '})();\n</script>\n'
} > "$RAW"

# 只取内联 <script> 里的那段拼接代码来做检查/压缩，HTML、CSS、GLSL 字符串原样不动
sed -n '/^<script>$/,/^<\/script>$/p' "$RAW" | sed '1d;$d' > "$JS"

if ! command -v node >/dev/null 2>&1; then
  cp "$RAW" dist/index.html
  echo "构建完成：dist/index.html（未做语法检查，node 不可用）"
  exit 0
fi

if ! node --check "$JS"; then
  echo "语法检查未通过，已中止构建，dist/index.html 未更新" >&2
  exit 1
fi

MINJS="$JS"; MODE="语法检查通过，未压缩（terser 不可用）"
if command -v npx >/dev/null 2>&1 && npx --yes terser "$JS" -c -m -o "$MINJS_OUT" >/dev/null 2>&1 \
   && node --check "$MINJS_OUT" >/dev/null 2>&1; then
  MINJS="$MINJS_OUT"; MODE="语法检查通过，已用 terser 压缩"
fi

{
  sed -n '1,/^<script>$/p' "$RAW"
  cat "$MINJS"
  printf '\n'
  sed -n '/^<\/script>$/,$p' "$RAW"
} > dist/index.html

echo "构建完成：dist/index.html（$MODE）"
