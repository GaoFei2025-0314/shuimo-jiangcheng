
  /* ═════════ 十六、琴声：Web Audio 现场合成，不带音频文件 ═════════
     D 调五声，疏落的拨弦，底下是极轻的水声与江风。默认关闭，点「乐」才出声。 */
  (function () {
    const AC = window.AudioContext || window.webkitAudioContext;
    const btn = document.getElementById('sound');
    if (!btn) return;
    if (!AC) { btn.style.display = 'none'; return; }

    let ctx = null, master = null, bus = null, noiseBuf = null, clickBuf = null;
    let playing = false, timer = 0, nextT = 0, deg = 5, left = 0;

    const STEPS = [0, 2, 4, 7, 9];                 // 宫商角徵羽（大调五声）
    const ROOT = 146.83;                           // D3
    const MAXDEG = 11;
    const freq = n => ROOT * Math.pow(2, (Math.floor(n / 5) * 12 + STEPS[n % 5]) / 12);
    const rnd = (a, b) => a + Math.random() * (b - a);

    /* 首尾交叉淡化的棕噪声，循环时不出接缝 */
    function loopNoise(sec) {
      const sr = ctx.sampleRate, n = sec * sr | 0, xf = sr >> 1;
      const tmp = new Float32Array(n + xf);
      let last = 0;
      for (let i = 0; i < tmp.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; tmp[i] = last * 3.5; }
      const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
      d.set(tmp.subarray(0, n));
      for (let i = 0; i < xf; i++) { const a = i / xf; d[i] = tmp[i] * a + tmp[n + i] * (1 - a); }
      return b;
    }

    function build() {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);

      bus = ctx.createGain(); bus.connect(master);                    // 干声
      const conv = ctx.createConvolver(), ir = ctx.createBuffer(2, ctx.sampleRate * 3.2 | 0, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
      }
      conv.buffer = ir;
      const wetLp = ctx.createBiquadFilter(); wetLp.type = 'lowpass'; wetLp.frequency.value = 2600;
      const wet = ctx.createGain(); wet.gain.value = .55;
      bus.connect(conv); conv.connect(wetLp); wetLp.connect(wet); wet.connect(master);

      noiseBuf = loopNoise(6);
      clickBuf = ctx.createBuffer(1, ctx.sampleRate * .06 | 0, ctx.sampleRate);
      const cd = clickBuf.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;

      /* 水声与江风：同一路噪声，两支滤波，各由极慢的 LFO 起伏 */
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      [['bandpass', 700, .8, .03, .11, .018], ['lowpass', 220, .5, .07, .05, .035]].forEach(p => {
        const f = ctx.createBiquadFilter(); f.type = p[0]; f.frequency.value = p[1]; f.Q.value = p[2];
        const g = ctx.createGain(); g.gain.value = p[3];
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = p[4]; depth.gain.value = p[5];
        lfo.connect(depth); depth.connect(g.gain); lfo.start();
        src.connect(f); f.connect(g); g.connect(bus);
      });
      src.start();
    }

    /* 一声拨弦 */
    function pluck(f, t, vel) {
      const dur = rnd(3.6, 5);
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = .7;
      lp.frequency.setValueAtTime(3400, t); lp.frequency.setTargetAtTime(520, t + .02, .55);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + .008);
      g.gain.setTargetAtTime(0, t + .02, dur / 5);
      lp.connect(g); g.connect(bus);
      [['triangle', 1, 1], ['sine', 2, .22]].forEach(o => {
        const osc = ctx.createOscillator(), og = ctx.createGain();
        osc.type = o[0]; og.gain.value = o[2];
        osc.frequency.setValueAtTime(f * o[1] * .985, t);                    // 吟猱：由微低滑入本音
        osc.frequency.exponentialRampToValueAtTime(f * o[1], t + .14);
        osc.connect(og); og.connect(lp);
        osc.start(t); osc.stop(t + dur + .5);
      });
      const c = ctx.createBufferSource(), cf = ctx.createBiquadFilter(), cg = ctx.createGain();   // 指触的一点声
      c.buffer = clickBuf; cf.type = 'bandpass'; cf.frequency.value = 1800; cf.Q.value = 1.2;
      cg.gain.setValueAtTime(vel * .16, t); cg.gain.exponentialRampToValueAtTime(.0001, t + .05);
      c.connect(cf); cf.connect(cg); cg.connect(bus); c.start(t);
    }

    /* 排下一声，返回再下一声的时刻。三至六声成一句，句间留白 */
    function playNext(t) {
      if (left <= 0) left = 3 + Math.floor(Math.random() * 4);
      const r = Math.random();
      let d = r < .1 ? 0 : r < .6 ? 1 : r < .85 ? 2 : 3;
      if (Math.random() < .5) d = -d;
      deg += d;
      if (deg < 0) deg = -deg; if (deg > MAXDEG) deg = 2 * MAXDEG - deg;
      deg = Math.max(0, Math.min(MAXDEG, deg));
      pluck(freq(deg), t, rnd(.34, .6));
      if (deg >= 5 && Math.random() < .2) pluck(freq(deg - 5), t + .012, rnd(.2, .34));   // 下叠八度
      left--;
      return t + (left > 0 ? rnd(1.1, 2.4) : rnd(5, 9));
    }
    function schedule() {
      const now = ctx.currentTime;
      if (nextT < now) nextT = now + .2;
      while (nextT < now + 1.5) nextT = playNext(nextT);
    }

    function fade(to, tc) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.setTargetAtTime(to, t, tc);
    }
    function start() {
      if (!ctx) build();
      playing = true;
      ctx.resume().catch(() => {});
      fade(.5, .7);                                                        // 约两秒淡入
      nextT = ctx.currentTime + .6;
      clearInterval(timer); timer = setInterval(schedule, 400); schedule();
    }
    function stop() {
      playing = false;
      clearInterval(timer);
      fade(0, .3);
      setTimeout(() => { if (!playing) ctx.suspend().catch(() => {}); }, 1600);
    }

    btn.addEventListener('click', () => {
      playing ? stop() : start();
      btn.setAttribute('aria-pressed', String(playing));
    });
    document.addEventListener('visibilitychange', () => {
      if (!playing || !ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    });
  })();
