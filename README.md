# 水墨江城

一张可交互的三维武汉城图，Three.js 手写 NPR 水墨渲染，输出为单文件 HTML。

汉水自西北来，于南岸嘴汇入长江；江北为汉口，两江之间是汉阳，大江东南岸为武昌。
图上方位依实测经纬度排布，水平一比一，山与楼塔竖向约放大五倍，使其在全城视角下仍可辨认。

默认从「两江 · 龟蛇锁大江」进入，以龟蛇两山、大桥和黄鹤楼为构图中心；「回全城」可从任一景点返回总览。「观画」可收起题诗、竖牌与导览，按 Esc 或点「退出观画」恢复。
点「黄鹤楼」可从西侧同时看见山脚入口、三层院落和山顶主楼；点白塔、牌坊或游亭可回到这一片区。图上的 15 处景点各有一套 Blender 模型。点「建筑图录」可看各自的相机渲染，再从图录定位到地图。黄鹤楼另有西面匾额特写，武汉长江大桥可近看桥头堡、桁架和铸铁栏花，鹦鹉洲长江大桥可顺主缆看到吊杆与边梁的接头。两桥的构件与桥名特写都可定位到地图。在图录里点「游两岸街巷」，可从八处近景进入茶棚、里分、门院或回望双桥，也可选汉阳或武昌的斜俯视，观看整片街坊与江岸。视角会保存在网址中，可直接分享。两江沿岸铺有里分、洋行、仓房、住宅与塔楼。前一版构图的同尺寸对照见[历史视觉样板](docs/visual-study.md)。

## 构建

```bash
./build.sh          # src/ → dist/index.html
```

无需打包器，输出为可直接用浏览器打开的单文件 HTML。**单文件分发仍需联网**：
Three.js（r128）、OrbitControls、BufferGeometryUtils、GSAP 从公共 CDN 加载，字体使用 Google Fonts，失败时回退系统字体。
依赖加载超过 15 秒、资源失败或图形上下文丢失时，页面提供明确提示和“重新加载”入口。

`npm ci` 安装锁定版本的开发工具；构建优先使用本地 Terser，缺少压缩工具时输出未压缩版本，不临时下载工具。
构建需要 Node.js 进行语法检查；缺少 Node 或源码语法错误都会中止，并保留上次有效产物。

```bash
npm ci
npm run test:build
npx playwright install chromium webkit
npm run test:browser
# 可选：直接打开 file:// 单文件，验证真实 CDN 和音乐开关
node tests/live-smoke.cjs chromium
node tests/live-smoke.cjs webkit
```

浏览器回归测试使用与 CDN 相同版本的库的本地副本，并注入网络、超时和 WebGL 故障。
测试依赖只用于开发，不打入页面；截图、报告和失败追踪保存在 `output/playwright/`。
本轮修复的验收记录和截图见 [体验修复验收](docs/repair-map-experience.md)。

## 浏览与无障碍

手机竖屏与矮横屏采用地图优先布局：右上角只留「⋯」与「乐」，题跋、回全城、观画收在「⋯」展开的纸色竖条里（Esc 或点空白处收起）；底部导航可横向滑动，详情按需展开。
界面控件只用宣纸、墨、朱砂三种材料：按钮不画框，键盘焦点统一为朱砂细线；桌面端首次切换景点后题诗淡到三成，悬停或聚焦时复现。
建筑图录按册页装裱，可用两侧「‹」「›」或方向键左右翻页。
全城和景点镜头根据界面实际占用空间自动取景；窗口变化只重排预设镜头，手动浏览的位置保留。
单指旋转，双指缩放或平移；桌面使用拖拽和滚轮。开始手势会立即取消正在进行的镜头切换。
牌签之间和界面之间保留至少 8px 间距；隐藏牌签不会进入键盘焦点，所有景点仍可用底部导航访问。
入场时远山先显，城市随墨晕从画心向外洇开，导览在动画期间即可使用。
系统开启“减少动态效果”后，地图直接显示终态，镜头直接切换，水面、树草、烟雾、舟船和飞鸟停止自动运动，偏好变化即时生效。

## 目录

```
src/
  00-shell.html      页面骨架：CSS、题名、竖排诗、导览、罗盘与比例尺、数据署名
  00-boot.js         依赖加载、15 秒超时、就绪状态与失败恢复
  geodata.gen.js     由 tools/geodata/extract.py 生成的河道、湖、山数据（勿手改；拼在 01-core.js 之前）
  01-core.js         经纬度投影、水墨 Shader、几何累加器、通用构件
  architecture.gen.js  Blender 导出的顶点、索引和天空可见度，供 build.sh 内嵌
  architecture-plates.gen.js  由同次渲染生成，包含建筑图录和两个细部镜头的 JPEG
  02-landmarks.js    加载景点网格与材质，构建江上舟船
  03-terrain.js      两江河道、湖、山体（读 geodata.gen.js）与由此推出的三镇陆块、水纹图与江面 Shader
  04-bridge-roads.js 两桥共用的桥面设色、鹦鹉洲大桥两岸引道与桥头街坊
  04-districts.js    三镇街廊、连接两桥的岸上道路、街旁房舍与景点连接线
  04-landmark-grounds.js  听涛两桥、北馆前庭与蛇山登楼石阶
  04-scene.js        景点落位、山顶台地、街区与道路、舟船、飞鸟、烟波
  04-tower-park.js   黄鹤楼公园西区的台地、池院、建筑与山脚园路
  04-planting.js     山林、滨水与街旁植栽的树型、避让和实例布局
  05-layout.js       紧凑面板、可用画幅与包围盒取景
  05-overlays.js     地名与牌签投影、碰撞避让、尺寸和排版缓存
  05-far-hills.js    绘制三层水墨远山，随地平线与方位角定位，提供山脊高度供朱砂日避让
  05-runtime.js      镜头状态、点选、渲染循环
  06-audio.js        背景音乐：Web Audio 合成的古琴、水声与江风
assets/              网站图标、街巷水墨材质、窗景、樟叶和江天薄雾
tools/blender/       独立地标与街屋几何、Blender 场景导出和渲染
tests/               单文件构建、浏览器交互回归与取景截图
docs/                设计资料、视觉对照与验收记录
output/              本地模型工程、渲染、地形工作数据与测试证据
tools/geodata/       离线管线：download.py 下载瓦片，prepare.py 拼接裁剪，extract.py 提取，check_geodata.py 校验
build.sh             拼接脚本（<script> 与 IIFE 的包裹在此，不在源码里）
dist/index.html      构建产物（不入库）
```

## Blender 建模与渲染

日常构建直接使用已提交的模型数据。修改建筑时，在 Blender 5.2 的独立会话里，通过 Blender MCP 的 `execute_blender_code` 执行建模脚本。将下面的路径替换为项目的绝对路径。

```python
import runpy
runpy.run_path("/path/to/shuimo-jiangcheng/tools/blender/build.py", run_name="__main__")
```

脚本在临时场景里分别创建 15 个景点，按构件保留可编辑对象，输出到 `output/architecture/<景点键>.blend` 和同名 PNG。黄鹤楼和两座长江大桥另带细部相机。两桥的构件特写分别输出为 `bridge-craft.png` 和 `yingwuzhou-craft.png`。景点与建模参考见[建筑图录](docs/landmark-atlas.md)。网页的几何与图录来自同一批模型，导出时按材质合并图元并烘焙天空遮蔽。运行 `npm run build` 重新生成单文件地图。

黄鹤楼的四面凸廊、五层金瓦和六十翘角参考[武昌区主楼介绍](https://www.wuchang.gov.cn/sghjjrfwz/bjww/202307/t20230704_2226374.html)。桥头堡的通高拱窗、低重檐与红珠顶饰参考[武汉市修缮实景](https://www.wuhan.gov.cn/sy/whyw/202212/t20221212_2114209.shtml)。建筑沿用地图的夸张比例。街坊由七种街屋与塔楼原型组合，表达三镇的典型街道。

### 编辑全城场景

先构建地图，再用已安装的 Playwright WebKit 从实际网页采集地形、岸线、街道与建筑变换。

```bash
npm run build
node tools/blender/capture-city.cjs
```

使用同一 Blender MCP 调用运行 `tools/blender/city.py`，生成 `output/architecture/city.blend`、两江近景 `city.png`、全城鸟瞰 `city-wide.png` 和蛇山街景 `city-hillside.png`。从工程的「武汉街坊」集合选择一栋屋舍即可独立移动或旋转，同屋型的实例共享几何。十五处建筑均按景点分集合，山林、船只和灯光也可分别编辑。网页版使用实时水墨渲染。全城工程的「镜头与光」集合中有二十台相机。沿江鸟瞰图 `bridge-river.png` 从鹦鹉洲长江大桥上游望向武汉长江大桥，同一画面可见两座桥、两岸路网与黄鹤楼。「长江货船 · 船艉与舱盖」近景输出为 `river-freighter.png`，可核对船身吃水、舱盖和尾迹的位置。四台桥头相机分别面向两座大桥的武昌、汉阳落地点，同时输出 `bridge-wuhan-{wuchang,hanyang}.png` 和 `bridge-yingwuzhou-{wuchang,hanyang}.png`，画面从钢桁梁或橘红桥塔延伸到岸上路口，可沿着引桥检查坡道、步道和横街的衔接。双桥之间另设四台岸边透视相机，两岸各有一台望向武汉长江大桥、一台望向鹦鹉洲长江大桥，输出为 `waterfront-{hanyang,wuchang}-{wuhan,yingwuzhou}.png`。另两台低机位分别从江边望向汉阳旧码头和武昌观景石凳，细部图为 `waterfront-hanyang-mooring.png` 和 `waterfront-wuchang-bench.png`。从江边看进街巷的两幅为 `waterfront-hanyang-tea-lane.png` 和 `waterfront-wuchang-courtyard-lane.png`，从巷口回望桥与江面的两幅为 `waterfront-{hanyang,wuchang}-lane-to-bridge.png`。

同一次运行还会输出蛇山西段独立工程 `output/architecture/tower-park.blend` 和西入口俯视图 `output/architecture/tower-park.png`。可以单独选择胜像宝塔、三楚一楼牌坊、归鹤池铜鹤、两座侧亭与园路，也可以从周边街道转到主楼检查坡地衔接。这些模型与网页共用 `tools/blender/tower_park.py` 的构件以及网页采集的场地坐标。

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
| 古琴台 | 114.25833 | 30.55667 | 景区示意中心，龟山以西、月湖东南岸。[公开坐标](https://zh.wikipedia.org/wiki/古琴臺) · [汉阳区景区资料](https://www.hanyang.gov.cn/mlhy/fjms/202509/t20250923_2651436.shtml) |
| 鹦鹉洲长江大桥（桥心） | 114.27612 | 30.53310 | 沿 OSM 桥向，取水体掩膜上两岸之间的中点 |
| 宝通禅寺 · 洪山宝塔 | 114.33497 | 30.53454 | Nominatim |
| 武大老斋舍 | 114.36250 | 30.53950 | 维基百科 |
| 湖北省博物馆 | 114.35973 | 30.56374 | OSM |
| 东湖听涛 · 行吟阁 | 114.37112 | 30.56733 | OSM 建筑轮廓中心 |
| 东湖磨山 · 楚天台 | 114.40500 | 30.55450 | 原纬度 30.5445 为笔误；与 DEM 实测磨山峰顶相距约 45 米 |

长江与汉水的中泓线、半宽，以及各湖岸线，均由 Copernicus GLO-30 的水体掩膜提取：
在掩膜里走最小代价路径取河心，半宽取离岸距离；湖取高斯圆滑后的 0.5 等值线
（东湖 σ=300 米，小湖 σ=90 米），去掉 30 米格网抖出的碎边。山体形状取自 DSM
「高出局部基面」的连通地块，峰值改用实测海拔。这不是测绘岸线，大的走向与相对位置可靠，
细节不能当地图用。

## 渲染要点

**墨色与远近。** 网页用四阶光照把不同材质归入同一幅画。金瓦留亮，背光檐底、木廊和钢桁借模型烘焙的天空可见度积墨；街坊退远时，窗列与瓦面随距离收淡。近山短皴顺坡聚散，树冠分冷暖。街屋与树脚按实际落点在地表铺一层淡墨，湖心留下连续的空水。大桥的桌面横幅从黄鹤楼一侧看向两岸，钢桁与远处的鹦鹉洲悬索桥分出两层。手机竖幅从西岸向东看完整东湖，优先题写楚天台与行吟阁。

**江水与湖水。** 两张 640×512 水纹图记录距中泓的距离、沿程、岸带和水域类型。长江用淡赭灰，汉江用冷灰青，中流的成组墨纹随河道下行，近看可见更细的断笔，两种水色在交汇处逐渐混合。东湖用较慢的横纹表现湖风，岸线留浅。色调参考武汉两江交汇的水色差异。[武汉市发改委的两江交汇影像](https://fgw.wuhan.gov.cn/xwzx/fgyw/202001/t20200116_864116.html)

**江船与湖船。** 舱盖货船和载箱货船沿两座跨江桥的桥孔往返。两艘客渡分别在汉江和交汇区航行，东湖保留有篷、敞篷各一条游船。每艘船按自身吃水落位，尾流在船艉展开并随船速、船型取不同长度。航线和船速均按游览画面编排。Blender 工程保留同一时刻的船位和尾迹。选择船名可整船移动，展开后可单独编辑船壳、舱盖、舷窗和载荷。客渡的双层布局参考武汉普客轮渡。[武汉市交通运输局关于客渡尾部甲板的答复](https://jtj.wuhan.gov.cn/hdjl/lxxd/202602/t20260214_2730558.shtml)

**山** —— 形状取自 Copernicus GLO-30，每座山一块高程格子（相对平原的起伏）；
   峰值改用实测海拔，因为 DSM 含建筑，能抹净楼群的滤波会连山一起削掉六成。
   网格点之间作 Catmull-Rom 双三次插值，轮廓是圆的，不见格子。
   笔法仍是皴（顺坡放射的短笔，只在陡处见笔）、廓（法线与视线垂直处落墨）、
   山脚云气（下缘虚入纸中）。

**从建筑走到街上。** 听涛两桥的桥台接入同一段湖岸游径，省博北区沿主阶布置前庭和两翼步道，黄鹤楼两侧的登楼石阶顺山肩下降。行吟阁、晴川阁和江汉关在地理锚点附近按地图岸线调整了模型落位。北馆门前铺装、寺前街面和三镇街道均按游览视角概括。网页和全城 Blender 工程共享场地网格、街屋和树木的实际位置。[湖北省博物馆北馆介绍](https://hbww.org.cn/xwdt/p/10501.html)

**江岸与山脚**沿既有水线向陆侧收出驳岸、近水步道和草坡。台地边缘渐降到实测山坡，长江大桥两侧留出引道。树根落点与镜头离地高度都取自画面中实际绘制的地形三角面。

**植被**包含松、阔叶、柳、樱四种树型。山林成簇，滨水和街旁的树列留出开口。阵风依次掠过树冠，柳梢的回摆比松枝明显。东湖听涛的草叶和岸脚疏芦沿同一风向从根部向梢端逐渐弯起。树根取实际地表高度，树冠避让景点、建筑、车道和桥轴。Blender 使用网页同一份树型、叶色和位置，每株树都可独立选择。

**街区**从沿江商埠的低层屋脊，经公寓和裙房过渡到三个内陆楼群。七种街屋原型包括错高板楼和退台高层。武昌的两条街廊沿中北路至东湖路、武珞路至珞喻路的大致方向展开，沿路布置时聚时散的街屋与小树，分别接向省博和珞珈山。道路走向和楼群高度按地图尺度概括。[武汉市政府关于东湖路走向的答复](https://www.wuhan.gov.cn/hdjl/lxgs/202004/t20200416_1019850.shtml)

网页按镜头视野筛选树木和街屋实例，远景树木使用简化的树冠与主干，整城 Blender 工程保留完整布局。

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
