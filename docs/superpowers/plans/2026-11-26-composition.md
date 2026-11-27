# 构图：压低视角、远山与墨晕入场 实施计划

> **给执行者：** 逐任务执行，步骤用 `- [ ]` 勾选。每个任务先写测试、看它失败，再实现、看它通过，然后提交。
> 视觉参数（噪声、墨色、俯角）以截图为准微调，测试只约束结构和底线。

**目标：** 全城与入场镜头压低到能看见地平线；地平线上铺三层画布水墨远山，城外三维近岭加高作过渡；
天空做背景的景点带出远山；入场改为墨晕洇开。

**架构：** 远山是 `#river-sky` 与 `#stage` 之间的一个 DOM 层，三条山脊带在启动时用 2D 画布生成，
每帧由 `fitSunToSky` 按地平线高度与方位角定位。近岭仍是 `03-terrain.js` 里的三维椭球。
机位改 `VIEWS` 与 `viewFor` 的竖屏分支。入场用 CSS 遮罩动画。

**技术栈：** Three.js r128（全局 `THREE`）、原生 2D Canvas、CSS mask、Playwright（Chromium + WebKit）。

**设计：** `docs/superpowers/specs/2026-11-26-composition-design.md`。执行者两份都要读。

## 全局约束

- 单文件分发：不引入外部图片或新依赖；远山在运行时生成。
- 新源文件必须加进 `build.sh` 的拼接列表（顺序见任务 1），否则不会进 `dist/index.html`。
- 不往正式 HTML 里加诊断全局变量；测试需要的句柄只挂在 `?debug` 的 `window.__dbg` 上。
- 减少动态效果（`prefers-reduced-motion: reduce`）：墨晕直接显示终态，远山不做过渡。
- 街巷模式（`streetView` → 1）远山淡出。
- 帧率：1440×900 Chromium 基线约 33 fps，改后不得低于 30 fps。
- 不删、不放宽既有回归测试的约束；机位改了可以更新期望值，但要在提交信息里写明原因。
- 每次跑浏览器测试前先释放 8765 端口：`lsof -ti :8765 | xargs kill 2>/dev/null`。
- 中文注释，与现有代码风格一致；提交信息英文，末尾带 `Co-Authored-By` 行（见下）。
- 临时脚本和截图放系统临时目录，不放进仓库；不新建报告类文件。

提交信息末尾一律加：

```
Co-Authored-By: Codex gpt-6.2-astra <noreply@openai.com>
```

## 审查重点

1. 地平线刚好落在画框上沿附近时（`--sky-fit` 在 0–0.2 之间），远山不能「半截悬空」露出下沿，应整体淡出。
2. 窗口缩放（桌面 ↔ 竖屏）后远山与太阳立即按新尺寸重排，不残留旧位置。
3. 手动拖动绕城一整圈时，三层远山连续平移，没有跳变或接缝（山脊带要横向可平铺）。
4. 观画模式与图录打开时远山照常显示；街巷模式淡出后返回地图能恢复。
5. 初始化失败或重新加载（`#retry`）后，远山层不会叠出第二份。

第 1、3、5 条的测试放在任务 1，第 2 条放在任务 2，第 4 条放在任务 1。

---

### 任务 1：画布远山层

**文件：**
- 新建：`src/05-far-hills.js`
- 修改：`build.sh`（在 `src/05-overlays.js` 与 `src/05-runtime.js` 之间拼入 `src/05-far-hills.js`）
- 修改：`src/00-shell.html`（新元素与样式）
- 修改：`src/05-runtime.js`（创建实例；在 `fitSunToSky` 中调用 `update`；`__dbg` 暴露实例）
- 测试：新建 `tests/browser/far-hills.spec.cjs`

**接口：**
- 产出：`function createFarHills(element: HTMLElement): FarHills`，定义在 `src/05-far-hills.js`。
  - `FarHills.update({ horizonY: number, azimuth: number, fit: number, streetView: number, width: number, height: number }): void`
    - `horizonY`：地平线在视口中的 CSS 像素 y（与 `fitSunToSky` 里的同名量一致）
    - `azimuth`：`controls.getAzimuthalAngle()`（弧度）
    - `fit`：即 `--sky-fit`（0–1）
  - `FarHills.ridgeTopAt(x: number): number`：视口 CSS 像素 x 处，最高（最近）一层山脊线的视口 y；层隐藏时返回 `Infinity`。
  - `FarHills.dispose(): void`：撤销 blob URL。
- 产出：`window.__dbg.farHills`（仅 `?debug`）。

**结构：**
- `<div id="far-hills" aria-hidden="true">`，内含三个 `<div class="far-hill" data-layer="0|1|2">`；
  0 为最远。DOM 顺序：`#river-sky`、`#sun`、`#far-hills`、`#stage`。`z-index: 0`，`pointer-events: none`。
- 每层的 `background-image` 是启动时生成的山脊带 blob URL：宽 2400px、高 260px，**左右边缘可无缝平铺**
  （噪声按周期 2400 取样）。山脊线以上透明；山脊线以下由墨色向下渐隐到纸色 `#F2EFE6`，
  底部 40% 为不透明纸色云气。墨色：远层 `rgba(31,30,27,.10)` 到近层 `rgba(31,30,27,.26)` 量级，以截图为准。
- 定位：每层 `background-position-x` 由 `azimuth` 乘以层系数（0.35 / 0.6 / 1.0）换算为像素；
  `transform: translateY(...)` 让各层山脚贴在 `horizonY` 附近（近层略低）。
- 显隐：`opacity = smoothstep(.2, .6, fit) * (1 - streetView)`。`fit < .2` 时为 0。
- 生成在模块首次 `createFarHills` 时同步完成；`app.cleanups` 里调用 `dispose`，并在重新初始化时先清空容器子节点，避免叠层。

- [ ] **步骤 1：写失败的测试** `tests/browser/far-hills.spec.cjs`（用 `/?debug`，`reducedMotion: 'reduce'`）

```js
test('far hills show over a low horizon and hide in overhead views', ...)
  // 1440×900，点 #b-core 后人为把俯角设为 15°（照 visual-study 里 sun 测试的写法设 camera.position）：
  //   getComputedStyle(#far-hills).opacity > .5；__dbg.farHills.ridgeTopAt(720) 是有限数且 < innerHeight*.5
  // 俯角设为 55°：opacity === '0'；ridgeTopAt(720) === Infinity
  // 二分俯角找到 --sky-fit 约 0.1 的位置：opacity < .05（不得露出半截山）
test('far hills pan continuously through a full orbit', ...)
  // 俯角 15°，方位角每次加 10° 共 36 次，记录第 2 层 background-position-x 的像素值（取模 2400 前的连续量）；
  // 相邻两次差值的绝对值都 < 400，且同号
test('far hills fade in the riverside walk and return on leaving it', ...)
  // 打开图录 → 游两岸街巷：opacity 收敛到 0；Escape 退出：回到 core 后 opacity > .5（core 在任务 4 后才保证；
  // 本任务里先把俯角设回 15° 再断言）
test('far hills are built once even after a retry', ...)
  // 照 recovery.spec 的失败注入方式让首次初始化失败，点「重新加载」，就绪后 #far-hills .far-hill 计数 === 3
```

- [ ] **步骤 2：跑测试，确认失败**

运行：`npx playwright test tests/browser/far-hills.spec.cjs --project=chromium`
预期：4 项失败（`#far-hills` 不存在）。

- [ ] **步骤 3：实现** `createFarHills`、`build.sh` 拼接、`00-shell.html` 元素与样式、`05-runtime.js` 接线。

- [ ] **步骤 4：跑测试，确认通过**（两套浏览器）

运行：`npx playwright test tests/browser/far-hills.spec.cjs`
预期：8 passed。

- [ ] **步骤 5：截图自查** 1440×900 两江 15° 与全城 15°，看山脊是否可平铺无接缝、浓淡三层分明。

- [ ] **步骤 6：提交** `feat(scene): paint three far hill bands behind the map`

### 任务 2：朱砂日让过山脊

**文件：**
- 修改：`src/05-runtime.js` 的 `fitSunToSky`
- 修改：`src/00-shell.html` 的 `#sun`（如需新增自定义属性）
- 测试：`tests/browser/far-hills.spec.cjs`

**接口：**
- 消费：`FarHills.ridgeTopAt(x)`（任务 1）。

**规则：** 太阳圆盘下沿不得低于其水平中心处 `ridgeTopAt(cx) + 0.15 × 圆盘直径`。
超出时把太阳整体上移（改 `--sun-inset` 或等效量），不缩小、不隐藏。

- [ ] **步骤 1：写失败的测试**

```js
test('the cinnabar sun clears the far ridges', ...)
  // 视口 [1456,788]、[390,844]、[844,390] 各一次；点 #b-qc；
  // 采样同 visual-study 里 sun 测试的 [6,-30,130]、[11,70,580]、[14,-130,330]
  // 对 opacity > 0 的样本：sunRect.bottom <= ridgeTopAt(sunRect.x + sunRect.width/2) + .15*sunRect.height
test('resizing reflows the hills and sun at once', ...)
  // 1440×900 → 390×844，两帧后 ridgeTopAt(195) 与按新尺寸重新计算的值一致（重调 update 前后相等），
  // 且太阳规则仍成立
```

- [ ] **步骤 2：跑测试，确认失败**（至少有一个样本太阳压进山脊）

运行：`npx playwright test tests/browser/far-hills.spec.cjs -g "sun|resizing"`

- [ ] **步骤 3：实现**：在 `fitSunToSky` 末尾按规则上移太阳。

- [ ] **步骤 4：跑测试与既有太阳测试**

运行：`npx playwright test tests/browser/far-hills.spec.cjs tests/browser/visual-study.spec.cjs -g "sun|hills|resizing"`
预期：全部通过（既有的「the sun stays above the map horizon…」不得改动断言）。

- [ ] **步骤 5：提交** `feat(scene): lift the sun clear of the far ridges`

### 任务 3：三维近岭加高

**文件：**
- 修改：`src/03-terrain.js` 第 785 行起的远岭（「远山：层层淡出」）
- 修改：`src/01-core.js` 的 `inkMat` 只在需要新增「顶部淡到纸色」参数时改
- 测试：`tests/browser/far-hills.spec.cjs`

**数值：** 四层的 `h` 乘 2.75（48→132，68→187，54→149，76→209），`w` 乘 1.3；`z` 不变。
仍用 `riverClearance` 让开江面。顶部 30% 高度随高度向雾色（纸色）过渡，使山脊线融进画布远山的山脚云气。
东西两侧补层：先不补，任务 5 的环绕截图若显得缺口明显再补，并在提交信息说明。

- [ ] **步骤 1：写失败的测试**

```js
test('near ridges rise as a middle distance and stay out of the rivers', ...)
  // __dbg.scene 中 userData.landscapeSurface.group === '远山' 的网格：
  //   最高者包围盒高度 >= 180；
  //   对每个网格的每个顶点：若在长江或汉江河道内（用 __dbg.YZ / __dbg.HAN 的折线与宽度判断，
  //   或复用 riverClearance 的等价计算），其 y <= 0.5
```

- [ ] **步骤 2：跑测试，确认失败**（当前最高约 95）

- [ ] **步骤 3：实现** 加高、加宽与顶部淡出。

- [ ] **步骤 4：跑本测试与 visual-study 全文件**

运行：`npx playwright test tests/browser/far-hills.spec.cjs tests/browser/visual-study.spec.cjs`
预期：全部通过。

- [ ] **步骤 5：提交** `feat(scene): raise the near ridges into a middle distance`

### 任务 4：全城与两江压低视角

**文件：**
- 修改：`src/05-runtime.js` 的 `VIEWS.home`、`VIEWS.core` 与 `viewFor` 里 `W < H` 的 `home`、`core` 分支
- 测试：`tests/browser/far-hills.spec.cjs`；按需更新 `tests/browser/visual-study.spec.cjs`、`tests/browser/layout.spec.cjs` 的期望值

**数值（设计文档已定）：**
- 桌面全城：俯角约 16°，方位角不变（仍从南往北看，目标点 `{x:250, z:-130}` 附近），拉近到城市横向占满安全区；
  改用 `orbit(...)` 写法。
- 桌面两江：俯角约 18°（原 30°），其余参数不变，距离按截图调。
- 竖屏全城：约 22°（原 38°）；竖屏两江：约 20°（原 30°）。
- 地平线目标：桌面在画面上方 25%–32%，竖屏 20%–35%。

- [ ] **步骤 1：写失败的测试**

```js
// 地平线在视口中的比例：沿相机水平朝向取远点（相机高度不变、水平距离 1e5）投影，(1 - ndc.y) / 2。
for (const [w, h] of [[1440, 900], [1280, 720], [390, 844], [844, 390]])
  test(`home and core show the horizon in the upper sky at ${w}x${h}`, ...)
    // 分别点 #b-home、#b-core，等镜头停稳：.15 <= ratio <= .40；#far-hills opacity > .5
```

- [ ] **步骤 2：跑测试，确认失败**（现状地平线在画框以上，ratio < 0）

- [ ] **步骤 3：实现** 新机位，截图调距离，使三镇、两江交汇、东湖轮廓都可辨。

- [ ] **步骤 4：跑既有镜头测试**

运行：`npx playwright test tests/browser/far-hills.spec.cjs tests/browser/visual-study.spec.cjs tests/browser/layout.spec.cjs tests/browser/overlays.spec.cjs`
预期：全部通过。若「opens on the core city…」里黄鹤楼高度、「全城距离 > 两江 × 1.5」等期望因新机位失败，
先确认是机位合理变化而非取景错误，再更新数值，并在提交信息写明原值、新值与原因；约束本身不删。

- [ ] **步骤 5：提交** `feat(view): lower the city and confluence views to the horizon`

### 任务 5：景点机位复核

**文件：**
- 修改：`src/05-runtime.js` 的 `VIEWS` 与 `viewFor` 中的景点分支

**原则（设计文档）：**
- 天空或江面做背景的景点：`tower`、`qc`、`bridge`、`yingwuzhou`、`tv`、`customs` 可降俯角 3°–8°，
  让远山出现在建筑之后；
- 布局为主的景点：`lake`、`wuda`、`museum`、`guiyuan` 保持不变；
- 其余（`honglou`、`hongshan`、`qintai`、`watertower`、`chutian`、`xingyin`）看截图决定，倾向不动。
- 牌签允许压在远山上，不为避让改机位。

- [ ] **步骤 1：** 1440×900 与 390×844 下逐个景点截图（改前），保存到临时目录。
- [ ] **步骤 2：** 调整上列景点；每改一个重截一次对比。
- [ ] **步骤 3：跑既有取景测试**

运行：`npx playwright test tests/browser/layout.spec.cjs tests/browser/overlays.spec.cjs tests/browser/visual-study.spec.cjs`
预期：全部通过（「主体落在安全区」等约束不得放宽）。

- [ ] **步骤 4：** 绕全城环拍 8 个方位（每 45°，俯角 16°），判断近岭东西两侧是否需要补层；需要则在 `03-terrain.js` 补，复跑任务 3 的测试。
- [ ] **步骤 5：提交** `feat(view): let sky-backed landmarks stand before the far hills`

### 任务 6：墨晕入场

**文件：**
- 修改：`src/00-shell.html`（`#stage` 的入场动画、`#far-hills` 的淡入、减少动态效果分支）
- 测试：`tests/browser/far-hills.spec.cjs`

**规则：**
- `#stage` 入场用 `mask-image`：SVG 纤维噪声乘径向渐变，自定义属性 `--bloom`（用 `@property` 注册为 `<percentage>`）
  从 0% 动到 140%，时长 1.8s，`cubic-bezier(.2,.7,.2,1)`。
  WebKit 需同时写 `-webkit-mask-image`。动画结束后遮罩必须移除（`animation-fill-mode` 不保留遮罩，或 `animationend` 时清掉），不能常驻影响帧率。
- `#far-hills` 用 `inkFade` 1.2s，比 `#stage` 早 0.3s 开始。
- `window.__ready` 的时机不变，不等动画。
- 减少动态效果：两者都无动画，直接终态。

- [ ] **步骤 1：写失败的测试**

```js
test('the map blooms in from the centre and leaves no mask behind', ...)
  // 不设 reducedMotion：页面加载后立即读 getComputedStyle(#stage).animationName === 'inkBloom'；
  // 等 #stage 的 animationend 后：maskImage 与 webkitMaskImage 都为 'none'
test('reduced motion shows the finished map at once', ...)
  // reducedMotion: 'reduce'：#stage 的 animationName === 'none'，maskImage === 'none'
```

- [ ] **步骤 2：跑测试，确认失败**
- [ ] **步骤 3：实现**
- [ ] **步骤 4：跑本测试与 loading、recovery 两个文件**

运行：`npx playwright test tests/browser/far-hills.spec.cjs tests/browser/loading.spec.cjs tests/browser/recovery.spec.cjs`
预期：全部通过。

- [ ] **步骤 5：提交** `feat(entry): bloom the map in like ink on paper`

### 任务 7：收尾

- [ ] 帧率：1440×900 Chromium，两江镜头静置 2 秒数 `requestAnimationFrame`，≥ 30 fps。不达标先查远山层是否每帧重设了不变的样式。
- [ ] `npm test` 全部通过（构建 7 项 + 两套浏览器）。日志写到系统临时目录，不放进仓库。
- [ ] 截图：入场（动画中段与结束）、全城、两江、黄鹤楼、长江大桥、东湖、绕城 8 方位，桌面与竖屏各一套，存系统临时目录，最终回复里列出路径。
- [ ] 运行 `python3 ~/.codex/skills/tidy/scripts/audit.py .`，结果应与开工前一致（仅 `architecture.gen.js` 偏大与 `.claude/tidy.json` 旧位置两项）。
- [ ] README「目录」一节加 `05-far-hills.js` 一行；「浏览与无障碍」一节如入场描述有变则同步。
- [ ] 提交 `docs: note the far hills module`。不推送。
