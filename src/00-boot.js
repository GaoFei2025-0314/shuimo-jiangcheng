  /* 加载与失败只走一条路径，迟到的资源不能重新启动已经失败的场景。 */
  const app = {
    state: 'loading', cleanups: [],
    fail(message) {
      if (this.state === 'failed') return;
      this.state = 'failed';
      window.__ready = false;
      document.body.dataset.state = 'failed';
      document.getElementById('stage').setAttribute('aria-busy', 'false');
      document.getElementById('loadMessage').textContent = message;
      document.getElementById('retry').hidden = false;
      document.querySelectorAll('#nav button, #sound, .mark, .panel-toggle').forEach(b => { b.disabled = true; });
      this.cleanups.forEach(stop => { try { stop(); } catch (_) { /* 尽力释放，仍保留恢复入口 */ } });
      if (document.activeElement && document.activeElement.disabled) document.getElementById('retry').focus();
    },
    ready() {
      if (this.state !== 'loading') return;
      this.state = 'ready';
      window.__ready = true;
      document.body.dataset.state = 'ready';
      document.getElementById('stage').setAttribute('aria-busy', 'false');
      document.querySelectorAll('#nav button, #sound, .panel-toggle').forEach(b => { b.disabled = false; });
    }
  };
  window.__ready = false;
  document.body.dataset.state = 'loading';
  document.getElementById('retry').addEventListener('click', () => window.location.reload());

  function loadScript(url, available) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => available() ? resolve() : reject(new Error('场景资源不完整，请重新加载。'));
      script.onerror = () => reject(new Error('场景资源未能加载，请检查网络后重试。'));
      document.head.appendChild(script);
    });
  }
  async function loadDependencies() {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('场景资源加载超时，请检查网络后重试。')), 15000);
    });
    const three = loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', () => !!window.THREE)
      .then(() => {
        if (app.state !== 'loading') return;
        return Promise.all([
          loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', () => !!THREE.OrbitControls),
          loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/BufferGeometryUtils.js', () => !!THREE.BufferGeometryUtils)
        ]);
      });
    try {
      await Promise.race([timeout, Promise.all([
        three,
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', () => !!window.gsap)
      ])]);
    } catch (error) {
      app.fail(error.message);
    } finally {
      clearTimeout(timer);
    }
  }
