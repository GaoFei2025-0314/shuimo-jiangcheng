  // 屏幕排版独立于场景动画：只有镜头、焦点或界面变化时才重新投影。
  function createMapOverlays(camera, controls, onSelect, buttons) {
    const wudaAt = geo(114.3625, 30.5397);
    const labelBox = document.getElementById('labels');
    const LABELS = [
      ['汉口', 114.2820, 30.5990, 'town', 26],
      ['汉阳', 114.2610, 30.5430, 'town', 18],
      ['武昌', 114.3220, 30.5330, 'town', 20],
      ['长江', 114.2905, 30.5700, 'water', 4],
      ['汉水', 114.2470, 30.5868, 'water', 4],
      ['东湖', 114.3880, 30.5605, 'water', 4],
      ['南岸嘴', 114.2838, 30.5628, 'hill', 8],
      ['蛇山', 114.3085, 30.5458, 'hill', 26],
      ['龟山', 114.2700, 30.5562, 'hill', 30],
      ['珞珈山', 114.3655, 30.5372, 'hill', 28],
      ['磨山', 114.4062, 30.5395, 'hill', 30]
    ].map(L => {
      const el = document.createElement('b'); el.className = L[3]; el.textContent = L[0];
      labelBox.appendChild(el);
      const p = geo(L[1], L[2]);
      return { el, v: new THREE.Vector3(p.x, L[4], p.z), kind: L[3] };
    });
    /* 地标竖牌 */
    const markBox = document.getElementById('marks');
    const MARKS = [
      ['黄鹤楼', 'tower', AT.tower, 52], ['长江大桥', 'bridge', AT.bridge, 28],
      ['晴川阁', 'qc', AT.qc, 22], ['龟山电视塔', 'tv', AT.tv, 168],
      ['江汉关', 'customs', AT.customs, 48], ['武大樱园', 'wuda', wudaAt, 32],
      ['楚天台', 'chutian', AT.chutian, 62]
    ].map(m => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'mark'; el.setAttribute('aria-label', '移至' + m[0]);
      el.innerHTML = '<span class="plate">' + [...m[0]].map(c => '<i>' + c + '</i>').join('') + '</span>'
                   + '<span class="stem"></span><span class="dot"></span>';
      el.addEventListener('click', () => onSelect(m[1]));
      markBox.appendChild(el);
      return { el, key: m[1], v: new THREE.Vector3(m[2].x, m[3], m[2].z) };
    });
    function setMarkVisibility(mark, visible, opacity) {
      if (!visible && document.activeElement === mark.el) {
        const key = mark.key === 'chutian' ? 'lake' : mark.key;
        const button = buttons.find(b => b.dataset.view === key);
        if (button) {
          button.focus({ preventScroll: true });
          button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
      mark.el.disabled = !visible;
      mark.el.tabIndex = visible ? 0 : -1;
      mark.el.setAttribute('aria-hidden', String(!visible));
      mark.el.style.visibility = visible ? 'visible' : 'hidden';
      mark.el.style.opacity = visible ? opacity.toFixed(3) : '0';
      mark.el.style.pointerEvents = visible ? 'auto' : 'none';
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
        const r = screenRect(m, false), d = camera.position.distanceTo(m.v);
        const o = THREE.MathUtils.smoothstep(d, 90, 170) * (1 - THREE.MathUtils.smoothstep(d, 1500 * farScale, 2100 * farScale));
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
    const observer = new ResizeObserver(invalidate);
    [...MARKS, ...LABELS].forEach(item => observer.observe(item.el));
    app.cleanups.push(() => observer.disconnect());
    return {
      invalidate,
      draw(w, h, activeView, blocks, farScale) {
        const focus = document.activeElement;
        if (!dirty && lastView === activeView && lastFocus === focus && sameMatrix(lastWorld, camera.matrixWorld) && sameMatrix(lastProjection, camera.projectionMatrix)) return;
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
