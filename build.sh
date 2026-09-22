#!/usr/bin/env bash
# 拼接源文件为单文件 HTML；开发工具不可用时仍可输出未压缩版本。
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

TMPDIR_BUILD="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BUILD"' EXIT
JS="$TMPDIR_BUILD/bundle.js"
MINJS_OUT="$TMPDIR_BUILD/bundle.min.js"

{
  printf '(function () {\n'
  cat src/00-boot.js
  printf '\nasync function initialize() {\nawait loadDependencies();\nif (app.state !== "loading") return;\n'
  cat src/01-core.js src/02-landmarks.js src/03-terrain.js src/04-scene.js src/05-runtime.js src/06-audio.js
  printf '\napp.ready();\n}\ninitialize().catch(() => app.fail("三维场景未能初始化，请检查浏览器图形加速后重新加载。"));\n})();\n'
} > "$JS"

MINJS="$JS"
MODE="未做语法检查，node 不可用"
if command -v node >/dev/null 2>&1; then
  if ! node --check "$JS"; then
    echo "语法检查未通过，已中止构建，dist/index.html 未更新" >&2
    exit 1
  fi
  MODE="语法检查通过，未压缩（terser 不可用）"
  TERSER=""
  if [ -x node_modules/.bin/terser ]; then
    TERSER="node_modules/.bin/terser"
  elif command -v terser >/dev/null 2>&1; then
    TERSER="$(command -v terser)"
  fi
  if [ -n "$TERSER" ] && "$TERSER" "$JS" -c -m -o "$MINJS_OUT" >/dev/null 2>&1 \
     && node --check "$MINJS_OUT" >/dev/null 2>&1; then
    MINJS="$MINJS_OUT"
    MODE="语法检查通过，已用 terser 压缩"
  fi
fi

{
  cat src/00-shell.html
  printf '<script>\n'
  cat "$MINJS"
  printf '\n</script>\n'
} > "$TMPDIR_BUILD/index.html"
cp "$TMPDIR_BUILD/index.html" dist/index.html
printf '构建完成：dist/index.html（%s）\n' "${MODE}"
