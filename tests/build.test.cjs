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
  fs.cpSync(path.join(root, 'assets'), path.join(dir, 'assets'), {recursive:true});
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

test('missing Node cannot overwrite the previous artifact with unchecked code', t => {
  const dir = fixture(t);
  fs.unlinkSync(path.join(dir, 'bin/node'));
  fs.mkdirSync(path.join(dir, 'dist'));
  fs.writeFileSync(path.join(dir, 'dist/index.html'), 'previous valid artifact');
  const result = build(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Node/);
  assert.equal(fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8'), 'previous valid artifact');
});

test('a failing minifier falls back to checked uncompressed output', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'bin/terser'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const result = build(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /未压缩/);
  assert.match(fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8'), /水墨江城/);
});

test('exported bridges and west garden models retain valid triangles on the web coordinate grid', () => {
  const source = fs.readFileSync(path.join(root, 'src/architecture.gen.js'), 'utf8');
  const models = require('node:vm').runInNewContext(source + '\nARCHITECTURE');
  assert.ok(models.yingwuzhou.suspensionOrange[3], 'round main cables retain their authored shading');
  const materialCounts = { bridge: 5, yingwuzhou: 5, park_paifang: 8, park_stupa: 3, park_cranes: 5, park_pavilion: 6 };
  for (const [name, minimum] of Object.entries(materialCounts)) {
    const batches = Object.entries(models[name]);
    assert.ok(batches.length >= minimum, name);
    for (const [material, [coordinates, triangles, visibility, smooth]] of batches) {
      const points = Buffer.from(coordinates, 'base64'), index = Buffer.from(triangles, 'base64');
      const count = points.length / 6, seen = new Set();
      assert.equal(Buffer.from(visibility, 'base64').length, count);
      assert.equal(index.length % 6, 0);
      if (smooth) {
        const ranges = Buffer.from(smooth, 'base64');
        assert.equal(ranges.length % 8, 0);
        let previousEnd = 0;
        for (let i=0; i<ranges.length; i+=8) {
          const start = ranges.readUInt32LE(i), end = ranges.readUInt32LE(i+4);
          assert.ok(start >= previousEnd && start < end && end <= index.length/2);
          assert.equal(start % 3, 0);
          assert.equal(end % 3, 0);
          previousEnd = end;
        }
      }
      for (let k = 0; k < index.length; k += 6) {
        const ids = [0, 2, 4].map(delta => index.readUInt16LE(k + delta));
        assert.ok(ids.every(i => i < count), name + '/' + material);
        const [a, b, c] = ids.map(i => [0, 2, 4].map(j => points.readInt16LE(i * 6 + j)));
        const u = b.map((n, i) => n - a[i]), v = c.map((n, i) => n - a[i]);
        assert.ok(u.some((n, i) => n * v[(i + 1) % 3] !== u[(i + 1) % 3] * v[i]), 'zero-area face');
        const key = ids.sort((x, y) => x - y).join(',');
        assert.ok(!seen.has(key), 'coincident triangle');
        seen.add(key);
      }
    }
  }
});
