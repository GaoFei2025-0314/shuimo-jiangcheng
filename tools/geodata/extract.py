#!/usr/bin/env python3
"""从 Copernicus GLO-30 提取场景用的河道、湖泊与山体，写出 src/geodata.gen.js。

    python3 tools/geodata/extract.py [--dem-dir output/dem-wuhan] [--out src/geodata.gen.js]

原则：数据定形，人工定高。
  河道——在水体掩膜里走最小代价路径，沿河心取中泓线，半宽取离岸距离。
        手绘中泓线只用来给起终点：它本身多数点并不在水上（长江 106 点里 69 点在岸上）。
  湖泊——水体掩膜高斯圆滑后取 0.5 等值线，去掉 30 米格网抖出的碎边。
  山体——DSM 含建筑，无法直接当地形用：只取「高出局部基面」的连通地块作形状，
        峰值改用实测海拔，东部无名山按距离衰减。
"""
import argparse
import base64
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from scipy import ndimage
from skimage import measure
from skimage.graph import route_through_array

ROOT = Path(__file__).resolve().parents[2]
O = (114.29694, 30.54694)                        # 黄鹤楼：场景原点，与 src/01-core.js 一致
M_LON = 111320 * math.cos(math.radians(30.55))
M_LAT = 110900
BBOX = (114.24, 30.50, 114.44, 30.61)            # 取景范围：山与湖只取此框内的
WORK = (114.03, 30.36, 114.53, 30.77)            # 工作窗口：盖住手绘河道全程

# 改动前 src/03-terrain.js 里的手绘中泓线，这里只取首尾两点作追踪的起终点
YANGTZE_GUIDE = [
    [114.1800, 30.3800, 600], [114.1950, 30.4100, 620], [114.2200, 30.4500, 640],
    [114.2510, 30.4870, 700], [114.2650, 30.5120, 650], [114.2760, 30.5310, 600],
    [114.2845, 30.5450, 570], [114.2880, 30.5560, 575], [114.2900, 30.5660, 600],
    [114.2988, 30.5760, 625], [114.3082, 30.5865, 680], [114.3215, 30.5950, 750],
    [114.3400, 30.6020, 820], [114.3650, 30.6080, 900], [114.3950, 30.6120, 950],
    [114.4300, 30.6500, 980], [114.4700, 30.7000, 1000], [114.5000, 30.7400, 1000]]
HANSHUI_GUIDE = [
    [114.0600, 30.6220, 150], [114.1200, 30.6150, 145], [114.1700, 30.6050, 140],
    [114.2180, 30.5960, 135], [114.2340, 30.5905, 135], [114.2500, 30.5855, 140],
    [114.2640, 30.5790, 145], [114.2730, 30.5720, 150], [114.2800, 30.5660, 175],
    [114.2870, 30.5630, 215]]

HILL_SIGMA_M = 100.0     # 山体最后一道圆滑。150 米会把 250 米宽的龟山抹成 430 米宽的土包
PLAIN_TRUE_M = 23.0      # 武汉平原实际地面：去建筑后陆地中位 23.1 米（设计文档「可行性结论」）
# 有权威海拔的山：峰值改用此值。蛇山在 DSM 中已不成形，按山脊线人工补回
NAMED = {
    '蛇山':   {'ref': (114.3050, 30.5460), 'peak_m': 85.0},
    '龟山':   {'ref': (114.2748, 30.5579), 'peak_m': 90.0},
    '珞珈山': {'ref': (114.3655, 30.5372), 'peak_m': 118.5},
    '磨山':   {'ref': (114.4124, 30.5510), 'peak_m': 118.0},
    '洪山':   {'ref': (114.3354, 30.5326), 'peak_m': None},   # 无权威数据：用实测起伏
}
SHESHAN_AXIS = ((114.2930, 30.5476), (114.3170, 30.5444))
LAKE_NAMES = {'东湖': (114.3920, 30.5500), '沙湖': (114.3301, 30.5683), '月湖': (114.2542, 30.5599)}


def to_m(lon, lat):
    return (lon - O[0]) * M_LON, (lat - O[1]) * M_LAT


def to_ll(e, n):
    return O[0] + e / M_LON, O[1] + n / M_LAT


class Grid:
    """工作窗口里的栅格：行列 ↔ 经纬度 ↔ 米。"""

    def __init__(self, tr, shape):
        self.tr, self.h, self.w = tr, shape[0], shape[1]
        self.res = tr.a
        self.px_e, self.px_n = self.res * M_LON, self.res * M_LAT   # 单像素东西、南北向米数

    def sig(self, metres):                  # 各向异性的高斯 σ（行、列）
        return (metres / self.px_n, metres / self.px_e)

    def rc(self, lon, lat):
        c, r = ~self.tr * (lon, lat)
        return r, c

    def ll(self, r, c):                     # 像素中心的经纬度
        lon, lat = self.tr * (c + .5, r + .5)
        return lon, lat

    def px(self, metres):
        return metres / ((self.px_e + self.px_n) / 2)


def gauss(a, g, metres):
    return ndimage.gaussian_filter(a.astype(np.float32), g.sig(metres), mode='nearest')


def read(dem_dir):
    with rasterio.open(dem_dir / 'wuhan-glo30-elevation.tif') as ds:
        w = from_bounds(*WORK, ds.transform)
        dem = ds.read(1, window=w).astype(np.float32)
        tr = ds.window_transform(w)
    with rasterio.open(dem_dir / 'wuhan-glo30-water-mask.tif') as ds:
        wbm = ds.read(1, window=from_bounds(*WORK, ds.transform))
    assert dem.shape == wbm.shape, (dem.shape, wbm.shape)
    return dem, wbm, Grid(tr, dem.shape)


# ─────────────────────────── 河道 ───────────────────────────

def river_mask(wbm, g):
    """河道掩膜（类别 3）：闭运算补上船只、桥墩留下的小缺口。"""
    m = ndimage.binary_closing(wbm == 3, iterations=2)
    return ndimage.binary_opening(m, iterations=1)


def nearest_water(m, g, lon, lat, within_m=2500):
    r, c = g.rc(lon, lat)
    rr, cc = np.nonzero(m)
    d = np.hypot((rr - r) * g.px_n, (cc - c) * g.px_e)
    k = int(np.argmin(d))
    assert d[k] <= within_m, '离 %.4f,%.4f 最近的水面有 %.0f 米' % (lon, lat, d[k])
    return int(rr[k]), int(cc[k])


def trace_river(m, dt_m, g, start, end, step_m=500.0):
    """最小代价路径走河心：代价 = 1 / (1 + 离岸距离)，岸上极贵。沿程每 500 米取一点。"""
    cost = np.where(m, 1.0 / (1.0 + dt_m / 30.0), 1e3)
    path, _ = route_through_array(cost, nearest_water(m, g, *start), nearest_water(m, g, *end),
                                  fully_connected=True, geometric=True)
    path = np.array(path, dtype=float)
    seg = np.hypot(np.diff(path[:, 0]) * g.px_n, np.diff(path[:, 1]) * g.px_e)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], max(3, int(round(s[-1] / step_m)) + 1))
    r, c = np.interp(t, s, path[:, 0]), np.interp(t, s, path[:, 1])
    hw = ndimage.map_coordinates(dt_m, [r, c], order=1)
    # 沿程顺一遍：位置 σ=1 点（500 米），宽度 σ=1.5 点，去掉码头趸船留下的折角
    r = ndimage.gaussian_filter1d(r, 1.0, mode='nearest')
    c = ndimage.gaussian_filter1d(c, 1.0, mode='nearest')
    hw = np.maximum(ndimage.gaussian_filter1d(hw, 1.5, mode='nearest'), 80.0)
    out = []
    for ri, ci, wi in zip(r, c, hw):
        lon, lat = g.ll(ri, ci)
        out.append([round(float(lon), 5), round(float(lat), 5), int(round(float(wi)))])
    return out


# ─────────────────────────── 湖泊 ───────────────────────────

def lake_outlines(wbm, river_s, g):
    """东湖 σ=300 米取势；其余小湖 σ=90 米——300 米会把月湖这样的小湖整个抹掉。"""
    big = _lakes(wbm, river_s, g, 300.0, .3, only='东湖')
    small = _lakes(wbm, river_s, g, 90.0, .15, skip=big[0]['_comp'])
    lakes = big + small
    lakes.sort(key=lambda L: (L['name'] != '东湖', -L['area_km2']))
    assert lakes and lakes[0]['name'] == '东湖', '没找到东湖'
    return lakes


def _lakes(wbm, river_s, g, sigma_m, min_km2, only=None, skip=None):
    field = gauss(wbm == 2, g, sigma_m)
    sm = field > .5
    if skip is not None:
        sm &= ~ndimage.binary_dilation(skip, iterations=max(1, int(round(g.px(500)))))   # 东湖边上被小 σ 另切出的碎片
    lab, n = ndimage.label(sm)
    px_km2 = g.px_e * g.px_n / 1e6
    near_river = ndimage.binary_dilation(river_s, iterations=max(1, int(round(g.px(60)))))
    lakes = []
    for k in range(1, n + 1):
        comp = lab == k
        area = comp.sum() * px_km2
        if area < min_km2:
            continue
        rr, cc = np.nonzero(comp)
        lon, lat = g.ll(rr.mean(), cc.mean())
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            continue
        if (comp & near_river).any():
            print('  湖 %.4f,%.4f %.2f km² 贴着江岸，略去' % (lon, lat, area))
            continue
        fk = field.copy()
        fk[(lab > 0) & ~comp] = 0
        fk[~ndimage.binary_dilation(comp, iterations=3)] = 0
        cs = measure.find_contours(fk, .5)
        ring = max(cs, key=len)
        ring = measure.approximate_polygon(ring, tolerance=1.2)[:-1]
        pts = [[round(float(v), 5) for v in g.ll(r, c)] for r, c in ring]
        name = ''
        for nm, ref in LAKE_NAMES.items():           # 参考点落在湖里，或离湖心 800 米内
            r, c = g.rc(*ref)
            inside = 0 <= r < g.h and 0 <= c < g.w and lab[int(r), int(c)] == k
            if inside or math.hypot(*np.subtract(to_m(lon, lat), to_m(*ref))) < 800:
                name = nm
        if only and name != only:
            continue
        lakes.append({'name': name, 'area_km2': round(float(area), 2), 'pts': pts, '_comp': comp})
    return lakes


def boat_orbit(comp, g):
    """东湖里最大的正置椭圆：舟船绕它行驶。离岸至少 150 米。"""
    inner = ndimage.binary_erosion(comp, iterations=max(1, int(round(g.px(150)))))
    dt = ndimage.distance_transform_edt(inner, sampling=(g.px_n, g.px_e))
    r0, c0 = np.unravel_index(np.argmax(dt), dt.shape)
    ce, cn = to_m(*g.ll(r0, c0))
    th = np.linspace(0, 2 * np.pi, 96, endpoint=False)
    best = (0, 0, 0)

    def fits(rx, rz):
        lon, lat = to_ll(ce + rx * np.cos(th), cn + rz * np.sin(th))
        r, c = g.rc(lon, lat)
        r, c = np.round(r).astype(int), np.round(c).astype(int)
        if (r < 0).any() or (r >= g.h).any() or (c < 0).any() or (c >= g.w).any():
            return False
        return bool(inner[r, c].all())

    for asp in np.linspace(.5, 2.5, 21):
        lo, hi = 0.0, 6000.0
        for _ in range(30):
            mid = (lo + hi) / 2
            if fits(mid * math.sqrt(asp), mid / math.sqrt(asp)):
                lo = mid
            else:
                hi = mid
        rx, rz = lo * math.sqrt(asp), lo / math.sqrt(asp)
        if rx * rz > best[0] * best[1]:
            best = (rx, rz, asp)
    lon, lat = g.ll(r0, c0)
    return {'c': [round(float(lon), 5), round(float(lat), 5)], 'rx': int(best[0]), 'rz': int(best[1])}


# ─────────────────────────── 山体 ───────────────────────────

def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def attenuation(lon, lat):
    """东部无名山按离黄鹤楼的距离压低：6 公里内不动，12 公里外只留 45%。"""
    d = math.hypot(*to_m(lon, lat))
    return 1 - .55 * smoothstep(6000, 12000, d)


def capsule(g, a, b, half_m):
    rr, cc = np.mgrid[0:g.h, 0:g.w]
    lon, lat = g.tr * (cc + .5, rr + .5)
    e, n = to_m(lon, lat)
    ae, an = to_m(*a)
    be, bn = to_m(*b)
    dx, dy = be - ae, bn - an
    t = np.clip(((e - ae) * dx + (n - an) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(e - ae - t * dx, n - an - t * dy) <= half_m


def ridge_profile(rel, cap, g, a, b, bins=40):
    """山脊线上逐段的起伏：DSM 在蛇山横向已不成形，但沿脊的高低还在。归一到 0.25–1。"""
    rr, cc = np.nonzero(cap)
    lon, lat = g.tr * (cc + .5, rr + .5)
    e, n = to_m(lon, lat)
    ae, an = to_m(*a)
    be, bn = to_m(*b)
    dx, dy = be - ae, bn - an
    t = np.clip(((e - ae) * dx + (n - an) * dy) / (dx * dx + dy * dy), 0, 1)
    k = np.minimum((t * bins).astype(int), bins - 1)
    v = np.maximum(rel[rr, cc], 0)
    prof = np.array([v[k == i].mean() if (k == i).any() else 0 for i in range(bins)])
    prof = ndimage.gaussian_filter1d(prof, 3, mode='nearest')
    prof = np.clip(prof / prof.max(), .25, 1)
    out = np.zeros(cap.shape, np.float32)
    out[rr, cc] = prof[k]
    return out


def hills(dem, wbm, g, step_px=3):
    land = wbm == 0
    s60 = gauss(dem, g, 60)
    rel = s60 - gauss(s60, g, 510)                   # 高出局部基面的起伏：楼群被 60 米的 σ 抹平，山留下
    lab, n = ndimage.label((rel > 18) & land, structure=np.ones((3, 3)))
    px_km2 = g.px_e * g.px_n / 1e6
    patches = []
    for k in range(1, n + 1):
        comp = lab == k
        if comp.sum() * px_km2 < .15:
            continue
        r, c = np.unravel_index(np.argmax(np.where(comp, rel, -1e9)), rel.shape)
        lon, lat = g.ll(r, c)
        if BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]:
            patches.append({'mask': comp, 'name': ''})
    for nm, spec in NAMED.items():                   # 按参考点认名：参考点落在地块里，或离峰 900 米内
        if nm == '蛇山':
            continue
        r, c = g.rc(*spec['ref'])
        best, bd = None, 900.0
        for p in patches:
            if p['name']:
                continue
            if p['mask'][int(r), int(c)]:
                best, bd = p, 0
                break
            pr, pc = np.nonzero(p['mask'])
            d = np.min(np.hypot((pr - r) * g.px_n, (pc - c) * g.px_e))
            if d < bd:
                best, bd = p, d
        assert best is not None, '没找到' + nm
        best['name'] = nm
    cap = capsule(g, *SHESHAN_AXIS, 130) & land
    patches.append({'mask': cap, 'name': '蛇山', 'synth': ridge_profile(rel, cap, g, *SHESHAN_AXIS)})

    grow = max(1, int(round(g.px(90))))
    out = []
    for p in patches:
        m = ndimage.binary_dilation(p['mask'], iterations=grow) & land
        src = p['synth'] if 'synth' in p else np.maximum(rel, 0) * m
        f = gauss(src, g, HILL_SIGMA_M)
        r, c = np.unravel_index(np.argmax(f), f.shape)
        plon, plat = g.ll(r, c)
        measured = float(f.max())
        spec = NAMED.get(p['name'])
        if spec and spec['peak_m'] is not None:
            target = spec['peak_m'] - PLAIN_TRUE_M
        elif spec:
            target = measured
        else:
            target = measured * attenuation(plon, plat)
        f *= target / measured
        rows, cols = np.nonzero(f > .4)
        r0, r1, c0, c1 = rows.min(), rows.max(), cols.min(), cols.max()
        r0 += (r - r0) % step_px                      # 把抽样格子对到峰顶那一格，
        c0 += (c - c0) % step_px                      # 否则峰值会落在两个样点之间，矮上两三米
        sub = f[r0:r1 + 1:step_px, c0:c1 + 1:step_px]
        q = np.clip(np.round(sub / .5), 0, 255).astype(np.uint8)
        lon0, lat0 = g.ll(r0, c0)
        out.append({
            'name': p['name'], 'relief': round(target, 1), 'measured': round(measured, 1),
            'peak': [round(float(plon), 5), round(float(plat), 5)],
            'lon0': round(float(lon0), 6), 'lat0': round(float(lat0), 6),
            'dlon': round(g.res * step_px, 8), 'dlat': round(-g.res * step_px, 8),
            'nx': int(q.shape[1]), 'nz': int(q.shape[0]),
            'q': base64.b64encode(q.tobytes()).decode('ascii')})
    out.sort(key=lambda h: (h['name'] == '', h['name'], -h['relief']))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dem-dir', default=str(ROOT / 'output' / 'dem-wuhan'))
    ap.add_argument('--out', default=str(ROOT / 'src' / 'geodata.gen.js'))
    a = ap.parse_args()
    dem, wbm, g = read(Path(a.dem_dir))
    print('工作窗口 %d×%d 像素，单像素 %.1f×%.1f 米' % (g.w, g.h, g.px_e, g.px_n))

    river = river_mask(wbm, g)
    dt_m = ndimage.distance_transform_edt(river, sampling=(g.px_n, g.px_e))
    yz = trace_river(river, dt_m, g, YANGTZE_GUIDE[0][:2], YANGTZE_GUIDE[-1][:2])
    han = trace_river(river, dt_m, g, HANSHUI_GUIDE[0][:2], HANSHUI_GUIDE[-1][:2])
    print('长江 %d 点，半宽 %d–%d 米；汉水 %d 点，半宽 %d–%d 米' % (
        len(yz), min(p[2] for p in yz), max(p[2] for p in yz), len(han), min(p[2] for p in han), max(p[2] for p in han)))

    lakes = lake_outlines(wbm, river, g)
    orbit = boat_orbit(lakes[0]['_comp'], g)
    for L in lakes:
        print('  湖 %-4s %5.2f km²  %3d 点' % (L['name'] or '—', L['area_km2'], len(L['pts'])))
    print('  东湖舟行椭圆', orbit)

    hs = hills(dem, wbm, g)
    for h in hs:
        print('  山 %-4s 峰 %.4f,%.4f  起伏 %5.1f 米（实测 %5.1f）  %d×%d' % (
            h['name'] or '—', h['peak'][0], h['peak'][1], h['relief'], h['measured'], h['nx'], h['nz']))

    geo = {'yangtze': yz, 'hanshui': han,
           'lakes': [{'name': L['name'], 'pts': L['pts']} for L in lakes],
           'lakeBoat': orbit,
           'hills': [{k: v for k, v in h.items() if k != 'measured'} for h in hs]}
    head = ('  /* 由 tools/geodata/extract.py 生成，勿手改。\n'
            '     Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018\n'
            '     provided under COPERNICUS by the European Union and ESA; all rights reserved. */\n')
    js = head + '  const GEO = ' + json.dumps(geo, ensure_ascii=False, separators=(',', ':')) + ';\n'
    Path(a.out).write_text(js, encoding='utf-8')
    print('写出 %s（%.1f KB）' % (a.out, len(js.encode('utf-8')) / 1024))


if __name__ == '__main__':
    main()
