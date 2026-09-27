  /* 紧凑布局只管理题跋与可用画幅；场景坐标和建筑模型保持不变。 */
  function createMapLayout(invalidate) {
    const media = window.matchMedia('(max-width: 640px), (max-height: 500px)');
    const poem = document.getElementById('poem'), text = document.getElementById('cardText');
    const poemButton = document.getElementById('poem-toggle'), detailsButton = document.getElementById('details-toggle');
    const elements = ['title', 'poem', 'sound', 'poem-toggle', 'dock'].map(id => document.getElementById(id));
    let panel = null;
    function updatePanels() {
      poem.hidden = media.matches && panel !== 'poem';
      text.hidden = media.matches && panel !== 'details';
      poemButton.setAttribute('aria-expanded', String(media.matches && panel === 'poem'));
      detailsButton.setAttribute('aria-expanded', String(media.matches && panel === 'details'));
      document.getElementById('hint').textContent = media.matches
        ? '单指旋转　双指缩放或平移　点击景点'
        : '拖拽旋转　滚轮缩放　点击景点';
      invalidate();
    }
    function toggle(name) {
      panel = panel === name ? null : name;
      updatePanels();
    }
    poemButton.addEventListener('click', () => toggle('poem'));
    detailsButton.addEventListener('click', () => toggle('details'));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !media.matches || !panel) return;
      const button = panel === 'poem' ? poemButton : detailsButton;
      panel = null; updatePanels(); button.focus({ preventScroll: true });
    });
    media.addEventListener('change', () => {
      panel = null;
      if (!media.matches && [poemButton, detailsButton].includes(document.activeElement)) {
        document.querySelector('#nav [aria-pressed="true"]').focus({ preventScroll: true });
      }
      updatePanels();
    });
    const observer = new ResizeObserver(invalidate);
    elements.forEach(el => {
      observer.observe(el);
      el.addEventListener('animationend', invalidate);
      el.addEventListener('animationcancel', invalidate);
    });
    if (document.fonts) {
      document.fonts.ready.then(invalidate);
      document.fonts.addEventListener('loadingdone', invalidate);
    }
    app.cleanups.push(() => observer.disconnect());
    updatePanels();
    return {
      get compact() { return media.matches; },
      measure(width, height) {
        const blocks = elements.filter(el => !el.hidden)
          .map(el => {
            const r = el.getBoundingClientRect();
            let top = r.top, bottom = r.bottom;
            // inkRise 只改变 transform，ResizeObserver 不会逐帧通知；预留完整的 14px 入场范围。
            if (['title', 'poem', 'dock'].includes(el.id) && el.getAnimations().some(a => a.playState === 'running')) {
              top = Math.min(top, el.offsetTop);
              bottom = Math.max(bottom, el.offsetTop + el.offsetHeight + 14);
            }
            return { id: el.id, rect: { left: r.left, right: r.right, top, bottom, width: r.width } };
          }).filter(b => b.rect.width > 0);
        let top = 0, bottom = height;
        if (media.matches) {
          blocks.forEach(({ id, rect }) => {
            if (id === 'dock') bottom = Math.min(bottom, rect.top - 8);
            else top = Math.max(top, rect.bottom + 8);
          });
        }
        return { blocks: blocks.map(b => b.rect), rect: { left: 16, top, right: width - 16, bottom: Math.max(top + 40, bottom) } };
      }
    };
  }

  // 在原观察方向上，将包围盒八角投影进可用画幅，四边各留 10%。
  function fittedView(base, bounds, rect, width, height, fov) {
    const back = new THREE.Vector3().copy(base.pos).sub(base.target).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
    const up = new THREE.Vector3().crossVectors(back, right);
    const target = bounds.getCenter(new THREE.Vector3());
    const tanY = Math.tan(fov * Math.PI / 360);
    const tanX = tanY * width / height * (rect.right - rect.left) / width * .8;
    const tanSafeY = tanY * (rect.bottom - rect.top) / height * .8;
    let distance = 22;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const v = new THREE.Vector3(x, y, z).sub(target);
      distance = Math.max(distance, v.dot(back) + Math.max(Math.abs(v.dot(right)) / tanX, Math.abs(v.dot(up)) / tanSafeY));
    }
    return { pos: target.clone().addScaledVector(back, distance + 1), target };
  }
