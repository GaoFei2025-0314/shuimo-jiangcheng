# 树与屋型去重复 设计

日期：2026-11-27

## 为什么做

两轮「配景虚写」之后整体审美约 9.4 分。近景里最显「模型感」的是重复：
城里 7 种屋型、5 种树，每种只有一个原型，整城复制几百次，只变朝向与缩放。
拉近后同一栋楼、同一棵树一排排出现，一眼看出是复制的。目标是让近景读作「画出来的街巷与林木」，而不是「阵列」。

## 现状

- **屋型**：`tools/blender/neighborhood.py` 的 lane、arcade、wharf、apartment、highrise、terrace_tower、slab_tower，
  经 `tools/blender/build.py` 编进 `src/architecture.gen.js`。`src/04-scene.js` 的 `buildCityBlocks()` 按 `lots[kind]` 收矩阵，
  每种屋型、每种材质一个 `InstancedMesh`，名为 `City / <kind>`。arcade 在模型精度一轮没有返工。
- **树**：`src/04-planting.js` 的 `treeTypes`（pine、broadleaf、willow、cherry 等）由 JS 程序化生成，
  每种三级细节：`assets`（近）、`midAssets`、`farAssets`，带顶点色、`crownCenter`、`leafCenter`、`windResponse` 等属性，
  另有 `paperSprigs`（纸花小枝锚点）。每种每部件（wood、foliage）一个 `InstancedMesh`，名为 `Vegetation / <species> / <part>`。

## 用户选定

- 每种屋型、每种树都做多个变体，摆放时按位置挑选。
- **屋型和树都在 Blender 里建模**，由 Codex 经 Blender MCP 修改 `tools/blender/` 并重建。

## 目标

1. 近景里相邻的楼、相邻的树轮廓明显不同：同屏不再出现一眼可辨的「同一个模型」排队。
2. 墨色风格不变：树仍是现有的「叶簇点染 + 枯笔枝」画法，楼仍是现有的墙瓦窗格画法；变体是同一画家笔下的不同样子，不是写实 CG。
3. 远景（全城、两江）的城市肌理与树林观感基本不变。

## 非目标

- 不改机位、构图、界面、地标模型。
- 不改树和楼的摆放位置与数量（只改每个位置用哪个变体）。
- 宝通禅寺布局另立一轮。

## 反目标（做到了也算失败）

- 树搬进 Blender 后失去现有的墨色叶簇质感、风动、三级细节或纸花小枝。
- 变体差异过大，街区读成杂乱；或变体太像，看不出区别。
- 帧率下降超过 5%；全场三角面超过 1,500,000；`dist/index.html` 超过 12 MB（现约 9.6 MB）。
- 现有测试被删除或放宽。

## 设计

### 屋型变体（Blender）

- 数量：lane、arcade、apartment 各 3 个变体（含现有一个）；wharf、highrise、terrace_tower、slab_tower 各 2 个。
- 变化放在轮廓上：屋顶形式（坡顶 / 平顶 / 山墙）、开间数、退台、檐口与阳台位置、屋顶小构件。
  arcade 本轮一起返工到与其他屋型一致的精度（凹窗、檐口、女儿墙等）。
- 每个变体的面数不超过其屋型基线的 3 倍（`tests/browser/model-budget.spec.cjs` 的基线，变体沿用所属屋型的基线）。
- 摆放：`buildLot` 时按地块位置的确定性哈希选变体，并避免与已摆放的相邻地块（同一或相邻网格）选同一变体。
- 命名：保持 `City / <kind>` 前缀语义可用（现有测试与 `src/05-runtime.js` 依赖它），具体命名由实现者定，须让现有测试不改含义地继续成立。

### 树变体（Blender）

- 新建 `tools/blender/trees.py`，每个树种 3 个变体：第一个复刻现有树形（作为对照），另两个改变主干倾斜、分枝数与走向、树冠偏向、高宽比。
- 每个变体输出三级细节（近 / 中 / 远）和 wood、foliage 两部件，并输出 JS 端现在需要的全部属性
  （顶点色、`crownCenter`、`leafCenter` 及其它实测用到的属性）与 `paperSprigs` 锚点；`windResponse` 可继续在 JS 端按树种填。
- 编码进新的生成文件（如 `src/vegetation.gen.js`），`build.sh` 一并打包；`src/04-planting.js` 改为从生成数据建原型，删除被替代的程序化生成代码。
- 摆放：`plant()` 按位置哈希选变体，同一树种相邻的树尽量不同变体。
- 先做「复刻」：只用第一个变体替换现有 JS 树，截图与改前几乎一致后，再加另两个变体。

## 测试与验收

- 新增浏览器测试：
  - 每种屋型场景中至少出现其全部变体；相邻地块（中心距 < 某值，实测定）同变体比例低于某阈值。
  - 每个树种至少出现 3 个变体；三级细节与 `paperSprigs` 仍存在。
- `model-budget.spec.cjs`：扩展基线覆盖新变体（不放宽现有数值）；总面数 ≤ 1,500,000 不变。
- 截图对照：16 个景点默认与 0.42 倍拉近、home、core、八处街巷近景；另加「同屏重复」检查机位（如黄鹤楼下里分、汉口里分、东湖林带）。
- 完整 `npm test` 通过；帧率按 `perf.cjs` 同法实测，下降 ≤ 5%。

## 交给实现者决定

- 每个变体的具体造型、哈希与邻接规则、生成文件的编码格式。
- 是否需要对树叶片数做适度削减来守住面数与文件体积预算。
