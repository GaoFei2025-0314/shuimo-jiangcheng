# 模型精度 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让城市底楼七种屋型和四处偏简的地标在近景里耐看，同时守住面数、体积与帧率。

**Architecture:** 所有建筑几何由 `tools/blender/*.py` 生成，在运行中的 Blender 5.2（Blender MCP，`127.0.0.1:9876`）里用 `execute_blender_code` 执行
`runpy.run_path("<项目绝对路径>/tools/blender/build.py", run_name="__main__")` 重建，产出 `src/architecture.gen.js` 与 `src/architecture-plates.gen.js`，再由 `build.sh` 内嵌。网页端只有晴川阁岸石一项可能需要改 `src/04-planting.js` 或 `src/03-terrain.js`。

**Tech Stack:** Blender 5.2 Python（bpy）、three.js r128、Playwright（Chromium + WebKit）、node:test。

**Spec:** `docs/superpowers/specs/2026-11-26-model-detail-design.md`

## Global Constraints

- 全场景三角形（就绪后 `scene.traverse`，实例化网格乘 `count`）≤ 1,500,000；现状约 1,190,000。
- 单个城市屋型的三角形 ≤ 改前的 3 倍。
- `src/architecture.gen.js` ≤ 6.5 MB（6,815,744 字节）；现状约 5.7 MB。
- 1440×900 Chromium 帧率较改前下降 ≤ 10%，用 `node /private/tmp/claude-501/-Users-gf--claude-spares-spare-tnKzZb/b1a8738f-204e-421a-924d-cd1342d2bd17/scratchpad/perf.cjs "$PWD" 8765`（服务器在 8765）改前改后各测两次取均值。
- 屋型原点、街面朝向（-Y）、占地不变；地标位置、占地、机位不变。
- 不改黄鹤楼、红楼、江汉关、武大、省博、行吟阁、楚天台、古琴台、电视塔、汉口水塔。
- 构件厚度或挑出 ≥ 0.25 单位，不做 < 0.15 单位的线脚。
- 临时脚本、日志、截图放 `/tmp/shuimo-models/`，不进仓库；`output/` 遵循现有 `.gitignore`。
- 不删除、不放宽现有测试；不推送。

## Review Focus

1. 全城（`home`）与两江（`core`）镜头：新增细部不得在远处形成灰色噪点或糊线。改前改后同机位截图对比。
2. 街巷模式（「游两岸街巷」八处近景）：屋型新构件不得与街道、相邻屋舍或江岸穿插。逐一截图。
3. 宝通禅寺台地上的殿宇必须贴合 `terrainTop`，不悬空、不埋入；用 `landmark-grounds.spec.cjs` 的同类断言覆盖。
4. 鹦鹉洲大桥改塔后，主缆仍从鞍座出发，吊杆与桥面接头不错位；`yingwuzhou` 近景与图录特写都检查。
5. 图录（`architecture-plates.gen.js`）里改动的地标渲染与网页模型一致。

---

### Task 1: 预算测试与改前基线

**Files:**
- Create: `tests/browser/model-budget.spec.cjs`
- Modify: `tests/build.test.cjs`

- [ ] **Step 1:** 在 `tests/browser/model-budget.spec.cjs` 写 `scene stays within the triangle budget`：就绪后经 fixtures 的 `__testScene` 统计三角形，断言 `≤ 1_500_000`；同文件写 `each city house type stays within three times its baseline`，基线值按改前实测写死（lane、apartment、arcade、highrise、slab_tower、terrace_tower、wharf 单栋面数）。
- [ ] **Step 2:** 在 `tests/build.test.cjs` 加 `architecture data stays under 6.5 MB`：`fs.statSync('src/architecture.gen.js').size <= 6815744`。
- [ ] **Step 3:** 运行 `npx playwright test tests/browser/model-budget.spec.cjs` 与 `node --test tests/build.test.cjs`，Expected：在改前代码上全部 PASS（这是守护测试，不是红测）。
- [ ] **Step 4:** 改前基线：帧率两次、全场景面数，以及截图（默认机位与 0.42 倍拉近）：tower、bridge、customs、watertower、hongshan、guiyuan、qc、yingwuzhou，加 home、core 与八处街巷近景。存 `/tmp/shuimo-models/before/`。
- [ ] **Step 5:** Commit `test(models): pin the triangle and payload budgets`。

### Task 2: 城市底楼七种屋型

**Files:** Modify `tools/blender/neighborhood.py`（必要时 `tools/blender/city.py`）；重建 `src/architecture.gen.js`、`src/architecture-plates.gen.js`。

- [ ] **Step 1:** 按设计第 1 节逐个屋型加构件（apartment：女儿墙压顶、楼梯间、水箱、阳台或空调板、入口雨棚；lane：门罩、檐口线脚、烟囱；arcade：檐口与腰线、柱廊进深、屋顶栏杆；highrise / slab_tower / terrace_tower：裙楼分段、顶部机房、竖向线条；wharf：屋架雨棚、系缆桩）。只用现有材质槽。
- [ ] **Step 2:** 经 Blender MCP 重建，`npm run build`。
- [ ] **Step 3:** 运行 `npx playwright test tests/browser/model-budget.spec.cjs tests/browser/landmark-grounds.spec.cjs` 与 `node --test tests/build.test.cjs`，Expected：PASS。
- [ ] **Step 4:** 截图对比 home、core、八处街巷与 tower、customs、watertower 近景；远处无新噪点、街巷无穿插。
- [ ] **Step 5:** Commit `feat(city): give the house types cornices, rooftops and street fronts`。

### Task 3: 鹦鹉洲长江大桥

**Files:** Modify `tools/blender/suspension.py`（`towers()`、`deck()`，主缆起点随鞍座调整 `cables()`）。

- [ ] **Step 1:** 桥塔两肢收分、上下横梁、塔顶鞍座罩；加劲梁有梁高、风嘴、检修道与栏杆。塔形对照公开照片，来源写进提交说明。
- [ ] **Step 2:** 重建、构建，跑 Task 2 Step 3 的测试，Expected：PASS。
- [ ] **Step 3:** 截图 yingwuzhou、bridge 两机位与图录鹦鹉洲特写，检查主缆—鞍座、吊杆—桥面接头。
- [ ] **Step 4:** Commit `feat(yingwuzhou): taper the towers and give the deck a real girder`。

### Task 4: 归元禅寺

**Files:** Modify `tools/blender/gardens.py` 的 `guiyuan()`。

- [ ] **Step 1:** 罗汉堂田字形平面、四个天井、坡屋顶；大雄宝殿前月台与香炉；中轴后部二层藏经阁；补山门。院墙与占地不变。
- [ ] **Step 2:** 重建、构建、测试，Expected：PASS。截图 guiyuan 两机位。
- [ ] **Step 3:** Commit `feat(guiyuan): lay out the arhat hall and sutra pavilion`。

### Task 5: 洪山宝塔 · 宝通禅寺

**Files:** Modify `tools/blender/gardens.py` 的 `hongshan()`、`octagonal_tier()`；`tests/browser/landmark-grounds.spec.cjs`。

- [ ] **Step 1:** 在 `landmark-grounds.spec.cjs` 写 `Baotong halls sit on their hillside terraces`：每进殿宇台基底面与该点 `terrainTop` 的高差在 ±0.6 单位内。运行，Expected：FAIL（殿宇尚不存在）。
- [ ] **Step 2:** 宝塔每级加腰檐与平座、塔顶塔刹；宝通禅寺沿南坡中轴三至四进（山门、大雄宝殿、祖堂、方丈），每进一层台地、石阶相连。
- [ ] **Step 3:** 重建、构建，Step 1 的测试与预算测试 PASS。截图 hongshan 两机位。
- [ ] **Step 4:** Commit `feat(hongshan): add the pagoda eaves and terrace the Baotong halls`。

### Task 6: 禹功矶岸石

**Files:** 先定位：`tools/blender/gardens.py` 的 `qc()`、`src/04-planting.js`（低矮散石）或 `src/03-terrain.js`（`uQuaySpurs`）。

- [ ] **Step 1:** 确认 qc 近景里粗糙岩块的来源，在原生成处改为水平层理、边缘倒圆、岩脚入水的叠石；范围不扩大。若改的是网页端，同一改动不得影响其他江岸石。
- [ ] **Step 2:** 构建、测试，Expected：PASS。截图 qc 两机位与 tower 机位江岸。
- [ ] **Step 3:** Commit `feat(qc): layer the Yugong rocks`。

### Task 7: 收尾

- [ ] **Step 1:** 改后帧率两次，与基线比较，下降 ≤ 10%；记录全场景面数与 `architecture.gen.js` 字节数。
- [ ] **Step 2:** 更新 README「Blender 建模与渲染」与相关景点描述中已不准确的句子。
- [ ] **Step 3:** 完整 `npm test`，Expected：全部 PASS（已知偶发：WebKit 黄鹤楼静止帧计数、Chromium 远山全周环绕超时，若出现须单独复跑通过）。
- [ ] **Step 4:** 改后截图存 `/tmp/shuimo-models/after/`，与 before 同名同机位。
- [ ] **Step 5:** Commit `docs: describe the refined house types and landmarks`。
