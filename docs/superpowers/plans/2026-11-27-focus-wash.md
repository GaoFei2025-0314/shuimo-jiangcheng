# 配景虚写 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 城市楼群按离当前景点（`controls.target`）的水平距离淡入纸色，主角附近实写、外圈虚写。

**Architecture:** 在城市材质上加共享 uniform `uFocus`、`uFocusRange`（`src/02-landmarks.js`），着色器在 `src/01-core.js` 的 `ARCHITECTURE_WASH` 分支里与现有距离淡化合并，半径在 `src/05-runtime.js` 与雾参数一起逐帧更新。

**Tech Stack:** three.js r128 ShaderMaterial、Playwright（Chromium + WebKit）、node:test。

**Spec:** `docs/superpowers/specs/2026-11-27-focus-wash-design.md`

## Global Constraints

- 只改 `src/01-core.js`、`src/02-landmarks.js`、`src/05-runtime.js` 与测试；不改模型、机位、界面。
- 全城（home）、两江（core）画面与现状基本一致；街巷模式关闭淡化。
- 帧率（1440×900 Chromium，`node /private/tmp/claude-501/-Users-gf--claude-spares-spare-tnKzZb/b1a8738f-204e-421a-924d-cd1342d2bd17/scratchpad/perf.cjs "$PWD" 8765`，改前改后各两次）下降 ≤ 5%。
- 不删不放宽测试；临时文件放 `/tmp/shuimo-focus/`；不推送。

## Review Focus

1. 主角紧邻的街区不能被洗白（内半径下限）。
2. 淡化边界不能出现圆环或硬边。
3. 拖动平移时焦点跟随，画面不跳。
4. 竖屏机位同样成立。
5. 图录（atlas）渲染不受影响。

---

### Task 1: 焦点 uniform 与测试

**Files:** Modify `src/02-landmarks.js`、`src/05-runtime.js`；Test `tests/browser/visual-study.spec.cjs`（或新建 `tests/browser/focus-wash.spec.cjs`）

- [ ] **Step 1:** 写测试 `city wash centres on the active landmark`：经 `__testScene` 找到城市材质（`uniforms.uFocus` 存在），在 tower、hongshan、guiyuan 机位就绪后断言 `uFocus` 与 `__testControls.target` 的 xz 差 < 0.5、`uFocusRange.y` 小于上限（按实测定，写死）；在 home、core 机位断言 `uFocusRange.x` 大于城区半径（按建筑落点实测定，写死）；街巷模式下断言淡化关闭（实现可选：半径置极大或强度 uniform 为 0）。运行，Expected：FAIL。
- [ ] **Step 2:** 实现 uniform 创建与逐帧更新。运行 Step 1 测试，Expected：PASS。
- [ ] **Step 3:** Commit `feat(city): track the active landmark as the wash focus`。

### Task 2: 着色器淡化与调参

**Files:** Modify `src/01-core.js`

- [ ] **Step 1:** 在 `ARCHITECTURE_WASH` 分支加 `focusWash`，与现有淡化合并，噪声扰动边界，外圈减弱窗格与近景细部。
- [ ] **Step 2:** 截图：16 个景点默认与 0.42 倍拉近、home、core、八处街巷，改前改后拼左右对比，存 `/tmp/shuimo-focus/pairs/`。调系数直到：主角周围有明显留白层次、紧邻街区仍实、无圆环、远景与街巷不变。
- [ ] **Step 3:** 运行 Task 1 测试与 `npx playwright test tests/browser/visual-study.spec.cjs`，Expected：PASS。
- [ ] **Step 4:** Commit `feat(city): wash the backdrop toward paper away from the landmark`。

### Task 3: 收尾

- [ ] **Step 1:** 帧率两次，下降 ≤ 5%。
- [ ] **Step 2:** README 中描述城市墨色的句子若已不准确，更新。
- [ ] **Step 3:** 完整 `npm test`，Expected：全部 PASS（已知偶发：WebKit「reduced motion switches instantly…」、Chromium「far hills pan continuously…」，出现须单独复跑通过）。
- [ ] **Step 4:** `python3 ~/.codex/skills/tidy/scripts/audit.py .`，处理本轮引入的问题。
- [ ] **Step 5:** Commit `docs: describe the focus wash`（若无文档改动可省）。
