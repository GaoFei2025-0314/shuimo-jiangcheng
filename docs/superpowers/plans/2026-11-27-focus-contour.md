# 外圈描线随淡 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后期描线按离当前景点的水平距离变淡变细，与城市楼面的「配景虚写」一致。

**Architecture:** `inkPrint()` 的后期材质引用 `cityFocus` uniform，加相机逆矩阵从深度还原世界 xz，按同一半径与噪声计算 `focusWash`，减弱 `contour`（与可选的 `nib`）。

**Tech Stack:** three.js r128 ShaderMaterial、Playwright（Chromium + WebKit）。

**Spec:** `docs/superpowers/specs/2026-11-27-focus-contour-design.md`

## Global Constraints

- 只改 `src/05-runtime.js`（必要时 `src/01-core.js` 导出噪声函数文本）与测试；不改模型、机位、界面、楼面淡化参数。
- 全城（home）、两江（core）、八处街巷画面与现状基本一致。
- 帧率（1440×900 Chromium，`node /private/tmp/claude-501/-Users-gf--claude-spares-spare-tnKzZb/b1a8738f-204e-421a-924d-cd1342d2bd17/scratchpad/perf.cjs "$PWD" 8765`，改前改后各两次）下降 ≤ 5%。
- 不删不放宽测试；临时文件放 `/tmp/shuimo-contour/`；不推送。

## Review Focus

1. 深度还原的世界坐标要准：焦点处描线不能被误淡（用拉近与竖屏机位核对）。
2. 描线过渡边界与楼面过渡边界重合，不出现两道圈。
3. 拖动平移、缩放时描线淡化跟随，不闪烁。
4. 多重采样目标切换（`makeTarget`）后 uniform 仍正确。
5. 无深度纹理分支（无 `CONTOUR`）编译通过、行为不变。

---

### Task 1: 后期描线随焦点淡化

**Files:** Modify `src/05-runtime.js`；Test `tests/browser/visual-study.spec.cjs`

- [ ] **Step 1:** 写测试 `ink contours fade with the city focus`：在 hongshan 机位就绪后，经可测入口（如 `window.__testInkPrint` 或场景可查对象）读后期材质 uniform，断言焦点值与 `cityFocus` 一致、强度 > 0；街巷模式下强度为 0。运行，Expected：FAIL。
- [ ] **Step 2:** 实现：后期材质加焦点 uniform 与相机逆矩阵，`CONTOUR` 分支还原世界 xz，按与楼面相同公式算 `focusWash`，减弱外圈 `contour`。运行 Step 1 测试，Expected：PASS。
- [ ] **Step 3:** 截图改前改后左右对比存 `/tmp/shuimo-contour/pairs/`，调外圈描线强度下限与线宽，直到外圈读作淡墨白描、楼形仍可辨、无圆环、内圈与远景不变。
- [ ] **Step 4:** 运行 `npx playwright test tests/browser/visual-study.spec.cjs`，Expected：PASS。
- [ ] **Step 5:** Commit `feat(ink): fade backdrop contours away from the landmark`。

### Task 2: 收尾

- [ ] **Step 1:** 帧率两次，下降 ≤ 5%。
- [ ] **Step 2:** README 中描述描线或配景淡化的句子若已不准确，更新。
- [ ] **Step 3:** 完整 `npm test`，Expected：全部 PASS（已知偶发：WebKit「reduced motion switches instantly…」、Chromium「far hills pan continuously…」、Chromium 图录解码，出现须单独复跑通过）。
- [ ] **Step 4:** `python3 ~/.codex/skills/tidy/scripts/audit.py .`，处理本轮引入的问题。
- [ ] **Step 5:** Commit `docs: describe the backdrop contour fade`（若无文档改动可省）。
