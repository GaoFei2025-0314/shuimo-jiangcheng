#!/usr/bin/env python3
"""从 Copernicus GLO-30 提取场景用的河道、湖泊与山体，写出 src/geodata.gen.js。

    python3 tools/geodata/extract.py [--dem-dir output/dem-wuhan] [--out src/geodata.gen.js]

原则：数据定形，人工定高。
  河道——只认主河道：河道掩膜里与江心参考点连通的那一片（长江与汉水在南岸嘴相连）。
        在其中走最小代价路径，沿河心取中泓线，半宽取离岸距离。长江两头、汉水上游一头
        取主河道在工作窗口边上的出入口（离参考点最近的那段窗口边水面里离岸最远的一格，即江心），
        汉水下游一头止于汇口。参考点取自改动前的手绘中泓线首尾——它们多半落在岸上，只用来挑出入口。
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
WORK = (114.03, 30.36, 114.53, 30.77)            # 工作窗口：长江、汉水从它的边上进出

# 河道起终点的参考点：改动前 src/03-terrain.js 手绘中泓线的首尾两点（上游在前）。
# 这些点多半落在岸上（长江东北端那点离真江面约 5 公里），只用来挑主河道的出入口：
# 窗口边上的一头取离它最近的那段窗口边水面，汉水下游一头就近吸附到汇口的主河道上
YANGTZE_ENDS = ((114.1800, 30.3800), (114.5000, 30.7400))
HANSHUI_ENDS = ((114.0600, 30.6220), (114.2870, 30.5630))
MAIN_CHANNEL = (114.2830, 30.5520)   # 武汉长江大桥旁的江心（离岸约 490 米）：与它连通的河道才算主河道

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

    def rc(self, lon, lat):                 # 连续行列，以像素左上角为原点：取整（int/floor）即所在像素
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
        w = from_bounds(*WORK, ds.transform)
        wbm = ds.read(1, window=w)
        tr_wbm = ds.window_transform(w)
    assert dem.shape == wbm.shape, (dem.shape, wbm.shape)
    assert tr.almost_equals(tr_wbm, precision=1e-9), ('高程与水体掩膜的格网没对齐', tr, tr_wbm)
    return dem, wbm, Grid(tr, dem.shape)


# ─────────────────────────── 河道 ───────────────────────────

def river_mask(wbm):
    """河道掩膜（类别 3）：闭运算补上船只、桥墩留下的小缺口，开运算去掉零星噪点。
    先按边缘值外扩 4 格再做（闭运算的腐蚀从边上吃进 2 格，开运算再往里传 2 格），
    否则窗口边上会被剥掉一圈，江面在窗口边就断了。"""
    pad = 4
    m = np.pad(wbm == 3, pad, mode='edge')
    m = ndimage.binary_closing(m, iterations=2)
    m = ndimage.binary_opening(m, iterations=1)
    return m[pad:-pad, pad:-pad]


def main_channel(m, g):
    """主河道：与 MAIN_CHANNEL 八连通的那一片。窗口里别的河道碎片（弯出窗口又弯回来的河曲、
    港汊）与它不连通，端点吸附到那上面，路径就得横穿陆地。"""
    r, c = (int(v) for v in g.rc(*MAIN_CHANNEL))
    assert m[r, c], '主河道参考点 %.4f,%.4f 不在河道上' % MAIN_CHANNEL
    lab, _ = ndimage.label(m, structure=np.ones((3, 3)))
    return lab == lab[r, c]


def snap(m, g, lon, lat, within_m=500):
    """m 里离 (lon, lat) 最近的一格。"""
    r, c = g.rc(lon, lat)
    rr, cc = np.nonzero(m)
    d = np.hypot((rr + .5 - r) * g.px_n, (cc + .5 - c) * g.px_e)
    k = int(np.argmin(d))
    assert d[k] <= within_m, '离 %.4f,%.4f 最近的主河道有 %.0f 米' % (lon, lat, d[k])
    return int(rr[k]), int(cc[k])


def window_entry(m, dt_m, g, lon, lat):
    """主河道在工作窗口边上的出入口：窗口边一圈上的主河道格子按八连通分段，
    取离 (lon, lat) 最近的一段，再取段内离岸最远的一格——江心。"""
    rim = np.zeros_like(m)
    rim[[0, -1], :] = True
    rim[:, [0, -1]] = True
    lab, n = ndimage.label(m & rim, structure=np.ones((3, 3)))
    assert n, '主河道没有碰到工作窗口边'
    r, c = g.rc(lon, lat)
    rr, cc = np.nonzero(lab)
    k = lab[rr, cc][np.argmin(np.hypot((rr + .5 - r) * g.px_n, (cc + .5 - c) * g.px_e))]
    rr, cc = np.nonzero(lab == k)
    i = int(np.argmax(dt_m[rr, cc]))
    return int(rr[i]), int(cc[i])


def smooth_along(x, sigma, pin):
    """沿程高斯顺一遍。pin=(头, 尾)：钉住的一头按端点作点对称外延，端点原地不动、直段也不被拉弯
    （窗口边上的端点要贴着边）；不钉的一头照旧按端点值外延（mode='nearest'）。"""
    k = int(4 * sigma + .5)                          # 与 gaussian_filter1d 默认截断半径一致
    for widths, p in zip(((k, 0), (0, k)), pin):
        x = np.pad(x, widths, mode='reflect', reflect_type='odd') if p else np.pad(x, widths, mode='edge')
    return ndimage.gaussian_filter1d(x, sigma)[k:-k]


def trace_river(m, dt_m, g, start, end, step_m=500.0):
    """最小代价路径走河心：代价 = 1 / (1 + 离岸距离 / 30 米)，岸上极贵。沿程每 500 米取一点。
    start、end 是主河道上的 (行, 列)；落在窗口边上的一头，顺线时钉住不动。"""
    cost = np.where(m, 1.0 / (1.0 + dt_m / 30.0), 1e3)
    path, _ = route_through_array(cost, start, end, fully_connected=True, geometric=True)
    path = np.array(path)
    dry = int((~m[path[:, 0], path[:, 1]]).sum())
    assert dry <= 5, '河道路径横穿了 %d 格陆地' % dry
    path = path.astype(float)
    seg = np.hypot(np.diff(path[:, 0]) * g.px_n, np.diff(path[:, 1]) * g.px_e)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], max(3, int(round(s[-1] / step_m)) + 1))
    r, c = np.interp(t, s, path[:, 0]), np.interp(t, s, path[:, 1])
    hw = ndimage.map_coordinates(dt_m, [r, c], order=1)
    # 沿程顺一遍：位置 σ=1 点（500 米），宽度 σ=1.5 点，去掉码头趸船留下的折角
    pin = [p[0] in (0, g.h - 1) or p[1] in (0, g.w - 1) for p in (start, end)]
    r = smooth_along(r, 1.0, pin)
    c = smooth_along(c, 1.0, pin)
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
    assert big, '没找到东湖'
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
    # 按真实距离让岸：十字结构元逐格腐蚀出的是菱形，斜向只让出约 120 米
    inner = ndimage.distance_transform_edt(comp, sampling=(g.px_n, g.px_e)) > 150
    dt = ndimage.distance_transform_edt(inner, sampling=(g.px_n, g.px_e))
    r0, c0 = np.unravel_index(np.argmax(dt), dt.shape)
    ce, cn = to_m(*g.ll(r0, c0))
    th = np.linspace(0, 2 * np.pi, 720, endpoint=False)   # 周长上约 14 米验一点，不到半格：两点之间不会偷偷贴岸
    best = (0, 0, 0)

    def fits(rx, rz):
        lon, lat = to_ll(ce + rx * np.cos(th), cn + rz * np.sin(th))
        r, c = g.rc(lon, lat)
        r, c = np.floor(r).astype(int), np.floor(c).astype(int)
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
    for nm, spec in NAMED.items():                   # 按参考点认名：参考点落在地块里，或离地块最近一格 900 米内
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
        if 'synth' in p:
            src = p['synth']
        else:
            src = np.maximum(rel, 0) * (ndimage.binary_dilation(p['mask'], iterations=grow) & land)
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
        # 抽样格子对到峰顶那一格（否则峰值落在两个样点之间，矮上两三米），并从峰顶往四边
        # 按整步向外取到 f > .4 的范围之外：格子最外一圈全在山脚以外，拼到平地上没有断口
        rows, cols = np.nonzero(f > .4)
        r0 = r - ((r - rows.min()) // step_px + 1) * step_px
        r1 = r + ((rows.max() - r) // step_px + 1) * step_px
        c0 = c - ((c - cols.min()) // step_px + 1) * step_px
        c1 = c + ((cols.max() - c) // step_px + 1) * step_px
        assert 0 <= r0 and r1 < g.h and 0 <= c0 and c1 < g.w, '%s 的格子出了工作窗口' % (p['name'] or '无名山')
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

    river = river_mask(wbm)
    main_r = main_channel(river, g)
    dt_m = ndimage.distance_transform_edt(main_r, sampling=(g.px_n, g.px_e))
    yz = trace_river(main_r, dt_m, g, window_entry(main_r, dt_m, g, *YANGTZE_ENDS[0]),
                     window_entry(main_r, dt_m, g, *YANGTZE_ENDS[1]))
    han = trace_river(main_r, dt_m, g, window_entry(main_r, dt_m, g, *HANSHUI_ENDS[0]),
                      snap(main_r, g, *HANSHUI_ENDS[1]))
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
