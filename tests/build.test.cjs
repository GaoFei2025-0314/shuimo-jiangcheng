const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiangcheng-build-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true });
  fs.copyFileSync(path.join(root, 'build.sh'), path.join(dir, 'build.sh'));
  fs.mkdirSync(path.join(dir, 'bin'));
  for (const cmd of ['mkdir', 'mktemp', 'rm', 'dirname', 'cat', 'cp', 'mv', 'sed']) {
    const executable = spawnSync('/bin/sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).stdout.trim();
    fs.symlinkSync(executable, path.join(dir, 'bin', cmd));
  }
  fs.symlinkSync(process.execPath, path.join(dir, 'bin/node'));
  return dir;
}
function build(dir, compress = false) {
  return spawnSync('/bin/bash', ['build.sh'], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, LANG: 'en_US.UTF-8', PATH: path.join(dir, 'bin') + (compress ? ':' + path.join(root, 'node_modules/.bin') : '') }
  });
}

test('build succeeds on system Bash when compression is unavailable', t => {
  const dir = fixture(t), result = build(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /未压缩/);
  assert.match(fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8'), /水墨江城/);
});

test('build validates and compresses the application with the installed terser', t => {
  const dir = fixture(t), result = build(dir, true);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /已用 terser 压缩/);
});

test('a syntax error does not replace the previous artifact', t => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, 'dist'));
  fs.writeFileSync(path.join(dir, 'dist/index.html'), 'previous valid artifact');
  fs.appendFileSync(path.join(dir, 'src/05-runtime.js'), '\nconst broken = ;');
  assert.notEqual(build(dir).status, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8'), 'previous valid artifact');
});

test('shell inline scripts are preserved without being mixed into the application bundle', t => {
  const dir = fixture(t);
  fs.appendFileSync(path.join(dir, 'src/00-shell.html'), '\n<script>\nwindow.shellCheck = true;\n</script>\n');
  const result = build(dir);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8');
  assert.equal((html.match(/window.shellCheck = true/g) || []).length, 1);
});
