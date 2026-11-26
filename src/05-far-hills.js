  // 三叠远岫共用纸色，轮廓和干笔细纹各自沿同一个周期采样。
  function createFarHills(element) {
    const width = 2400, height = 260, turn = 2 * Math.PI;
    element.replaceChildren();
    function paint(layer, speed, ink) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(width, height);
      const crest = new Float32Array(width);
      function noise(x, cells, salt) {
        const p = x * cells / width, cell = Math.floor(p), f = p - cell;
        function sample(i) {
          const n = Math.sin((i % cells) * 127.1 + salt * 311.7 + layer * 71.3) * 43758.5453;
          return (n - Math.floor(n)) * 2 - 1;
        }
        return THREE.MathUtils.lerp(sample(cell), sample(cell + 1), f * f * (3 - 2 * f));
      }
      for (let x = 0; x < width; x++) {
        crest[x] = 79 + (19 + 8 * layer) * noise(x, 7, 1) + 15 * noise(x, 19, 2)
          + 7 * noise(x, 39, 3) + 3 * noise(x, 89, 4) + 1.4 * noise(x, 361, 5);
        const edge = Math.floor(crest[x]), dry = .5 + .5 * noise(x, 811, 6);
        for (let y = edge; y < height; y++) {
          const depth = THREE.MathUtils.clamp((y - crest[x]) / (height * .6 - crest[x]), 0, 1);
          const wash = ink * (1 - THREE.MathUtils.smoothstep(depth, 0, 1));
          const i = (y * width + x) * 4;
          pixels.data[i] = 242 - 211 * wash;
          pixels.data[i + 1] = 239 - 209 * wash;
          pixels.data[i + 2] = 230 - 203 * wash;
          pixels.data[i + 3] = y === edge ? (1 - (crest[x] - edge)) * 255 * dry : 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
      const node = document.createElement('div');
      node.className = 'far-hill'; node.dataset.layer = layer;
      element.append(node);
      const band = { node, crest, speed, url: null, top: 0, shift: 0, tile: width };
      // 轮廓在首帧前可查询，PNG 编码交给浏览器；失败清理后迟到的回调不再创建 URL。
      canvas.toBlob(blob => {
        if (!blob || disposed) return;
        band.url = URL.createObjectURL(blob);
        node.style.backgroundImage = 'url(' + band.url + ')';
      });
      return band;
    }
    let disposed = false, previousAngle, angle = 0, opacity = 0, scale = 1;
    const bands = [paint(0, .35, .11), paint(1, .6, .17), paint(2, 1, .25)];
    const maxRise = Math.max(...bands.map((band, i) => 204 - 29 * i - Math.min(...band.crest)));
    return {
      update({ horizonY, azimuth, fit, streetView, height: screenHeight, sunDiameter = 0 }) {
        // 方位角跨过 ±π 时接续上一帧；每绕一周各层都恰好走完自己的瓦片。
        const delta = azimuth - (previousAngle ?? 0);
        angle += Math.atan2(Math.sin(delta), Math.cos(delta));
        previousAngle = azimuth;
        opacity = THREE.MathUtils.smoothstep(fit, .2, .6) * (1 - streetView);
        element.style.opacity = opacity;
        if (!opacity) return;
        // 留足整个日盘的高度，整条山带等比收低，旋转时山形不会跟着太阳起伏。
        const rise = Math.max(0, horizonY - .85 * sunDiameter * fit - 4);
        scale = Math.min(1, screenHeight / 800, horizonY / 210, rise / maxRise);
        for (const [i, band] of bands.entries()) {
          band.tile = width * band.speed;
          band.shift = angle / turn * band.tile;
          band.top = horizonY - (204 - 29 * i) * scale;
          band.node.style.height = height * scale + 'px';
          band.node.style.backgroundSize = band.tile + 'px 100%';
          band.node.style.backgroundPositionX = band.shift + 'px';
          band.node.style.transform = 'translateY(' + band.top + 'px)';
        }
      },
      ridgeTopAt(x) {
        if (!opacity) return Infinity;
        return Math.min(...bands.map(band => {
          const u = (x - band.shift) / band.tile;
          const index = Math.floor((u - Math.floor(u)) * width) % width;
          return band.top + band.crest[index] * scale;
        }));
      },
      dispose() {
        disposed = true;
        for (const { url } of bands) if (url) URL.revokeObjectURL(url);
        element.replaceChildren();
      }
    };
  }
