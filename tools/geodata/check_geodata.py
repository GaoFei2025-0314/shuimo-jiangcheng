#!/usr/bin/env python3
"""核对 src/geodata.gen.js：只看数据本身，不读栅格，因此 output/ 不在时也能跑。

    python3 tools/geodata/check_geodata.py [--file src/geodata.gen.js]

任何一条不过就以非零码退出，并把实际值打出来。
"""
import argparse
import base64
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
O = (114.29694, 30.54694)
M_LON = 111320 * math.cos(math.radians(30.55))
M_LAT = 110900
BBOX = (114.24, 30.50, 114.44, 30.61)
FAILED = []


def check(ok, msg):
    print(('  通过  ' if ok else '  不通过 ') + msg)
    if not ok:
        FAILED.append(msg)


def to_m(lon, lat):
    return (lon - O[0]) * M_LON, (lat - O[1]) * M_LAT


def load(path):
    s = Path(path).read_text(encoding='utf-8')
    i = s.index('const GEO = ')
    return json.loads(s[i + len('const GEO = '):s.rindex(';')])


def ring_area_km2(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, y0 = to_m(*pts[i])
        x1, y1 = to_m(*pts[(i + 1) % len(pts)])
        a += x0 * y1 - x1 * y0
    return abs(a) / 2 / 1e6


def segments_cross(p, q, r, s):
    def d(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2, d3, d4 = d(r, s, p), d(r, s, q), d(p, q, r), d(p, q, s)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def self_intersects(pts):
    n = len(pts)
    for i in range(n):
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            if segments_cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]):
                return True
    return False


def point_in(pts, pt):
    c = False
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[i - 1]
        if (y0 > pt[1]) != (y1 > pt[1]) and pt[0] < (x1 - x0) * (pt[1] - y0) / (y1 - y0) + x0:
            c = not c
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', default=str(ROOT / 'src' / 'geodata.gen.js'))
    a = ap.parse_args()
    path = Path(a.file)
    if not path.exists():
        print('没有 %s，先跑 tools/geodata/extract.py' % path)
        return 1
    G = load(path)
    size = len(path.read_bytes()) / 1024
    print('%s：%.1f KB' % (path, size))
    check(size <= 20, '体积不超过 20 KB（实际 %.1f）' % size)

    print('河道')
    for nm, key, lo, hi in [('长江', 'yangtze', 300, 1300), ('汉水', 'hanshui', 80, 400)]:
        pts = G[key]
        check(len(pts) >= 40, '%s 中泓线点数 ≥40（实际 %d）' % (nm, len(pts)))
        hw = [p[2] for p in pts]
        mid = [p[2] for p in pts if BBOX[0] <= p[0] <= BBOX[2] and BBOX[1] <= p[1] <= BBOX[3]]
        check(bool(mid), '%s 有落在取景框内的点（实际 %d）' % (nm, len(mid)))
        check(lo <= max(mid) <= hi, '%s 框内最大半宽在 %d–%d 米（实际 %d）' % (nm, lo, hi, max(mid)))
        check(min(hw) >= 80, '%s 半宽不小于 80 米（实际 %d）' % (nm, min(hw)))
        gaps = [math.hypot(*[b - a for a, b in zip(to_m(*pts[i][:2]), to_m(*pts[i + 1][:2]))]) for i in range(len(pts) - 1)]
        check(max(gaps) <= 900, '%s 相邻点间距不超过 900 米（实际 %d）' % (nm, max(gaps)))

    print('湖')
    lakes = G['lakes']
    check(lakes[0]['name'] == '东湖', '第一个湖是东湖（实际 %r）' % lakes[0]['name'])
    names = [L['name'] for L in lakes]
    check('月湖' in names, '月湖在列（古琴台临月湖）：%s' % names)
    for L in lakes:
        nm = L['name'] or '无名'
        ar = ring_area_km2(L['pts'])
        check(len(L['pts']) >= 8, '%s 轮廓点数 ≥8（实际 %d）' % (nm, len(L['pts'])))
        check(ar >= .15, '%s 面积 ≥0.15 km²（实际 %.2f）' % (nm, ar))
        check(not self_intersects(L['pts']), '%s 轮廓不自交' % nm)
    check(24 <= ring_area_km2(lakes[0]['pts']) <= 34, '东湖面积 24–34 km²（实际 %.1f）' % ring_area_km2(lakes[0]['pts']))

    print('东湖舟行椭圆')
    b = G['lakeBoat']
    check(b['rx'] >= 600 and b['rz'] >= 600, '半轴均 ≥600 米（实际 %d×%d）' % (b['rx'], b['rz']))
    ce, cn = to_m(*b['c'])
    outside = 0
    for k in range(72):
        t = k / 72 * 2 * math.pi
        e, n = ce + b['rx'] * math.cos(t), cn + b['rz'] * math.sin(t)
        if not point_in(lakes[0]['pts'], (O[0] + e / M_LON, O[1] + n / M_LAT)):
            outside += 1
    check(outside == 0, '椭圆整圈在东湖里（出界 %d/72）' % outside)

    print('山')
    hills = G['hills']
    named = {h['name']: h for h in hills if h['name']}
    for nm, lo, hi in [('蛇山', 61, 63), ('龟山', 66, 68), ('珞珈山', 94, 97), ('磨山', 94, 96), ('洪山', 20, 60)]:
        check(nm in named, '%s 在列' % nm)
        if nm in named:
            r = named[nm]['relief']
            check(lo <= r <= hi, '%s 起伏 %d–%d 米（实际 %.1f）' % (nm, lo, hi, r))
    for h in hills:
        nm = h['name'] or '无名'
        q = base64.b64decode(h['q'])
        check(len(q) == h['nx'] * h['nz'], '%s 格子长度对得上 nx×nz（%d vs %d）' % (nm, len(q), h['nx'] * h['nz']))
        check(abs(max(q) * .5 - h["relief"]) < .4, '%s 格子峰值与 relief 一致（%.1f vs %.1f）' % (nm, max(q) * .5, h['relief']))
        check(BBOX[0] <= h['peak'][0] <= BBOX[2] and BBOX[1] <= h['peak'][1] <= BBOX[3], '%s 峰顶在取景框内 %s' % (nm, h['peak']))
        if not h['name']:
            check(h['relief'] <= 60, '无名山按距离压低后 ≤60 米（实际 %.1f）' % h['relief'])
    for nm, ref, lim in [('龟山', (114.2748, 30.5579), 500), ('磨山', (114.4124, 30.5510), 900)]:
        if nm in named:
            d = math.hypot(*[b - a for a, b in zip(to_m(*ref), to_m(*named[nm]['peak']))])
            check(d <= lim, '%s 峰顶距参考点 ≤%d 米（实际 %.0f）' % (nm, lim, d))

    print()
    if FAILED:
        print('不通过 %d 条：' % len(FAILED))
        for m in FAILED:
            print('  - ' + m)
        return 1
    print('全部通过')
    return 0


if __name__ == '__main__':
    sys.exit(main())
