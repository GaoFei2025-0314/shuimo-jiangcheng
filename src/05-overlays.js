  // 屏幕排版独立于场景动画：只有镜头、焦点或界面变化时才重新投影。
  function createMapOverlays(camera, controls, onSelect, buttons) {
    const labelBox = document.getElementById('labels');
    // 汉水题记落在实测河心上：取 GEO.hanshui 中离该经度最近的一点，数据重生成后也跟着走
    const hanLabel = lon => GEO.hanshui.reduce((a, p) => Math.abs(p[0] - lon) < Math.abs(a[0] - lon) ? p : a).slice(0, 2);
    const LABELS = [
      ['汉口', 114.2820, 30.5990, 'town', 26],
      ['汉阳', 114.2610, 30.5430, 'town', 18],
      ['武昌', 114.3220, 30.5330, 'town', 20],
      ['长江', 114.2905, 30.5700, 'water', 4],
      ['汉水', ...hanLabel(114.2470), 'water', 4],
      ['东湖', 114.3880, 30.5605, 'water', 4],
      ['南岸嘴', 114.2838, 30.5628, 'hill', 8],
      ['蛇山', 114.3085, 30.5458, 'hill', 26],
      ['龟山', 114.2700, 30.5562, 'hill', 30],
      ['珞珈山', 114.3655, 30.5372, 'hill', 28],
      ['磨山', 114.4174, 30.5524, 'hill', 30]
    ].map(L => {
      const el = document.createElement('b'); el.className = L[3]; el.textContent = L[0];
      labelBox.appendChild(el);
      const p = geo(L[1], L[2]);
      const h = HILL[L[0]];                               // 山名题在该山最高处之上 7 个单位，随实测山高
      const y = L[3] === 'hill' ? (h ? LAND_Y + h.f.a.reduce((m, v) => Math.max(m, v), 0) : terrainTop(p.x, p.z)) + 7 : L[4];
      return { el, v: new THREE.Vector3(p.x, y, p.z), kind: L[3] };
    });
    /* 地标竖牌 */
    const markBox = document.getElementById('marks');
    // 竖牌挂在模型包围盒顶上 5 个单位——山高改自实测后，写死的高度会插进楼里。
    // 一级七处全城可见；二级七处只在推近后浮现，免得全城视角挤成一片
    const FAR = { 1: [1500, 2100], 2: [650, 950] };
    const MARKS = [
      ['黄鹤楼', 'tower', tower, 1], ['长江大桥', 'bridge', bridge, 1], ['晴川阁', 'qc', qc, 1], ['龟山电视塔', 'tv', tv, 1],
      ['江汉关', 'customs', customs, 1], ['武大樱园', 'wuda', wuda, 1], ['楚天台', 'chutian', chutian, 1],
      ['洪山宝塔', 'hongshan', hongshan, 2], ['汉口水塔', 'watertower', watertower, 2], ['省博物馆', 'museum', museum, 2],
      ['红楼', 'honglou', honglou, 2], ['鹦鹉洲大桥', 'yingwuzhou', yingwuzhou, 2], ['归元寺', 'guiyuan', guiyuan, 2], ['古琴台', 'qintai', qintai, 2]
    ].map(m => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'mark'; el.setAttribute('aria-label', '移至' + m[0]);
      el.innerHTML = '<span class="plate">' + [...m[0]].map(c => '<i>' + c + '</i>').join('') + '</span>'
                   + '<span class="stem"></span><span class="dot"></span>';
      el.addEventListener('click', () => onSelect(m[1]));
      markBox.appendChild(el);
      const top = new THREE.Box3().setFromObject(m[2]).max.y;
      return { el, key: m[1], tier: m[3], v: new THREE.Vector3(m[2].position.x, top + 5, m[2].position.z) };
    });
    let entering = true;
    function setMarkVisibility(mark, visible, opacity) {
      const interactive = visible && !entering;
      if (!interactive && document.activeElement === mark.el) {
        const key = mark.key === 'chutian' ? 'lake' : mark.key;
        const button = buttons.find(b => b.dataset.view === key);
        if (button) {
          button.focus({ preventScroll: true });
          button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
      mark.el.disabled = !interactive;
      mark.el.tabIndex = interactive ? 0 : -1;
      mark.el.setAttribute('aria-hidden', String(!interactive));
      mark.el.style.visibility = visible ? 'visible' : 'hidden';
      mark.el.style.opacity = visible ? opacity.toFixed(3) : '0';
      mark.el.style.pointerEvents = interactive ? 'auto' : 'none';
    }
    const RANGE = { town: [340, 3200], water: [140, 2800], hill: [70, 1000] };
    const projV = new THREE.Vector3();
    const gap = 8;
    const collides = (a, b) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
    const within = (r, w, h) => r.left >= gap && r.right <= w - gap && r.top >= gap && r.bottom <= h - gap;
    function screenRect(item, centered) {
      projV.copy(item.v).project(camera);
      const x = Math.round((projV.x * .5 + .5) * viewportWidth * 10) / 10;
      const y = Math.round((-projV.y * .5 + .5) * viewportHeight * 10) / 10;
      return { x, y, left: x - item.width / 2, right: x + item.width / 2,
        top: y - item.height * (centered ? .5 : 1), bottom: y + (centered ? item.height / 2 : 0),
        inDepth: projV.z >= -1 && projV.z <= 1 };
    }
    function drawMarks(w, h, activeView, blocks, farScale) {
      const placed = [];
      const focused = MARKS.find(m => m.el === document.activeElement);
      const ordered = focused ? [focused, ...MARKS.filter(m => m !== focused)] : MARKS;
      ordered.forEach(m => {
        const r = screenRect(m, false), d = camera.position.distanceTo(m.v), far = FAR[m.tier];
        // 远端按层级淡出，再随紧凑取景拉远的全城距离等比放宽，两级之比不变：全城视角下二级牌仍隐去
        const o = THREE.MathUtils.smoothstep(d, 90, 170) * (1 - THREE.MathUtils.smoothstep(d, far[0] * farScale, far[1] * farScale));
        const visible = o > .35 && m.key !== activeView && r.inDepth && within(r, w, h)
          && ![...blocks, ...placed].some(block => collides(r, block));
        setMarkVisibility(m, visible, o);
        if (!visible) return;
        m.el.style.transform = `translate(-50%,-100%) translate(${r.x}px,${r.y}px)`;
        placed.push(r);
      });
      return placed;
    }
    function drawLabels(w, h, marks, blocks) {
      LABELS.forEach(L => {
        const r = screenRect(L, true), d = camera.position.distanceTo(L.v), range = RANGE[L.kind];
        const o = THREE.MathUtils.smoothstep(d, range[0] * .55, range[0]) * (1 - THREE.MathUtils.smoothstep(d, range[1], range[1] * 1.35));
        const visible = o > .01 && L.width > 0 && r.inDepth && within(r, w, h)
          && ![...marks, ...blocks].some(block => collides(r, block));
        L.el.style.visibility = visible ? 'visible' : 'hidden';
        L.el.style.opacity = visible ? o.toFixed(3) : '0';
        if (visible) L.el.style.transform = `translate(-50%,-50%) translate(${r.x}px,${r.y}px)`;
      });
    }

    /* 罗盘与比例尺 */
    const dial = document.querySelector('#rose .dial'), sBar = document.getElementById('scaleBar'), sTxt = document.getElementById('scaleText');
    const NICE = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    function drawTools(h) {
      const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) * 180 / Math.PI;
      dial.setAttribute('transform', `rotate(${az.toFixed(1)} 26 26)`);
      const dist = camera.position.distanceTo(controls.target);
      const mPerPx = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / h * MPU;
      let m = NICE[0];
      for (const n of NICE) { m = n; if (n / mPerPx >= 64) break; }
      sBar.style.width = Math.min(190, Math.round(m / mPerPx)) + 'px';
      sTxt.textContent = m >= 1000 ? (m / 1000) + ' 公里' : m + ' 米';
    }

    let sizesDirty = true, dirty = true, viewportWidth = 0, viewportHeight = 0, lastView, lastFocus;
    const lastWorld = new THREE.Matrix4(), lastProjection = new THREE.Matrix4();
    // OrbitControls 的球坐标往返可能产生极小的浮点误差，不应触发重新排版。
    const sameMatrix = (a, b) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-10);
    function invalidate() { sizesDirty = true; dirty = true; }
    markBox.addEventListener('animationend', invalidate);
    markBox.addEventListener('animationcancel', invalidate);
    const observer = new ResizeObserver(invalidate);
    [...MARKS, ...LABELS].forEach(item => observer.observe(item.el));
    app.cleanups.push(() => observer.disconnect());
    return {
      marks: MARKS, labels: LABELS,                        // 只供 ?debug 核对，运行时不经此读写
      invalidate,
      draw(w, h, activeView, blocks, farScale) {
        const focus = document.activeElement;
        if (!dirty && lastView === activeView && lastFocus === focus && sameMatrix(lastWorld, camera.matrixWorld) && sameMatrix(lastProjection, camera.projectionMatrix)) return;
        entering = markBox.getAnimations().some(a => a.playState === 'running');
        viewportWidth = w; viewportHeight = h;
        if (sizesDirty) {
          [...MARKS, ...LABELS].forEach(item => {
            // 尺寸读取集中在写入之前；visibility:hidden 的牌签仍可测量。
            const r = item.el.getBoundingClientRect();
            item.width = r.width; item.height = r.height;
          });
          sizesDirty = false;
        }
        const marks = drawMarks(w, h, activeView, blocks, farScale);
        drawLabels(w, h, marks, blocks); drawTools(h);
        lastView = activeView; lastFocus = focus;
        lastWorld.copy(camera.matrixWorld); lastProjection.copy(camera.projectionMatrix);
        dirty = false;
      }
    };
  }
