# 水墨江城

一张可交互的三维武汉城图，Three.js 手写 NPR 水墨渲染，输出为单文件 HTML。

汉水自西北来，于南岸嘴汇入长江；江北为汉口，两江之间是汉阳，大江东南岸为武昌。
图上方位依实测经纬度排布，水平一比一，山与楼塔竖向约放大五倍，使其在全城视角下仍可辨认。

## 构建

```bash
./build.sh          # src/ → dist/index.html
```

无依赖、无打包器。`dist/index.html` 是完全自包含的单文件，直接用浏览器打开即可，
Three.js（r128）、OrbitControls、BufferGeometryUtils、GSAP 均从公共 CDN 引入。

## 目录

```
src/
  00-shell.html      页面骨架：CSS、题名、竖排诗、导览、罗盘与比例尺、CDN 引入
  geodata.gen.js     由 tools/geodata/extract.py 生成的河道、湖、山数据（勿手改）
  01-core.js         经纬度投影、水墨 Shader、几何累加器、通用构件
  02-landmarks.js    十四处地标的程序化建模
  03-terrain.js      两江河道、湖、山体（读 geodata.gen.js）与由此推出的三镇陆块、水纹图与江面 Shader
  04-scene.js        景点落位、草木、市廛、舟船、飞鸟、烟波
  05-runtime.js      镜头、地名题记、地标竖牌、点选、渲染循环
  06-audio.js        背景音乐：Web Audio 合成的古琴、水声与江风
tools/geodata/       离线管线：download.py 下载瓦片，prepare.py 拼接裁剪，extract.py 提取，check_geodata.py 校验
build.sh             拼接脚本（<script> 与 IIFE 的包裹在此，不在源码里）
dist/index.html      构建产物（不入库）
```

## 坐标系统

以黄鹤楼为原点的等距圆柱投影，`+x` 正东、`−z` 正北，1 单位 = 13 米。

| 地标 | 经度 | 纬度 | 坐标来源 |
|---|---|---|---|
| 黄鹤楼 | 114.29694 | 30.54694 | 维基百科，与 OSM 相符 |
| 武汉长江大桥（正桥中点） | 114.28282 | 30.55208 | OSM 桥梁节点沿桥轴移到江心（约 85 米）；原手工值偏东南约 600 米 |
| 龟山电视塔 | 114.27508 | 30.55802 | OSM；与 DEM 实测龟山峰顶相距约 45 米 |
| 晴川阁 · 禹稷行宫 | 114.27980 | 30.55867 | OSM |
| 江汉关 | 114.29208 | 30.57874 | OSM |
| 汉口水塔 | 114.28471 | 30.58153 | OSM |
| 红楼 · 辛亥革命博物院北区 | 114.30084 | 30.54445 | Nominatim |
| 归元禅寺 | 114.25369 | 30.54784 | Nominatim |
| 古琴台 | 114.26073 | 30.55940 | **近似**：鹦鹉大道同名公交站位 |
| 鹦鹉洲长江大桥（桥心） | 114.27612 | 30.53310 | 沿 OSM 桥向，取水体掩膜上两岸之间的中点 |
| 宝通禅寺 · 洪山宝塔 | 114.33497 | 30.53454 | Nominatim |
| 武大老斋舍 | 114.36250 | 30.53950 | 维基百科 |
| 湖北省博物馆 | 114.35973 | 30.56374 | OSM |
| 东湖磨山 · 楚天台 | 114.40500 | 30.55450 | 原纬度 30.5445 为笔误；与 DEM 实测磨山峰顶相距约 45 米 |

长江与汉水的中泓线、半宽，以及各湖岸线，均由 Copernicus GLO-30 的水体掩膜提取：
在掩膜里走最小代价路径取河心，半宽取离岸距离；湖取高斯圆滑后的 0.5 等值线
（东湖 σ=300 米，小湖 σ=90 米），去掉 30 米格网抖出的碎边。山体形状取自 DSM
「高出局部基面」的连通地块，峰值改用实测海拔。这不是测绘岸线，大的走向与相对位置可靠，
细节不能当地图用。

## 渲染要点

**墨色分阶** —— 光照结果先量化成四阶，再在 `uInk`/`uPaper` 之间取色，
叠 fbm 墨晕与交叉排线。每种材质可单独指定这两端的颜色，整幅图的色阶由此统一调度。

**江面** —— 加载时在 CPU 上烤一张 512×512 的「水纹图」，逐像素存
「距中泓的世界距离」「离岸远近」「是否水面」「是江还是湖」。
Shader 据此让笔触顺河道走、近岸留白、江心笔浓，湖面则改为平远的横笔。

**山** —— 形状取自 Copernicus GLO-30，每座山一块高程格子（相对平原的起伏）；
   峰值改用实测海拔，因为 DSM 含建筑，能抹净楼群的滤波会连山一起削掉六成。
   网格点之间作 Catmull-Rom 双三次插值，轮廓是圆的，不见格子。
   笔法仍是皴（顺坡放射的短笔，只在陡处见笔）、廓（法线与视线垂直处落墨）、
   山脚云气（下缘虚入纸中）。

**镜头穿过时的消隐** —— 屋舍在靠近镜头时按世界坐标抖动溶解，边线同步淡出；
镜头高度另有地形兜底，不钻山不入地。

**背景音乐** —— 不带音频文件，全由 Web Audio 现场合成：D 调五声，疏落的拨弦
（三角波加泛音，音头带一点吟猱式的下滑，低通滤波由亮扫暗），随机漫步成句，句间留白，
底下是极轻的水声与江风，整体过一层噪声生成的混响。浏览器禁止自动播放，
所以默认静音，点右上角朱印「乐」才开。

## 两个踩过的坑

1. **`patch` 是 GLSL ES 3.0 的保留字。** 拿它当变量名会导致江面 shader 在所有
   WebGL2 浏览器上静默编译失败，画面只是「水没画出来」，不报错到眼前。

2. **GSAP 的时间轴走 rAF。** 弱显卡上渲染帧率掉到个位数时，`lagSmoothing`
   会把动画拖得极慢，UI 可能长时间卡在不可见状态。因此入场的题名与导览
   改用 CSS 动画驱动（走合成器时钟，不受渲染帧率影响），GSAP 只留给镜头。

## 数据与许可

地形与水系：Copernicus DEM GLO-30。衍生品按许可须附以下措辞（页面右下角署名可展开查看）：

> produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space
> GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
>
> The organisations in charge of the Copernicus programme by law or by delegation do not incur
> any liability for any use of the Copernicus WorldDEM-30.

地名与景点坐标：OpenStreetMap 与 Nominatim，© OpenStreetMap 贡献者，ODbL 1.0。

重新生成数据（原始瓦片约 430 MB，拼接后整个目录约 560 MB，放在不入库的 `output/dem-wuhan/`）：

```bash
python3 -m venv .venv-geo && .venv-geo/bin/pip install -r tools/geodata/requirements.txt
.venv-geo/bin/python tools/geodata/download.py      # → output/dem-wuhan/ 九个格位，DEM 与水体掩膜各一份，共 18 个 GeoTIFF
.venv-geo/bin/python tools/geodata/prepare.py       # → 拼接裁剪成两张 GeoTIFF
.venv-geo/bin/python tools/geodata/extract.py       # → src/geodata.gen.js
.venv-geo/bin/python tools/geodata/check_geodata.py # → 校验
```

## 资料来源

坐标与建筑数据取自维基百科、武汉市人民政府门户网站、武汉市民政局、
东湖生态旅游风景区管理委员会、武汉大学新闻网、OpenStreetMap 与 Nominatim 等公开资料。
