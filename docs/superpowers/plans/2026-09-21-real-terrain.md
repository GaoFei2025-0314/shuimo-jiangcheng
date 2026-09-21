# 用实测地形与水系替换手工地形 实施计划

> **给执行者：** 必须配合 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans
> 逐任务执行。步骤用 `- [ ]` 勾选框跟踪。

**目标：** 把手工函数生成的山丘、河道、湖岸，换成从 Copernicus GLO-30 与 OSM 提取的实测地形与水系，
并新增七处武汉景点，同时保持水墨留白的观感与景点的聚拢。

**做法：** 离线 Python 管线（`tools/geodata/extract.py`）把 DEM 与水体掩膜提炼成一份 12 KB 的
`src/geodata.gen.js`：河道是中泓线与半宽，湖是圆滑后的岸线，山是每座一块高程格子。
运行时按这份数据生成河岸多边形、湖洞与山体网格；`terrainTop()` 改为对格子作 Catmull-Rom 双三次插值，
其余调用方（镜头兜地、草木落位、市廛避让）接口不变。原则是**数据定形，人工定高**——
DSM 里建筑噪声与山体同尺度，任何能抹净建筑的滤波都会削掉六成山，所以形状取自数据、峰值改用实测海拔。

**技术栈：** Python 3（rasterio、numpy、scipy、scikit-image）跑离线管线；
运行时仍是无依赖、无打包器的 Three.js r128 + 手写 GLSL，`build.sh` 拼成单文件 HTML。

**设计文档：** `docs/superpowers/specs/2026-09-20-real-terrain-design.md`。
文末「实施修订」记了十处与原方案不同的决定，本计划按修订后的执行。

---

## 动手之前

- **分支**：已在 `feat/real-terrain`。若不在，`git checkout -b feat/real-terrain`。
- **原始数据**：`output/dem-wuhan/`（约 532 MB，不入库，已在 `.git/info/exclude` 里本地忽略）。
  需要其中的 `wuhan-glo30-elevation.tif` 与 `wuhan-glo30-water-mask.tif`。
- **Python 环境**：系统 python3 没有 rasterio。整条管线在虚拟环境里跑：

```bash
python3 -m venv .venv-geo && .venv-geo/bin/pip install -r tools/geodata/requirements.txt
```

  `.venv-geo/` 要加进 `.gitignore`。
- **看效果**：`./build.sh` 后用静态服务器打开 `dist/index.html`；核对时加 `?debug`，
  页面会把内部状态挂在 `window.__dbg` 上（任务 11 加的，正常访问不暴露）。

## 文件一览

| 文件 | 职责 | 状态 |
|---|---|---|
| `tools/geodata/requirements.txt` | 离线管线的依赖 | 新建 |
| `tools/geodata/download.py` | 下载九张原始瓦片（从 `output/` 收编） | 新建 |
| `tools/geodata/prepare.py` | 拼接裁剪成两张 GeoTIFF（从 `output/` 收编） | 新建 |
| `tools/geodata/extract.py` | **核心**：DEM+掩膜 → 河道、湖、山 | 新建 |
| `tools/geodata/check_geodata.py` | 校验产物，不读栅格 | 新建 |
| `src/geodata.gen.js` | 生成的数据（入库，勿手改） | 新建 |
| `src/01-core.js` | 景点坐标表：两处更正、七处新增 | 改 |
| `src/02-landmarks.js` | 七个新景点模型 | 改 |
| `src/03-terrain.js` | 河道、湖、山全部改为读 `GEO` | 改 |
| `src/04-scene.js` | 落位、草木、江滩、避让 | 改 |
| `src/05-runtime.js` | 视角、文案、题记、竖牌、调试钩子 | 改 |
| `src/00-shell.html` | 导览分组、署名 | 改 |
| `build.sh` | 拼接列表加入 `geodata.gen.js` | 改 |
| `README.md` | 坐标表、目录、资料来源与许可 | 改 |

`geodata.gen.js` 排在 `01-core.js` **之前**：它只是一份 `const GEO = {…}` 纯数据，
而 `01-core.js` 的景点坐标表要用它取磨山峰顶。

---

## 阶段一　离线管线

### 任务 1：工具目录与依赖

**文件：**
- 新建：`tools/geodata/requirements.txt`
- 复制：`tools/geodata/download.py`、`tools/geodata/prepare.py`
- 改：`.gitignore`

- [ ] **步骤 1：建目录，收编下载与拼接脚本**

这两个脚本现在只存在于不入库的 `output/dem-wuhan/` 里，别人克隆仓库后无法复现数据。收进来：

```bash
mkdir -p tools/geodata
cp output/dem-wuhan/download.py tools/geodata/download.py
cp output/dem-wuhan/prepare.py tools/geodata/prepare.py
```

- [ ] **步骤 2：写依赖清单**

新建 `tools/geodata/requirements.txt`：

```
rasterio>=1.3
numpy>=1.24
scipy>=1.10
scikit-image>=0.22
```

- [ ] **步骤 3：装环境**

```bash
python3 -m venv .venv-geo && .venv-geo/bin/pip install -r tools/geodata/requirements.txt
```

预期：结尾打印 `Successfully installed ...`，其中有 rasterio、scipy、scikit-image。

- [ ] **步骤 4：忽略虚拟环境**

在 `.gitignore` 末尾追加一行：

```
.venv-geo/
```

- [ ] **步骤 5：提交**

```bash
git add tools/geodata .gitignore && git commit -m "geodata 工具目录：依赖与下载、拼接脚本"
```

### 任务 2：先写校验，看它失败

校验只读生成的 JS，不碰栅格，所以 `output/` 不在时也能跑（CI、别人的机器）。

**文件：** 新建 `tools/geodata/check_geodata.py`

- [ ] **步骤 1：写校验脚本**

```python
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
```

- [ ] **步骤 2：跑一遍，确认它因为没有数据而失败**

```bash
.venv-geo/bin/python tools/geodata/check_geodata.py
```

预期：打印 `没有 .../src/geodata.gen.js，先跑 tools/geodata/extract.py`，退出码 1。

- [ ] **步骤 3：提交**

```bash
git add tools/geodata/check_geodata.py && git commit -m "geodata 校验脚本：河道、湖、山的硬指标"
```

### 任务 3：提取脚本

**文件：** 新建 `tools/geodata/extract.py`；生成 `src/geodata.gen.js`

- [ ] **步骤 1：写提取脚本**

```python
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
```

- [ ] **步骤 2：跑**

```bash
.venv-geo/bin/python tools/geodata/extract.py
```

预期输出（数值应与此一致，差异说明数据或参数不同，需查清再往下走）：

```
工作窗口 1800×1476 像素，单像素 26.6×30.8 米
长江 122 点，半宽 80–1126 米；汉水 69 点，半宽 80–267 米
  湖 东湖   31.68 km²   90 点
  湖 沙湖    2.50 km²   19 点
  湖 —     0.43 km²   13 点
  湖 月湖    0.28 km²    8 点
  东湖舟行椭圆 {'c': [114.38931, 30.56736], 'rx': 1655, 'rz': 1655}
  山 洪山   峰 114.3429,30.5365  起伏  40.0 米（实测  40.0）
  山 珞珈山  峰 114.3646,30.5371  起伏  95.5 米（实测  50.2）
  山 磨山   峰 114.4054,30.5543  起伏  95.0 米（实测  47.4）
  山 蛇山   峰 114.3046,30.5460  起伏  62.0 米（实测   0.8）
  山 龟山   峰 114.2746,30.5579  起伏  67.0 米（实测  29.5）
  山 —    峰 114.3885,30.5279  起伏  41.0 米（实测  56.9）
  山 —    峰 114.4126,30.5229  起伏  25.9 米（实测  55.8）
  山 —    峰 114.4374,30.5151  起伏  22.6 米（实测  50.3）
  山 —    峰 114.4315,30.5304  起伏  11.1 米（实测  24.7）
写出 .../src/geodata.gen.js（12.3 KB）
```

蛇山那行「实测 0.8」是对的：它的横截面是按山脊线补的，实测值只是归一化前的幅值，没有意义。

- [ ] **步骤 3：校验通过**

```bash
.venv-geo/bin/python tools/geodata/check_geodata.py
```

预期：逐条打印「通过」，最后 `全部通过`，退出码 0。

- [ ] **步骤 4：提交**

```bash
git add tools/geodata/extract.py src/geodata.gen.js && git commit -m "从 GLO-30 提取河道、湖与山体"
```

### 任务 4：接进构建

**文件：** 改 `build.sh`

- [ ] **步骤 1：把生成的数据排进拼接列表（在 01-core 之前）**

把这一行：

```bash
  cat src/01-core.js src/02-landmarks.js src/03-terrain.js src/04-scene.js src/05-runtime.js src/06-audio.js
```

换成：

```bash
  cat src/geodata.gen.js src/01-core.js src/02-landmarks.js src/03-terrain.js src/04-scene.js src/05-runtime.js src/06-audio.js
```

- [ ] **步骤 2：构建**

```bash
./build.sh
```

预期：`构建完成：dist/index.html（语法检查通过，已用 terser 压缩）`。

- [ ] **步骤 3：确认数据确实进了产物**

```bash
grep -c "lakeBoat" dist/index.html
```

预期：`1`。

- [ ] **步骤 4：提交**

```bash
git add build.sh && git commit -m "build.sh：拼入 geodata.gen.js"
```

---

## 阶段二　河道

改完这一阶段页面应当照常能开：长江改走实测河道（比原来偏西、向东北去），汉水变窄。

### 任务 5：河道改读实测中泓线

**文件：** 改 `src/03-terrain.js`

- [ ] **步骤 1：换掉手绘中泓线**

在 `src/03-terrain.js` 里，删掉从

```js
  // 长江：自西南上游经龟蛇之间北上
```

起、到

```js
  function sampleRiver(pts, n) {
```

之前（不含该行）的整段，替换为：

```js
  // 长江与汉水：中泓线与半宽按实测水体掩膜追出（tools/geodata/extract.py）[经度, 纬度, 半宽(米)]
  const YANGTZE = GEO.yangtze, HANSHUI = GEO.hanshui;

```

- [ ] **步骤 2：采样加密**

控制点由 18 个变成 122 个（每 500 米一个），采样数要跟上，否则河岸会在控制点之间走直线。

在 `src/03-terrain.js` 里，把这一段：

```js
  const YZ = sampleRiver(YANGTZE, 150), HAN = sampleRiver(HANSHUI, 70);
```

换成：

```js
  const YZ = sampleRiver(YANGTZE, 360), HAN = sampleRiver(HANSHUI, 200);   // 约 170 米一个采样
```

- [ ] **步骤 3：缩小河口余量**

余量按采样点数算。原值 4 个点 ≈1.2 公里，会把南岸嘴的尖角连同晴川阁一起切出陆地之外。

在 `src/03-terrain.js` 里，把这一段：

```js
  const HCUT = 4;                                       // 河口张开的余量
```

换成：

```js
  const HCUT = 7;                                       // 河口张开的余量：约 1.2 公里
```

- [ ] **步骤 4：构建并核对**

```bash
./build.sh
```

在浏览器打开 `dist/index.html?debug`，等 5 秒，控制台执行：

```js
const D = window.__dbg || {};
console.log('长江控制点', D.YZ ? D.YZ.s.length : '（调试钩子要到任务 11 才有，先看画面）');
```

任务 11 之前没有 `__dbg`，这一步只看画面：长江应当自西南来、过南岸嘴后折向东北，
汉水明显比原来窄。控制台不应有报错。

- [ ] **步骤 5：提交**

```bash
git add src/03-terrain.js && git commit -m "河道改用实测中泓线与半宽"
```

### 任务 6：修好汉口江滩

原代码按采样下标 8–60 取点，这段下标对应纬度 30.41–30.55，全在汉水口以南，
`inPoly(HANKOU)` 一个都不成立——改动前实际生成 **0 个**护岸（已在浏览器里数过）。
重采样后下标含义又变了，改为按纬度取汉口那一段。

**文件：** 改 `src/04-scene.js`

- [ ] **步骤 1：按纬度取汉口那一段**

在 `src/04-scene.js` 里，把这一段：

```js
  {   // 汉口江滩：护岸与路灯，江汉关就立在岸上
    const B = new Acc(), L = new Acc();
    for (let i = 8; i < 60; i++) {
      const s = YZ.s[i], nx = s.d.z, nz = -s.d.x, Ln = Math.hypot(nx, nz) || 1;
      const x = s.p.x + nx / Ln * (s.w - .9), z = s.p.z + nz / Ln * (s.w - .9);
      if (!inPoly(HANKOU, x, z)) continue;
```

换成：

```js
  {   // 汉口江滩：汉水口以下的长江西岸，护岸与路灯，江汉关就立在岸上
    const B = new Acc(), L = new Acc(), latOf = z => O[1] - z * MPU / M_LAT;
    for (let i = 0; i < YZ.s.length; i++) {
      const s = YZ.s[i], nx = s.d.z, nz = -s.d.x, Ln = Math.hypot(nx, nz) || 1;
      const x = s.p.x + nx / Ln * (s.w - .9), z = s.p.z + nz / Ln * (s.w - .9), lat = latOf(z);
      if (lat < 30.566 || lat > 30.600 || !inPoly(HANKOU, x, z)) continue;
```

- [ ] **步骤 2：构建，确认护岸出现了**

```bash
./build.sh
```

`?debug` 打开后看江汉关一带的江岸：应当出现一排护岸方块，每三个一盏路灯。
这是改动前没有的东西——若显得碎乱，把 `B.box(6, 1.2, 5.2, ...)` 的尺寸或纬度窗口调一调。

- [ ] **步骤 3：提交**

```bash
git add src/04-scene.js && git commit -m "汉口江滩：改按纬度取汉口段，修好从未生成过护岸的缺陷"
```

---

## 阶段三　湖

### 任务 7：湖改读实测岸线

东湖换成实测轮廓（σ=300 米圆滑），另外三个湖（沙湖、月湖、东湖东南一小片）成为新的水面。
四个湖都要在陆块上挖洞，并在水纹图里按湖面落笔。

**文件：** 改 `src/03-terrain.js`、`src/04-scene.js`、`src/05-runtime.js`

- [ ] **步骤 1：湖的轮廓、湖心与舟行椭圆**

在 `src/03-terrain.js` 里，删掉从

```js
  // 东湖：中国最大的城中湖
```

起、到

```js
  function inPoly(poly, x, z) {
```

之前（不含该行）的整段，替换为：

```js
  // 湖：实测水体掩膜圆滑后的岸线。第一个是东湖——中国最大的城中湖，水域约 33 平方公里
  const LAKES = GEO.lakes.map(L => {                    // 再过一遍 Catmull-Rom，成自然湖岸
    const c = new THREE.CatmullRomCurve3(L.pts.map(p => gv(p[0], p[1], 0)), true, 'catmullrom', .5);
    return c.getPoints(L.pts.length * 6).map(p => [p.x, p.z]);
  });
  const LAKE = LAKES[0];
  const lakeC = geo(GEO.lakeBoat.c[0], GEO.lakeBoat.c[1]);           // 东湖主湖面中心
  const LRX = GEO.lakeBoat.rx / MPU, LRZ = GEO.lakeBoat.rz / MPU;     // 湖上舟行椭圆的半轴
  const LAKE_BB = LAKES.map(L => L.reduce((b, p) =>
    [Math.min(b[0], p[0]), Math.max(b[1], p[0]), Math.min(b[2], p[1]), Math.max(b[3], p[1])], [1e9, -1e9, 1e9, -1e9]));

```

- [ ] **步骤 2：`onLand` 要排除所有湖**

原来只排除东湖，且只在武昌那块排除。

在 `src/03-terrain.js` 里，把这一段：

```js
  const onLand = (x, z) =>
    (inPoly(WUCHANG, x, z) && !inPoly(LAKE, x, z)) || inPoly(HANKOU, x, z) || inPoly(HANYANG, x, z);
```

换成：

```js
  const inLake = (x, z) => LAKES.some((L, i) => {
    const b = LAKE_BB[i];
    return x > b[0] && x < b[1] && z > b[2] && z < b[3] && inPoly(L, x, z);
  });
  const onLand = (x, z) =>
    (inPoly(WUCHANG, x, z) || inPoly(HANKOU, x, z) || inPoly(HANYANG, x, z)) && !inLake(x, z);
```

- [ ] **步骤 3：水纹图——湖的列表与采样步长**

控制点变密了，步长同步放大，保持每像素的比较次数不变。

在 `src/03-terrain.js` 里，把这一段：

```js
    grab(YZ.s, 4); grab(HAN.s, 3);
    let lx0 = 1e9, lx1 = -1e9, lz0 = 1e9, lz1 = -1e9;
    LAKE.forEach(p => { lx0 = Math.min(lx0, p[0]); lx1 = Math.max(lx1, p[0]); lz0 = Math.min(lz0, p[1]); lz1 = Math.max(lz1, p[1]); });
    const LK = []; for (let k = 0; k < LAKE.length; k += 3) LK.push(LAKE[k]);
```

换成：

```js
    grab(YZ.s, 5); grab(HAN.s, 4);
    const LK = LAKES.map(L => L.filter((p, k) => k % 3 === 0));
```

- [ ] **步骤 4：水纹图——逐湖判定**

在 `src/03-terrain.js` 里，把这一段：

```js
        if (x > lx0 && x < lx1 && z > lz0 && z < lz1 && inPoly(LAKE, x, z)) {
          let de = 1e18;
          for (let k = 0; k < LK.length; k++) {
            const p = LK[k], dd = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
            if (dd < de) de = dd;
          }
          signed = z - lakeC.z;                               // 湖面平远：横笔数道，不作同心圆
          band = Math.min(1, Math.sqrt(de) / 120);
          wet = 1; lake = 1;
        }
```

换成：

```js
        for (let li = 0; li < LAKES.length; li++) {
          const bb = LAKE_BB[li];
          if (x <= bb[0] || x >= bb[1] || z <= bb[2] || z >= bb[3] || !inPoly(LAKES[li], x, z)) continue;
          let de = 1e18;
          for (const p of LK[li]) {
            const dd = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
            if (dd < de) de = dd;
          }
          signed = z - lakeC.z;                               // 湖面平远：横笔数道，不作同心圆
          band = Math.min(1, Math.sqrt(de) / 120);
          wet = 1; lake = 1;
          break;
        }
```

- [ ] **步骤 5：陆块挖洞**

一个湖只有整个落在某块陆地里才挖它：跨了江岸的湖会让三角剖分出错。

在 `src/03-terrain.js` 里，把这一段：

```js
  scene.add(landMesh(HANKOU), landMesh(HANYANG), landMesh(WUCHANG, [LAKE]));
```

换成：

```js
  // 湖整个落在哪块陆地里，就在哪块上挖空
  const holesIn = poly => LAKES.filter(L => L.every(p => inPoly(poly, p[0], p[1])));
  const LAND_HOLES = [holesIn(HANKOU), holesIn(HANYANG), holesIn(WUCHANG)];
  scene.add(landMesh(HANKOU, LAND_HOLES[0]), landMesh(HANYANG, LAND_HOLES[1]), landMesh(WUCHANG, LAND_HOLES[2]));
```

- [ ] **步骤 6：东湖绿道改为沿岸内收**

真实湖岸有凹有凸，按湖心等比缩会让湖汊里的绿道跑到岸上。

在 `src/04-scene.js` 里，把这一段：

```js
    const pts = LAKE.map(p => new THREE.Vector3(lakeC.x + (p[0] - lakeC.x) * .962, LAND_Y + .12, lakeC.z + (p[1] - lakeC.z) * .962));
```

换成：

```js
    // 沿岸线向湖内收 4 个单位：真实湖岸有凹有凸，不能再按湖心等比缩
    const n = LAKE.length, sg = LAKE.reduce((s, p, i) => s + p[0] * LAKE[(i + 1) % n][1] - LAKE[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
    const pts = LAKE.map((p, i) => {
      const a = LAKE[(i + n - 1) % n], b = LAKE[(i + 1) % n], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
      return new THREE.Vector3(p[0] - sg * tz / L * 4, LAND_Y + .12, p[1] + sg * tx / L * 4);
    });
```

- [ ] **步骤 7：湖上舟船的轨道半径**

半轴改从数据来（见下一步），系数相应放大。

在 `src/04-scene.js` 里，把这一段：

```js
    { m: junk(),   a: .7, k: .42, sp: .045, s: 1.1 },
    { m: sampan(), a: 3.4, k: .30, sp: -.035, s: 1.0 }
```

换成：

```js
    { m: junk(),   a: .7, k: .92, sp: .045, s: 1.1 },
    { m: sampan(), a: 3.4, k: .62, sp: -.035, s: 1.0 }
```

- [ ] **步骤 8：舟船轨道用数据半轴（其一）**

在 `src/05-runtime.js` 里，把这一段：

```js
      const x = lakeC.x + Math.cos(a) * 300 * b.k, z = lakeC.z + Math.sin(a) * 210 * b.k;
```

换成：

```js
      const x = lakeC.x + Math.cos(a) * LRX * b.k, z = lakeC.z + Math.sin(a) * LRZ * b.k;
```

- [ ] **步骤 9：舟船轨道用数据半轴（其二）**

在 `src/05-runtime.js` 里，把这一段：

```js
      const dx = -Math.sin(a) * 300 * b.k * Math.sign(b.sp), dz = Math.cos(a) * 210 * b.k * Math.sign(b.sp);
```

换成：

```js
      const dx = -Math.sin(a) * LRX * b.k * Math.sign(b.sp), dz = Math.cos(a) * LRZ * b.k * Math.sign(b.sp);
```

- [ ] **步骤 10：构建并看东湖**

```bash
./build.sh
```

`?debug` 打开后点「东湖」。预期：湖形是实测轮廓——西边听涛的长臂、中间主湖面、
东北的汊口都在，但没有 30 米格网的碎边；两条船在主湖面上绕行，不上岸。
汉阳龟山西边会多出月湖，武昌多出沙湖。

- [ ] **步骤 11：提交**

```bash
git add src/03-terrain.js src/04-scene.js src/05-runtime.js
git commit -m "湖改用实测岸线：东湖取势，另添沙湖、月湖"
```

---

## 阶段四　山

### 任务 8：山改为高程格子

椭球换成按格子位移的网格。格子存的是「高出平原的起伏」，0.5 米一级；
网格点之间用 Catmull-Rom 双三次插值，所以轮廓是圆的，不见格子。
网格原点放在山顶，皴笔便自山顶放射、顺坡而下——这样不必改着色器。
陆块仍是平板：平原本就平坦，山从板中浮出，板顶（`LAND_Y` + 1.3）以下的山裙正好被板遮住；
临江临湖的一侧则沉到水面以下，山自然入水。

**文件：** 改 `src/03-terrain.js`、`src/04-scene.js`、`src/05-runtime.js`

- [ ] **步骤 1：山体网格与 `terrainTop`**

在 `src/03-terrain.js` 里，删掉从

```js
  /* ═════════ 六、山：蛇山、龟山、珞珈山、磨山 ═════════ */
```

起、到

```js
  // 远山：层层淡出
```

之前（不含该行）的整段，替换为：

```js
  /* ═════════ 六、山：形取 DEM，高取实测海拔（tools/geodata/extract.py） ═════════
     每座山一块高程格子（相对平原的起伏，0.5 米一级）。网格点之间用 Catmull-Rom 双三次插值，
     轮廓是圆的，不见格子。山脚没入水下，临江临湖的山自然入水。 */
  const VEX = 5 / MPU;                                  // 米 → 场景单位，竖向五倍
  const HILL_DIP = 2.6;                                 // 起伏归零处沉到水面以下，山裙不浮在水上
  function hillField(t) {
    const bin = atob(t.q), a = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i) * .5 * VEX;
    const o = geo(t.lon0, t.lat0), e = geo(t.lon0 + t.dlon, t.lat0 + t.dlat);
    return { a, nx: t.nx, nz: t.nz, x0: o.x, z0: o.z, dx: e.x - o.x, dz: e.z - o.z };
  }
  const crSpline = (p0, p1, p2, p3, t) =>
    p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function sampleField(f, x, z) {
    const u = (x - f.x0) / f.dx, v = (z - f.z0) / f.dz;
    if (u < 0 || v < 0 || u > f.nx - 1 || v > f.nz - 1) return 0;
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
    const at = (ii, jj) => f.a[Math.min(f.nz - 1, Math.max(0, jj)) * f.nx + Math.min(f.nx - 1, Math.max(0, ii))];
    const row = jj => crSpline(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), fx);
    return Math.max(0, crSpline(row(j - 1), row(j), row(j + 1), row(j + 2), fz));
  }
  const HILLS = GEO.hills.map(t => {
    const f = hillField(t), pk = geo(t.peak[0], t.peak[1]);
    const SUB = 2, cols = (f.nx - 1) * SUB + 1, rows = (f.nz - 1) * SUB + 1;
    const pos = new Float32Array(cols * rows * 3), idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = f.x0 + i / SUB * f.dx, z = f.z0 + j / SUB * f.dz, h = sampleField(f, x, z), k = (j * cols + i) * 3;
      pos[k] = x - pk.x;                                // 以山顶为原点：皴笔自山顶放射，顺坡而下
      pos[k + 1] = LAND_Y + h - HILL_DIP * (1 - THREE.MathUtils.smoothstep(h, 0, 1.5));
      pos[k + 2] = z - pk.z;
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, M.hill); mesh.position.set(pk.x, 0, pk.z);
    scene.add(mesh);
    return { name: t.name, f, mesh, peak: pk, x0: f.x0, x1: f.x0 + (f.nx - 1) * f.dx, z0: f.z0, z1: f.z0 + (f.nz - 1) * f.dz };
  });
  const HILL = {}; HILLS.forEach(h => { if (h.name) HILL[h.name] = h; });
  const reliefAt = (x, z) => {
    let y = 0;
    for (const h of HILLS) if (x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1) y = Math.max(y, sampleField(h.f, x, z));
    return y;
  };
  const terrainTop = (x, z) => LAND_Y + reliefAt(x, z);

```

- [ ] **步骤 2：草木改按格子撒点**

原来按椭球的参数域撒点，现在按格子矩形撒点、用起伏筛选。

在 `src/04-scene.js` 里，删掉从

```js
  function dressRidge(r, n, kind, s0) {
```

起、到

```js
  {                                           // 武大樱花大道
```

之前（不含该行）的整段，替换为：

```js
  // 在山的格子里撒点，只留起伏超过 3 个单位的（真在山上，不在山脚水边）。密度按格子面积
  function dressHill(h, kind, s0, density, keep) {
    const n = Math.round((h.x1 - h.x0) * (h.z1 - h.z0) / 40 * (density || 1));
    for (let i = 0; i < n; i++) {
      const x = h.x0 + rnd() * (h.x1 - h.x0), z = h.z0 + rnd() * (h.z1 - h.z0);
      if (sampleField(h.f, x, z) < 3 || !clearOf(x, z, 16) || (keep && !keep(x, z))) continue;
      const y = terrainTop(x, z), s = s0 * (.55 + rnd() * 1.05);
      if (kind === 'p') pine(x, y, z, s); else sakura(x, y, z, s);
    }
  }
  const WUDA_AT = geo(114.3625, 30.5397);
  dressHill(HILL['蛇山'], 'p', 1.5);
  dressHill(HILL['龟山'], 'p', 1.5);
  dressHill(HILL['磨山'], 'p', 1.5);
  dressHill(HILL['磨山'], 's', 1.4, .6);                                    // 磨山樱园
  dressHill(HILL['珞珈山'], 'p', 1.4);
  dressHill(HILL['珞珈山'], 's', 1.3, 1, (x, z) => (x - WUDA_AT.x) ** 2 + (z - WUDA_AT.z) ** 2 < 32 * 32);   // 武大樱顶
  HILLS.filter(h => !['蛇山', '龟山', '磨山', '珞珈山'].includes(h.name)).forEach(h => dressHill(h, 'p', 1.4));
```

- [ ] **步骤 3：磨山题记挪到实测山脊上**

原位置在实测磨山以南 1.6 公里，且新位置要避开楚天台的竖牌，取离峰 1.2 公里处。

在 `src/05-runtime.js` 里，把这一段：

```js
    ['磨山', 114.4062, 30.5395, 'hill', 30]
```

换成：

```js
    ['磨山', 114.4174, 30.5524, 'hill', 30]
```

- [ ] **步骤 4：山名题记随实测山高**

写死的高度（蛇山 26、磨山 30）在实测山高下会插进山体里。

在 `src/05-runtime.js` 里，把这一段：

```js
    const p = geo(L[1], L[2]);
    return { el, v: new THREE.Vector3(p.x, L[4], p.z), kind: L[3] };
```

换成：

```js
    const p = geo(L[1], L[2]);
    const y = L[3] === 'hill' ? terrainTop(p.x, p.z) + 7 : L[4];     // 山名题在山头之上，随实测山高
    return { el, v: new THREE.Vector3(p.x, y, p.z), kind: L[3] };
```

- [ ] **步骤 5：构建并核对**

```bash
./build.sh
```

预期：`构建完成`。打开后点「黄鹤楼」「楚天台」「电视塔」：
山面应当是圆滑的，没有格子棱；山脊有淡墨的廓线；山脚虚入纸中。
若出现明显的多边形轮廓，把 `SUB` 从 2 提到 3 再看。

- [ ] **步骤 6：提交**

```bash
git add src/03-terrain.js src/04-scene.js src/05-runtime.js
git commit -m "山改为实测高程格子：形取 DEM，高取实测海拔"
```

### 任务 9：两处坐标更正

两处都有 OSM 与 DEM 双重佐证，见设计文档「实施修订」第 7 条。

**文件：** 改 `src/01-core.js`

- [ ] **步骤 1：龟山电视塔**

原值来自维基百科，偏西 550 米。OSM 的塔与峰顶节点、DEM 实测的龟山脊线峰值都指向新值。

在 `src/01-core.js` 里，把这一段：

```js
    tv:      [114.27000, 30.55550],   // 龟山电视塔
```

换成：

```js
    tv:      [114.27508, 30.55802],   // 龟山电视塔（OSM；与 DEM 龟山峰顶相距 45 米）
```

- [ ] **步骤 2：楚天台**

原值纬度第四位为笔误。DEM 实测磨山峰顶在 30.5543，与更正后相差 30 米。

在 `src/01-core.js` 里，把这一段：

```js
    chutian: [114.40500, 30.54450]    // 东湖磨山·楚天台
```

换成：

```js
    chutian: [114.40500, 30.55450]    // 东湖磨山·楚天台（原纬度 30.5445 为笔误；DEM 磨山峰顶在 30.5543）
```

- [ ] **步骤 3：构建并核对**

```bash
./build.sh
```

预期：电视塔立在龟山脊上（不再在西坡半腰），楚天台立在磨山顶、四周是东湖。

- [ ] **步骤 4：提交**

```bash
git add src/01-core.js && git commit -m "更正龟山电视塔与楚天台的坐标"
```

---

## 阶段五　七处新景点

### 任务 10：七个模型

都按现有写法：`mkS()` 取四个累加器，`hall()` 起殿阁，`roofGeo()` 作屋面，
`finish()` 合并成一次绘制。新增一个 `oct()` 作八角柱，塔用得上。

**文件：** 改 `src/02-landmarks.js`

- [ ] **步骤 1：七个 build 函数，插在「舟船」一节之前**

在 `src/02-landmarks.js` 里，把这一段：

```js
  /* ── 舟船 ── */
```

换成：

```js
  const oct = (r0, r1, h) => new THREE.CylinderGeometry(r1, r0, h, 8);   // 八角柱：下径 r0，上径 r1

  // ── 洪山宝塔 · 宝通禅寺：八面七级砖石仿木塔（元代），塔前一进殿堂
  function buildPagoda() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(26, 8, 34, 0, -4, 6);                                        // 依山的台地
    S.pale.geo(oct(6.2, 5.8, 1.6), 0, .8, 0);                               // 须弥座
    let y = 1.6, r = 4.6;
    for (let k = 0; k < 7; k++) {
      const h = 3.6 - k * .18, d = r * .97 * Math.cos(Math.PI / 8) + .05;
      S.wall.geo(oct(r, r * .97, h), 0, y + h / 2, 0);
      for (let f = 0; f < 8; f += 2) {                                      // 四面券门，逐层错开一面
        const a = (f + .5 + (k % 2)) * Math.PI / 4;
        S.dark.box(1.1, h * .5, .12, Math.sin(a) * d, y + h * .45, Math.cos(a) * d, a);
      }
      S.roofs.geo(new THREE.CylinderGeometry(r * .9, r + 1.3, .9, 8), 0, y + h + .1, 0);   // 腰檐
      S.pale.geo(oct(r * .95, r * .9, .35), 0, y + h + .72, 0);            // 平座
      y += h + .9; r *= .92;
    }
    S.roofs.geo(new THREE.ConeGeometry(r + .9, 2.4, 8), 0, y + 1.2, 0);
    const spire = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.7, .1], [.5, .8], [.9, 1.3], [.4, 2.0], [.6, 2.5], [.25, 3.4], [0, 4.2]]
      .map(p => new THREE.Vector2(p[0], p[1])), 10), M.pale);
    spire.position.y = y + 2.2; ink(spire, 25);
    hall(S, 3.8, 0, 3.4, { R: 6.6, H: 2.2, lift: 1.0, cols: 4, z: 14 });   // 塔前殿
    finish(S, g); g.add(spire);
    return g;
  }

  // ── 汉口水塔：八角形砖塔，腰线分层，顶上瞭望亭（1909 年）
  function buildWaterTower() {
    const g = new THREE.Group(), S = mkS(), R = [5.4, 5.2, 5.0, 4.8, 4.6, 4.4], FH = 3.6;
    S.pale.box(16, 6, 16, 0, -3, 0);
    S.pale.geo(oct(6.4, 6.2, 1.2), 0, .6, 0);
    let y = 1.2;
    R.forEach((r, k) => {
      const d = r * Math.cos(Math.PI / 8) + .02;
      S.wall.geo(oct(r, R[k + 1] || r * .96, FH), 0, y + FH / 2, 0);
      for (let f = 0; f < 8; f++) {
        const a = (f + .5) * Math.PI / 4;
        S.dark.box(1.0, k === 0 ? 2.4 : 1.6, .1, Math.sin(a) * d, y + FH * .5, Math.cos(a) * d, a);
      }
      S.pale.geo(oct(r + .35, r + .35, .3), 0, y + FH, 0);                  // 腰线
      y += FH;
    });
    S.pale.geo(oct(5.0, 5.0, .5), 0, y + .25, 0);                           // 挑台
    for (let f = 0; f < 16; f++) { const a = f / 16 * Math.PI * 2; S.dark.box(.12, 1.0, .12, Math.sin(a) * 4.8, y + 1, Math.cos(a) * 4.8); }
    S.wall.geo(oct(2.6, 2.4, 3.0), 0, y + 2, 0);                            // 瞭望亭
    S.roofs.geo(new THREE.ConeGeometry(3.4, 2.6, 8), 0, y + 4.8, 0);
    S.dark.cyl(.08, 3, 0, y + 7.4, 0);
    return finish(S, g);
  }

  // ── 湖北省博物馆：楚式高台建筑，一主两翼，深檐高脊
  function buildMuseum() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(64, 5, 34, 0, -2.5, 0);
    let y = 0;
    [[40, 22, 1.4], [34, 18, 1.4], [28, 15, 1.2]].forEach(([w, d, h]) => { S.pale.box(w, h, d, 0, y + h / 2, 0); y += h; });   // 三层高台
    for (let i = 0; i < 10; i++) S.pale.box(8, .4 * (i + 1), .7, 0, .2 * (i + 1), 14 - i * .65);
    hall(S, 7.2, 4.0, 5.2, { R: 10.6, r: 1.2, H: 4.4, lift: 1.5, cols: 6 });           // 主馆
    S.roofs.geo(roofGeo(13.2, 7.9, 1.2, .9, 18, 5), 0, 6.6, 0);                         // 主馆重檐
    [-1, 1].forEach(s => {                                                              // 两翼
      S.pale.box(16, 2.2, 14, s * 22, 1.1, 2);
      hall(S, 5.0, 2.2, 4.2, { R: 8.6, r: .6, H: 3.0, lift: 1.2, cols: 4, x: s * 22, z: 2 });
      S.pale.box(6, 1.2, 4, s * 12.5, 3.2, 0);                                          // 连廊
    });
    return finish(S, g);
  }

  // ── 红楼（湖北谘议局旧址）：两层红砖楼，中部门楼、山花与穹顶钟楼（1910 年）
  function buildHonglou() {
    const g = new THREE.Group(), S = mkS(), W = 40, D = 13, FL = 4.4, Y0 = 1.0;
    S.pale.box(W + 6, 7, D + 9, 0, Y0 - 3.5, 1);
    S.wall.box(W, 2 * FL, D, 0, Y0 + FL, 0);
    [0, 1, 2].forEach(f => S.pale.box(W + .5, .3, D + .5, 0, Y0 + f * FL, 0));        // 腰线、檐口
    for (let f = 0; f < 2; f++) for (let k = -7; k <= 7; k++) {
      if (Math.abs(k) < 2) continue;
      S.dark.box(1.2, 2.3, .12, k * 2.5, Y0 + f * FL + 2.2, D / 2 + .06);
      S.pale.box(1.7, .26, .3, k * 2.5, Y0 + f * FL + 3.55, D / 2 + .12);
    }
    S.wall.box(10, 2 * FL + 1.2, D + 4, 0, Y0 + FL + .6, 2);                            // 中部门楼
    for (let i = 0; i < 4; i++) S.pale.cyl(.5, FL - .3, -3.3 + i * 2.2, Y0 + (FL - .3) / 2, D / 2 + 4.4);
    S.pale.box(10.4, .5, 4.6, 0, Y0 + FL - .05, D / 2 + 2.3);                           // 门廊顶即二层阳台
    for (let i = 0; i < 12; i++) S.dark.box(.1, .9, .1, -4.6 + i * .84, Y0 + FL + .65, D / 2 + 4.5);
    S.dark.box(2.6, 3.2, .2, 0, Y0 + 1.6, D / 2 + 4.05);
    const ps = new THREE.Shape(); ps.moveTo(-5.4, 0); ps.lineTo(5.4, 0); ps.lineTo(0, 2.4); ps.closePath();
    S.pale.geo(new THREE.ExtrudeGeometry(ps, { depth: .8, bevelEnabled: false }), 0, Y0 + 2 * FL + 1.2, D / 2 + 3.4);   // 山花
    [-1, 1].forEach(s => {                                                              // 两坡屋面
      const slab = new THREE.BoxGeometry(W - 1, .5, D / 2 + 1.2); slab.rotateX(s * .42);
      S.roofs.geo(slab, 0, Y0 + 2 * FL + 1.3, s * D / 4);
    });
    S.wall.box(5.4, 3.6, 5.4, 0, Y0 + 2 * FL + 3, 0);                                  // 钟楼
    S.pale.disc(1.4, .2, 0, Y0 + 2 * FL + 3, 2.8, 0); S.dark.disc(.1, .3, 0, Y0 + 2 * FL + 3, 2.8, 0);
    const dome = new THREE.Mesh(new THREE.LatheGeometry([[3.2, 0], [3.4, .3], [2.9, 1.6], [1.8, 2.8], [.6, 3.5], [0, 3.7]]
      .map(p => new THREE.Vector2(p[0], p[1])), 16), M.roof);
    dome.position.y = Y0 + 2 * FL + 4.8; ink(dome, 35);
    S.dark.cyl(.07, 4, 0, Y0 + 2 * FL + 10.5, 0);
    finish(S, g); g.add(dome);
    return g;
  }

  // ── 鹦鹉洲长江大桥：三塔悬索桥，门形塔，主缆垂链，吊索成排（2014 年）。half 为半桥长（场景单位）
  function buildSuspension(half) {
    const g = new THREE.Group(), pale = new Acc(), dark = new Acc(), solid = new Acc();
    const DECK = 7.5, TOP = 36, B = 7.0, TZ = [-half * .56, 0, half * .56];
    pale.box(2 * B + 1.6, .7, 2 * half, 0, DECK, 0);
    [-1, 1].forEach(s => pale.box(.5, .5, 2 * half, s * (B + .5), DECK + .5, 0));
    TZ.forEach(z => {
      [-1, 1].forEach(s => solid.beam(V(s * (B + 1.4), -2, z), V(s * (B - .2), TOP, z), 2.0));   // 塔肢收分
      solid.box(2 * B + 1.4, 1.6, 2.0, 0, DECK - 1.6, z);
      solid.box(2 * B + .2, 1.8, 2.0, 0, TOP - 2.5, z);
      solid.box(2 * B - 1, 1.2, 2.0, 0, TOP * .72, z);
      pale.box(2 * B + 6, 3, 7, 0, -1.5, z);                                            // 承台
    });
    const spans = [[-half, TZ[0], DECK + 1, TOP - .8, 3], [TZ[0], TZ[1], TOP - .8, TOP - .8, TOP - DECK - 4],
                   [TZ[1], TZ[2], TOP - .8, TOP - .8, TOP - DECK - 4], [TZ[2], half, TOP - .8, DECK + 1, 3]];
    [-1, 1].forEach(s => spans.forEach(([za, zb, ya, yb, sag]) => {
      const x = s * (B - .2), pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([za + (zb - za) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t)]); }
      for (let i = 0; i < 24; i++) dark.beam(V(x, pts[i][1], pts[i][0]), V(x, pts[i + 1][1], pts[i + 1][0]), .45);   // 主缆
      for (let i = 1; i < 24; i++) if (pts[i][1] > DECK + 1.5) dark.beam(V(x, DECK + .6, pts[i][0]), V(x, pts[i][1], pts[i][0]), .1);   // 吊索
    }));
    g.add(pale.mesh(M.pale, true, 30), solid.mesh(M.std, true, 30), dark.mesh(brushMat, false));
    return g;
  }

  // ── 归元禅寺：山门、钟鼓楼、大雄宝殿、藏经阁一线排开，旁有田字形罗汉堂（1658 年）
  function buildGuiyuan() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(62, 5, 64, 6, -2.5, 0);
    const wall = (x0, z0, x1, z1) => S.wall.box(Math.abs(x1 - x0) + .8, 2.4, Math.abs(z1 - z0) + .8, (x0 + x1) / 2, 1.2, (z0 + z1) / 2);
    wall(-14, -30, 36, -30); wall(-14, 30, 36, 30); wall(-14, -30, -14, 30); wall(36, -30, 36, 30);   // 院墙
    hall(S, 3.4, 0, 3.4, { R: 6.2, H: 2.0, lift: 1.0, cols: 4, z: 26 });                  // 山门
    [-1, 1].forEach(s => {                                                                 // 钟楼、鼓楼
      hall(S, 2.0, 0, 3.0, { R: 4.2, r: 2.2, H: 1.2, lift: .8, cols: 2, x: s * 8, z: 15, win: false });
      hall(S, 1.6, 3.0, 2.4, { R: 3.6, H: 2.0, lift: .8, cols: 2, x: s * 8, z: 15, win: false, rail: false });
    });
    S.pale.box(20, 1.2, 16, 0, .6, 0);
    hall(S, 7.0, 1.2, 5.0, { R: 11.2, r: 1.5, H: 3.6, lift: 1.4, cols: 6 });               // 大雄宝殿
    S.roofs.geo(roofGeo(12.4, 7.3, 1.2, 1.0, 18, 5), 0, 3.8, 0);                          // 重檐
    hall(S, 5.2, 0, 3.6, { R: 8.4, r: 4.6, H: 1.4, lift: 1.0, cols: 5, z: -20 });         // 藏经阁
    hall(S, 4.2, 3.6, 3.2, { R: 7.2, H: 2.6, lift: 1.1, cols: 4, z: -20 });
    S.wall.box(15, 3.2, 15, 24, 1.6, -6);                                                   // 罗汉堂：田字形
    [[-3.75, -3.75], [3.75, -3.75], [-3.75, 3.75], [3.75, 3.75]].forEach(([dx, dz]) =>
      S.roofs.geo(roofGeo(4.6, .3, 1.8, .6, 10, 3), 24 + dx, 3.1, -6 + dz));
    return finish(S, g);
  }

  // ── 古琴台：汉白玉方台与石栏，台后一殿，两侧碑廊，前立牌坊；台面朝西，临月湖
  function buildQintai() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(30, 5, 38, 0, -2.5, -2);
    S.pale.box(11, 1.4, 11, 0, .7, 4);                                                    // 琴台
    ringAt(S.dark, 5.2, 1.9, .12, 1.3, 0, 4);                                              // 石栏
    perim(5.2, 1.3).forEach(p => S.dark.box(.22, 1.0, .22, p[0], 1.9, 4 + p[1]));
    for (let i = 0; i < 4; i++) S.pale.box(4, .35 * (i + 1), .6, 0, .175 * (i + 1), 11.6 - i * .6);
    hall(S, 4.0, 0, 3.6, { R: 7.0, H: 2.4, lift: 1.1, cols: 4, z: -9 });
    [-1, 1].forEach(s => S.wall.box(1.2, 2.2, 16, s * 13, 1.1, -4));                        // 碑廊
    [-1, 1].forEach(s => S.dark.cyl(.35, 5.2, s * 3.2, 2.6, 16));                          // 牌坊
    S.pale.box(8.6, .8, 1.1, 0, 5.4, 16); S.roofs.box(9.6, .5, 2.2, 0, 6.0, 16);
    return finish(S, g);
  }

  /* ── 舟船 ── */
```

- [ ] **步骤 2：构建**

```bash
./build.sh
```

预期：`语法检查通过`。此时模型还没落位，画面不变。

- [ ] **步骤 3：提交**

```bash
git add src/02-landmarks.js && git commit -m "七处新景点的模型"
```

### 任务 11：落位、视角、文案、竖牌

**文件：** 改 `src/01-core.js`、`src/04-scene.js`、`src/05-runtime.js`

- [ ] **步骤 1：七处新坐标**

除古琴台外都来自 OSM 或 Nominatim。古琴台在 OSM 里没有景点条目，只有鹦鹉大道上三个同名公交站，取其站位，**是近似值**。

在 `src/01-core.js` 里，把这一段：

```js
    wuda:    [114.36250, 30.53950],   // 武大老斋舍
```

换成：

```js
    wuda:    [114.36250, 30.53950],   // 武大老斋舍
    hongshan:   [114.33497, 30.53454],   // 宝通禅寺（Nominatim），洪山宝塔在寺内
    watertower: [114.28471, 30.58153],   // 汉口水塔（OSM building=water_tower）
    museum:     [114.35973, 30.56374],   // 湖北省博物馆（OSM tourism=museum）
    honglou:    [114.30084, 30.54445],   // 红楼 · 辛亥革命博物院北区（Nominatim）
    yingwuzhou: [114.28208, 30.53098],   // 鹦鹉洲长江大桥 桥线中点（OSM 两端点的中点）
    guiyuan:    [114.25369, 30.54784],   // 归元禅寺（Nominatim）
    qintai:     [114.26073, 30.55940],   // 古琴台：近似，取鹦鹉大道「古琴台」公交站位
```

- [ ] **步骤 2：落位**

在 `src/04-scene.js` 里，把这一段：

```js
  const chutian = place(buildChutian(), AT.chutian, .82, 0, '东湖 · 楚天台', 'chutian');
```

换成：

```js
  const chutian = place(buildChutian(), AT.chutian, .82, 0, '东湖 · 楚天台', 'chutian');
  const hongshan   = place(buildPagoda(), AT.hongshan, .74, 0, '洪山宝塔 · 宝通禅寺', 'hongshan');
  const watertower = place(buildWaterTower(), AT.watertower, .82, 0, '汉口水塔', 'watertower');
  const museum     = place(buildMuseum(), AT.museum, .78, 0, '湖北省博物馆', 'museum');
  const honglou    = place(buildHonglou(), AT.honglou, .8, 0, '红楼', 'honglou');
  const guiyuan    = place(buildGuiyuan(), AT.guiyuan, .7, 0, '归元禅寺', 'guiyuan');
  const qintai     = place(buildQintai(), AT.qintai, .7, -Math.PI / 2, '古琴台', 'qintai');   // 台面朝西，对着月湖
  // 鹦鹉洲大桥：OSM 桥线两端，桥长随之
  const yA = geo(114.27360, 30.53400), yB = geo(114.29056, 30.52796);
  const yingwuzhou = place(buildSuspension(Math.hypot(yB.x - yA.x, yB.z - yA.z) / 2), AT.yingwuzhou, 1,
    Math.atan2(yB.x - yA.x, yB.z - yA.z), '鹦鹉洲长江大桥', 'yingwuzhou', 0);
```

- [ ] **步骤 3：市廛与草木的避让**

原 `KEEP` 的清场半径由调用方给（草木 16、市廛 46 个单位）。汉口水塔若按 46 单位清场，汉口会被掏空一块，所以新景点各带自己的半径。

在 `src/04-scene.js` 里，把这一段：

```js
  const clearOf = (x, z, r) => KEEP.every(k => (k.x - x) ** 2 + (k.z - z) ** 2 > r * r);
```

换成：

```js
  // 新景点各按自身占地避让，不随调用方的半径——汉口水塔若按市廛的 46 单位清场，汉口就被掏空了
  const KEEP2 = [[AT.hongshan, 20], [AT.watertower, 12], [AT.museum, 34], [AT.honglou, 26], [AT.guiyuan, 34], [AT.qintai, 20]];
  const clearOf = (x, z, r) => KEEP.every(k => (k.x - x) ** 2 + (k.z - z) ** 2 > r * r)
    && KEEP2.every(([k, rr]) => (k.x - x) ** 2 + (k.z - z) ** 2 > rr * rr);
```

- [ ] **步骤 4：七个视角**

在 `src/05-runtime.js` 里，把这一段：

```js
    chutian: orbit(AT.chutian, terrainTop(AT.chutian.x, AT.chutian.z) + 14, 155, 22, 19)
  };
```

换成：

```js
    chutian: orbit(AT.chutian, terrainTop(AT.chutian.x, AT.chutian.z) + 14, 155, 22, 19),
    hongshan:   orbit(AT.hongshan, terrainTop(AT.hongshan.x, AT.hongshan.z) + 11, 125, 18, 18),
    watertower: orbit(AT.watertower, 12, 95, 38, 15),
    museum:     orbit(AT.museum, 6, 150, 12, 20),
    honglou:    orbit(AT.honglou, terrainTop(AT.honglou.x, AT.honglou.z) + 7, 120, 8, 17),
    yingwuzhou: orbit(AT.yingwuzhou, 14, 300, -24, 11),
    guiyuan:    orbit(AT.guiyuan, 5, 135, 18, 22),
    qintai:     orbit(AT.qintai, 4, 110, 250, 19)
  };
```

- [ ] **步骤 5：七段文案**

文案里的年代与形制见任务 14 的事实清单，合并前请核对。

在 `src/05-runtime.js` 里，把这一段：

```js
    chutian: ['东湖 · 楚天台', '立于磨山之巅，按楚国「章华台」形制而建，外五层内六层，高三十六米，台前三百四十五级石阶，顶置青铜凤标。']
  };
```

换成：

```js
    chutian: ['东湖 · 楚天台', '立于磨山之巅，按楚国「章华台」形制而建，外五层内六层，高三十六米，台前三百四十五级石阶，顶置青铜凤标。'],
    hongshan:   ['洪山宝塔 · 宝通禅寺', '宝通禅寺依洪山南坡层层而上，为武汉四大丛林之一。寺后洪山宝塔始建于元代，八面七级，砖石仿木。'],
    watertower: ['汉口水塔', '一九〇九年落成，八角形塔身，高四十一米余，曾是汉口最高的建筑，塔顶兼作消防瞭望。'],
    museum:     ['湖北省博物馆', '楚式高台建筑，一主两翼，深檐高脊。馆藏曾侯乙编钟、越王勾践剑，是楚文化的重镇。'],
    honglou:    ['红楼', '一九一〇年建成，原为湖北谘议局。一九一一年武昌起义后，湖北军政府在此成立。今为辛亥革命博物院北区。'],
    yingwuzhou: ['鹦鹉洲长江大桥', '三塔悬索桥，二〇一四年底通车。桥名出自崔颢「芳草萋萋鹦鹉洲」——诗里的鹦鹉洲早已没入江中。'],
    guiyuan:    ['归元禅寺', '始建于清顺治十五年（一六五八年），以五百罗汉堂闻名，武汉四大丛林之一。'],
    qintai:     ['古琴台', '相传春秋时俞伯牙在此鼓琴，钟子期听出「高山流水」，二人结为知音。台在龟山西麓，临月湖。']
  };
```

- [ ] **步骤 6：竖牌改挂包围盒，并分两级**

在 `src/05-runtime.js` 里，把这一段：

```js
  const MARKS = [
    ['黄鹤楼', 'tower', AT.tower, 52], ['长江大桥', 'bridge', AT.bridge, 28],
    ['晴川阁', 'qc', AT.qc, 22], ['龟山电视塔', 'tv', AT.tv, 168],
    ['江汉关', 'customs', AT.customs, 48], ['武大樱园', 'wuda', wudaAt, 32],
    ['楚天台', 'chutian', AT.chutian, 62]
  ].map(m => {
```

换成：

```js
  // 竖牌挂在模型包围盒顶上 5 个单位——山高改自实测后，写死的高度会插进楼里。
  // 一级七处全城可见；二级七处只在推近后浮现，免得全城视角挤成一片
  const MARKS = [
    ['黄鹤楼', 'tower', tower, 1], ['长江大桥', 'bridge', bridge, 1], ['晴川阁', 'qc', qc, 1], ['龟山电视塔', 'tv', tv, 1],
    ['江汉关', 'customs', customs, 1], ['武大樱园', 'wuda', wuda, 1], ['楚天台', 'chutian', chutian, 1],
    ['洪山宝塔', 'hongshan', hongshan, 2], ['汉口水塔', 'watertower', watertower, 2], ['省博物馆', 'museum', museum, 2],
    ['红楼', 'honglou', honglou, 2], ['鹦鹉洲大桥', 'yingwuzhou', yingwuzhou, 2], ['归元寺', 'guiyuan', guiyuan, 2], ['古琴台', 'qintai', qintai, 2]
  ].map(m => {
```

- [ ] **步骤 7：竖牌锚点**

在 `src/05-runtime.js` 里，把这一段：

```js
    return { el, key: m[1], v: new THREE.Vector3(m[2].x, m[3], m[2].z) };
```

换成：

```js
    const top = new THREE.Box3().setFromObject(m[2]).max.y;
    return { el, key: m[1], tier: m[3], v: new THREE.Vector3(m[2].position.x, top + 5, m[2].position.z) };
```

- [ ] **步骤 8：二级竖牌推近才浮现**

在 `src/05-runtime.js` 里，把这一段：

```js
      let o = THREE.MathUtils.smoothstep(d, 90, 170) * (1 - THREE.MathUtils.smoothstep(d, 1500, 2100));
```

换成：

```js
      const far = m.tier === 1 ? [1500, 2100] : [650, 950];
      let o = THREE.MathUtils.smoothstep(d, 90, 170) * (1 - THREE.MathUtils.smoothstep(d, far[0], far[1]));
```

- [ ] **步骤 9：调试钩子**

加 `?debug` 才挂出来，正常访问不暴露。后面的核对都靠它。

在 `src/05-runtime.js` 里，把这一段：

```js
  window.__ready = true;
```

换成：

```js
  window.__ready = true;
  // ?debug 时把内部状态挂出来，供浏览器里核对；正常访问不暴露
  if (/[?&]debug\b/.test(location.search)) window.__dbg = {
    GEO, LAKES, LAND_HOLES, HILLS, HILL, YZ, HAN, HANKOU, HANYANG, WUCHANG, AT, VIEWS, MARKS, LABELS,
    LAND_Y, terrainTop, reliefAt, onLand, inPoly, geo, camera, controls, flyTo, scene
  };
```

- [ ] **步骤 10：构建并逐项核对**

```bash
./build.sh
```

打开 `dist/index.html?debug`，等 5 秒，控制台执行：

```js
const D = window.__dbg;
const names = { tower: '黄鹤楼', bridge: '长江大桥', tv: '电视塔', qc: '晴川阁', customs: '江汉关',
  wuda: '武大', chutian: '楚天台', hongshan: '宝通寺', watertower: '水塔', museum: '省博',
  honglou: '红楼', yingwuzhou: '鹦鹉洲桥', guiyuan: '归元寺', qintai: '古琴台' };
const r = {};
for (const k of Object.keys(names)) {
  const p = D.AT[k];
  r[names[k]] = (k === 'bridge' || k === 'yingwuzhou')
    ? (D.onLand(p.x, p.z) ? '✗ 桥不该在陆上' : '水上 ✓')
    : (D.onLand(p.x, p.z) ? '陆上 ✓' : '✗ 落在水里');
}
console.table(r);
console.log('竖牌', D.MARKS.map(m => m.key + ':' + m.tier));
console.log('视角', Object.keys(D.VIEWS).length, '按钮', document.querySelectorAll('#nav button').length);
```

预期：十四处全部 ✓（两座桥在水上，其余在陆上）；竖牌一级七处、二级七处；
视角 17 个；按钮此时仍是 9 个（导览分组在任务 12）。

- [ ] **步骤 11：提交**

```bash
git add src/01-core.js src/04-scene.js src/05-runtime.js
git commit -m "七处新景点落位：视角、文案与分级竖牌"
```

---

## 阶段六　界面

### 任务 12：导览分组与署名

十四处景点、十六个按钮，原来一排平铺会挤。按三镇分组，并在窄屏收紧。
署名是许可要求：Copernicus 的衍生品必须带指定措辞，OSM 要求署名贡献者。

**文件：** 改 `src/00-shell.html`

- [ ] **步骤 1：导览按三镇分组**

在 `src/00-shell.html` 里，把这一段：

```js
  <nav id="nav" aria-label="视角">
    <button type="button" id="b-home" data-view="home" aria-pressed="true">全城</button>
    <button type="button" id="b-core" data-view="core" aria-pressed="false">两江</button>
    <button type="button" id="b-tower" data-view="tower" aria-pressed="false">黄鹤楼</button>
    <button type="button" id="b-bridge" data-view="bridge" aria-pressed="false">大桥</button>
    <button type="button" id="b-qc" data-view="qc" aria-pressed="false">晴川阁</button>
    <button type="button" id="b-tv" data-view="tv" aria-pressed="false">电视塔</button>
    <button type="button" id="b-customs" data-view="customs" aria-pressed="false">江汉关</button>
    <button type="button" id="b-wuda" data-view="wuda" aria-pressed="false">武大</button>
    <button type="button" id="b-lake" data-view="lake" aria-pressed="false">东湖</button>
  </nav>
```

换成：

```js
  <nav id="nav" aria-label="视角">
    <div class="grp">
      <button type="button" id="b-home" data-view="home" aria-pressed="true">全城</button>
      <button type="button" id="b-core" data-view="core" aria-pressed="false">两江</button>
      <button type="button" id="b-bridge" data-view="bridge" aria-pressed="false">大桥</button>
      <button type="button" id="b-yingwuzhou" data-view="yingwuzhou" aria-pressed="false">鹦鹉洲</button>
    </div>
    <div class="grp" role="group" aria-label="武昌">
      <span class="gl" aria-hidden="true">武昌</span>
      <button type="button" id="b-tower" data-view="tower" aria-pressed="false">黄鹤楼</button>
      <button type="button" id="b-honglou" data-view="honglou" aria-pressed="false">红楼</button>
      <button type="button" id="b-hongshan" data-view="hongshan" aria-pressed="false">宝通寺</button>
      <button type="button" id="b-wuda" data-view="wuda" aria-pressed="false">武大</button>
      <button type="button" id="b-museum" data-view="museum" aria-pressed="false">省博</button>
      <button type="button" id="b-lake" data-view="lake" aria-pressed="false">东湖</button>
    </div>
    <div class="grp" role="group" aria-label="汉阳">
      <span class="gl" aria-hidden="true">汉阳</span>
      <button type="button" id="b-qc" data-view="qc" aria-pressed="false">晴川阁</button>
      <button type="button" id="b-tv" data-view="tv" aria-pressed="false">电视塔</button>
      <button type="button" id="b-guiyuan" data-view="guiyuan" aria-pressed="false">归元寺</button>
      <button type="button" id="b-qintai" data-view="qintai" aria-pressed="false">古琴台</button>
    </div>
    <div class="grp" role="group" aria-label="汉口">
      <span class="gl" aria-hidden="true">汉口</span>
      <button type="button" id="b-customs" data-view="customs" aria-pressed="false">江汉关</button>
      <button type="button" id="b-watertower" data-view="watertower" aria-pressed="false">水塔</button>
    </div>
  </nav>
```

- [ ] **步骤 2：分组的样式**

在 `src/00-shell.html` 里，把这一段：

```js
  #nav {
    display: flex; gap: 2px; pointer-events: auto; padding-bottom: 12px; flex-wrap: wrap;
    max-width: min(660px, 52vw);
  }
```

换成：

```js
  #nav {
    display: flex; gap: 4px 16px; pointer-events: auto; padding-bottom: 12px; flex-wrap: wrap;
    max-width: min(700px, 56vw);
  }
  #nav .grp { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px; }
  #nav .gl {
    font-size: 11px; letter-spacing: .3em; color: var(--ink-faint); padding: 0 2px 0 4px;
    text-shadow: 0 0 8px var(--paper);
  }
```

- [ ] **步骤 3：窄屏收紧**

1024 宽时若不收紧，导览会掉到信息卡下面，把卡片顶进画面里。

在 `src/00-shell.html` 里，把这一段：

```js
  @media (max-width: 860px) {
    #tools { display: none; }
```

换成：

```js
  @media (max-width: 1180px) {
    #nav { max-width: min(560px, calc(100vw - 470px)); }
    #nav button { font-size: 17px; padding: 6px 8px 8px; }
  }
  @media (max-width: 860px) {
    #tools { display: none; }
```

- [ ] **步骤 4：署名**

短句可见，完整措辞放在 `title` 里（悬停可见）。

在 `src/00-shell.html` 里，把这一段：

```js
  <div id="hint">拖拽旋转　滚轮缩放　点击景点</div>
```

换成：

```js
  <div id="hint">拖拽旋转　滚轮缩放　点击景点</div>
  <div id="credit" title="Terrain produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30. Place coordinates © OpenStreetMap contributors (ODbL).">地形 Copernicus DEM GLO-30 · 地名 © OpenStreetMap 贡献者</div>
```

- [ ] **步骤 5：署名的样式**

在 `src/00-shell.html` 里，把这一段：

```js
  #hint { font-size: 11px; letter-spacing: .26em; text-shadow: 0 0 8px var(--paper); }
```

换成：

```js
  #hint { font-size: 11px; letter-spacing: .26em; text-shadow: 0 0 8px var(--paper); }
  #credit {
    flex-basis: 100%; margin-top: -10px; text-align: right; pointer-events: auto; cursor: help;
    font-size: 10px; letter-spacing: .08em; color: var(--ink-faint); opacity: .75; text-shadow: 0 0 6px var(--paper);
  }
```

- [ ] **步骤 6：构建，按三种宽度看**

```bash
./build.sh
```

在 1280×800、1024×768、375×812 三种宽度下打开：
- 1280 与 1024：导览三行排在信息卡右边，卡片不与地名题记重叠。
- 375：导览折到卡片下方，页面没有横向滚动。
- 右下角有一行小字署名，悬停显示完整措辞。

- [ ] **步骤 7：提交**

```bash
git add src/00-shell.html && git commit -m "导览按三镇分组，补数据署名"
```

---

## 阶段七　文档与收尾

### 任务 13：README

**文件：** 改 `README.md`

- [ ] **步骤 1：目录树补一行**

把：

```
  05-runtime.js      镜头、地名题记、地标竖牌、点选、渲染循环
```

换成：

```
  geodata.gen.js     由 tools/geodata/extract.py 生成的河道、湖、山数据（勿手改）
  05-runtime.js      镜头、地名题记、地标竖牌、点选、渲染循环
```

- [ ] **步骤 2：坐标表换成十四处**

把「## 坐标系统」一节里那张七行的表，换成下面这张，并把表下那段说明一并替换：

```markdown
| 地标 | 经度 | 纬度 | 坐标来源 |
|---|---|---|---|
| 黄鹤楼 | 114.29694 | 30.54694 | 维基百科，与 OSM 相符 |
| 武汉长江大桥（正桥中点） | 114.28775 | 30.54975 | 桥轴两端推得 |
| 龟山电视塔 | 114.27508 | 30.55802 | OSM；与 DEM 实测龟山峰顶相距 45 米 |
| 晴川阁 · 禹稷行宫 | 114.27980 | 30.55867 | OSM |
| 江汉关 | 114.29208 | 30.57874 | OSM |
| 汉口水塔 | 114.28471 | 30.58153 | OSM |
| 红楼 · 辛亥革命博物院北区 | 114.30084 | 30.54445 | Nominatim |
| 归元禅寺 | 114.25369 | 30.54784 | Nominatim |
| 古琴台 | 114.26073 | 30.55940 | **近似**：鹦鹉大道同名公交站位 |
| 鹦鹉洲长江大桥（桥线中点） | 114.28208 | 30.53098 | OSM 桥线两端的中点 |
| 宝通禅寺 · 洪山宝塔 | 114.33497 | 30.53454 | Nominatim |
| 武大老斋舍 | 114.36250 | 30.53950 | 维基百科 |
| 湖北省博物馆 | 114.35973 | 30.56374 | OSM |
| 东湖磨山 · 楚天台 | 114.40500 | 30.55450 | 与 DEM 实测磨山峰顶相距 30 米 |

长江与汉水的中泓线、半宽，以及各湖岸线，均由 Copernicus GLO-30 的水体掩膜提取：
在掩膜里走最小代价路径取河心，半宽取离岸距离；湖取高斯圆滑后的 0.5 等值线
（东湖 σ=300 米，小湖 σ=90 米），去掉 30 米格网抖出的碎边。山体形状取自 DSM
「高出局部基面」的连通地块，峰值改用实测海拔。这不是测绘岸线，大的走向与相对位置可靠，
细节不能当地图用。
```

- [ ] **步骤 3：渲染要点里改写「山」那一段**

把：

```markdown
**山** —— 皴（顺坡放射的短笔，只在陡处见笔）、廓（法线与视线垂直处落墨，
   等于一道随镜头走的轮廓线）、山脚云气（下缘虚入纸中）。
```

换成：

```markdown
**山** —— 形状取自 Copernicus GLO-30，每座山一块高程格子（相对平原的起伏）；
   峰值改用实测海拔，因为 DSM 含建筑，能抹净楼群的滤波会连山一起削掉六成。
   网格点之间作 Catmull-Rom 双三次插值，轮廓是圆的，不见格子。
   笔法仍是皴（顺坡放射的短笔，只在陡处见笔）、廓（法线与视线垂直处落墨）、
   山脚云气（下缘虚入纸中）。
```

- [ ] **步骤 4：补一节「数据与许可」**

在「## 资料来源」之前插入：

```markdown
## 数据与许可

地形与水系：Copernicus DEM GLO-30。衍生品按许可须附以下措辞：

> produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space
> GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
>
> The organisations in charge of the Copernicus programme by law or by delegation do not incur
> any liability for any use of the Copernicus WorldDEM-30.

地名与景点坐标：OpenStreetMap 与 Nominatim，© OpenStreetMap 贡献者，ODbL 1.0。

重新生成数据（原始瓦片约 532 MB，不入库）：

```bash
python3 -m venv .venv-geo && .venv-geo/bin/pip install -r tools/geodata/requirements.txt
.venv-geo/bin/python tools/geodata/download.py      # → output/dem-wuhan/ 九张瓦片
.venv-geo/bin/python tools/geodata/prepare.py       # → 拼接裁剪成两张 GeoTIFF
.venv-geo/bin/python tools/geodata/extract.py       # → src/geodata.gen.js
.venv-geo/bin/python tools/geodata/check_geodata.py # → 校验
```
```

- [ ] **步骤 5：提交**

```bash
git add README.md && git commit -m "README：十四处坐标与来源、数据许可与复现步骤"
```

### 任务 14：整体核对

- [ ] **步骤 1：构建并跑校验**

```bash
./build.sh && .venv-geo/bin/python tools/geodata/check_geodata.py
```

预期：构建打印「已用 terser 压缩」；校验 `全部通过`。

- [ ] **步骤 2：体积**

```bash
ls -l dist/index.html
```

预期：约 85 KB（改动前 62.7 KB）。超过 100 KB 要查清多出来的是什么。

- [ ] **步骤 3：浏览器整体核对**

打开 `dist/index.html?debug`，等 5 秒，控制台执行：

```js
const D = window.__dbg;
let n = 0; const t0 = performance.now();
await new Promise(res => { const tick = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); });
console.log('帧率', Math.round(n / ((performance.now() - t0) / 1000)));
console.log('山', D.HILLS.length, '湖', D.LAKES.length, '挖洞', D.LAND_HOLES.map(h => h.length));
console.log('晴川阁在陆上', D.onLand(D.AT.qc.x, D.AT.qc.z));
console.log('地面高', ['tower', 'tv', 'chutian', 'wuda'].map(k => k + ':' + D.terrainTop(D.AT[k].x, D.AT[k].z).toFixed(1)).join(' '));
```

预期：帧率不低于 60；山 9、湖 4、挖洞 `[0, 1, 3]`；晴川阁 `true`；
地面高 `tower:15.2 tv:26.0 chutian:36.4 wuda:11.2` 上下。

- [ ] **步骤 4：逐个视角看一遍**

把十七个视角依次点过去，确认：镜头不穿山不入地；竖牌不插进模型；
新景点都站在地上（归元寺、古琴台在汉阳平地，宝通寺在洪山南坡，省博在东湖西岸）。

- [ ] **步骤 5：核对文案里的事实**

新写的七段文案含以下待核事实，合并前请逐条确认或改写：

| 景点 | 待核 |
|---|---|
| 洪山宝塔 | 元代始建、八面七级；宝通寺为「武汉四大丛林」之一 |
| 汉口水塔 | 一九〇九年落成、高四十一米余、兼作消防瞭望 |
| 湖北省博物馆 | 「一主两翼」的楚式高台；藏曾侯乙编钟、越王勾践剑 |
| 红楼 | 一九一〇年建成、原为湖北谘议局、今为辛亥革命博物院北区 |
| 鹦鹉洲长江大桥 | 三塔悬索桥、二〇一四年底通车 |
| 归元禅寺 | 清顺治十五年（一六五八年）始建、五百罗汉堂 |
| 古琴台 | 伯牙子期典故、在龟山西麓临月湖 |

- [ ] **步骤 6：截图对比**

对改动前后的「全城」视角各截一张，并排看：两江走向、三镇轮廓、东湖形状应当明显更接近实况，
而笔墨质感、留白、色阶不变。

- [ ] **步骤 7：开 PR**

```bash
git push -u origin feat/real-terrain
```

PR 正文说明：数据来源与许可、两处坐标更正、江滩缺陷的修复、古琴台坐标为近似值、
以及文案待核清单。

---

## 留给后续的

- **古琴台坐标是近似值**。若能找到景点本身的实测坐标，改 `src/01-core.js` 的 `SITE.qintai` 即可。
- **东湖东南那片 0.43 km² 的无名水面**是实测水体，但形状细长。若看着碍眼，
  在 `extract.py` 的 `_lakes()` 里把小湖的 `min_km2` 提到 0.5 即可去掉。
- **`terrainTop()` 现在每次要遍历九座山**。市廛落位时会调用上千次，实测不成瓶颈（加载 0.4 秒），
  若将来山变多，可加一层格子索引。
