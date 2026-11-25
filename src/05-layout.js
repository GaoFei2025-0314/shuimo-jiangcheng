  /* 导览与观画共用画幅计算。 */
  function createMapLayout(invalidate, onLeavePainting) {
    const media = window.matchMedia('(max-width: 640px), (max-height: 500px)');
    const poem = document.getElementById('poem'), text = document.getElementById('cardText');
    const poemButton = document.getElementById('poem-toggle'), detailsButton = document.getElementById('details-toggle');
    const elements = ['title', 'poem', 'sound', 'poem-toggle', 'map-actions', 'dock'].map(id => document.getElementById(id));
    const paintingButton = document.getElementById('painting-toggle');
    const paintingExtras = ['title', 'sound', 'poem-toggle', 'dock', 'marks', 'labels', 'tip']
      .map(id => document.getElementById(id));
    let panel = null, painting = false;
    const nav = document.getElementById('nav');
    function updateNavEdges() {
      nav.classList.toggle('more-left', nav.scrollLeft > 1);
      nav.classList.toggle('more-right', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
    }
    nav.addEventListener('scroll', updateNavEdges, { passive: true });
    app.cleanups.push(() => nav.removeEventListener('scroll', updateNavEdges));
    function updatePanels() {
      poem.hidden = painting || media.matches && panel !== 'poem';
      text.hidden = media.matches && panel !== 'details';
      poemButton.setAttribute('aria-expanded', String(media.matches && panel === 'poem'));
      detailsButton.setAttribute('aria-expanded', String(media.matches && panel === 'details'));
      document.getElementById('hint').textContent = media.matches
        ? '单指旋转 · 双指缩放 · 轻触景点 · 滑动导览'
        : '拖拽旋转　滚轮缩放　点击景点';
      invalidate();
    }
    function toggle(name) {
      panel = panel === name ? null : name;
      updatePanels();
    }
    function setPainting(enabled,focusButton=true) {
      if (painting && !enabled) onLeavePainting();
      painting = enabled;
      panel = null;
      if (focusButton) paintingButton.focus({ preventScroll: true });
      paintingButton.textContent = enabled ? '退出观画' : '观画';
      paintingButton.toggleAttribute('data-painting', enabled);
      paintingExtras.forEach(el => { el.hidden = enabled; });
      updatePanels();
      if (!enabled) nav.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    paintingButton.addEventListener('click', () => setPainting(!painting));
    poemButton.addEventListener('click', () => toggle('poem'));
    detailsButton.addEventListener('click', () => toggle('details'));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || document.getElementById('atlas').open) return;
      if (painting) { setPainting(false); return; }
      if (!media.matches || !panel) return;
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
      setPainting,
      get compact() { return media.matches; },
      measure(width, height) {
        updateNavEdges();
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
            else if (id !== 'map-actions') top = Math.max(top, rect.bottom + 8);
          });
        } else {
          blocks.forEach(({ id, rect }) => {
            if (id === 'title') top = Math.max(top, rect.bottom + 24);
            if (id === 'dock') bottom = Math.min(bottom, rect.top - 24);
          });
        }
        return { blocks: blocks.map(b => b.rect), rect: { left: 16, top, right: width - 16, bottom: Math.max(top + 40, bottom) } };
      }
    };
  }

  // 在原观察方向上将各建筑八角放进画幅，四边各留 10%。
  // 多建筑分别计算，避免把远处高塔的高度套到近处建筑上，徒增留白。
  function fittedView(base, bounds, rect, width, height, fov, fill = .8) {
    const back = new THREE.Vector3().copy(base.pos).sub(base.target).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
    const up = new THREE.Vector3().crossVectors(back, right);
    const boxes = Array.isArray(bounds) ? bounds : [bounds];
    const union = new THREE.Box3(); boxes.forEach(box => union.union(box));
    const target = union.getCenter(new THREE.Vector3());
    const tanY = Math.tan(fov * Math.PI / 360);
    const tanX = tanY * width / height * (rect.right - rect.left) / width * fill;
    const tanSafeY = tanY * (rect.bottom - rect.top) / height * fill;
    let distance = 22;
    for (const box of boxes) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(x, y, z).sub(target);
      distance = Math.max(distance, v.dot(back) + Math.max(Math.abs(v.dot(right)) / tanX, Math.abs(v.dot(up)) / tanSafeY));
    }
    return { pos: target.clone().addScaledVector(back, distance + 1), target };
  }
