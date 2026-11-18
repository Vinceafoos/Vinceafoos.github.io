/* Animated topographic contour background for the hero.
   A slowly evolving 3D simplex-noise field drawn as contour lines with
   marching squares. The cursor raises a small "peak" that the lines flow around.
   Pauses when off-screen; draws a single still frame for reduced motion. */
(() => {
  const canvas = document.getElementById("topo");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // ---- 3D simplex noise (Stefan Gustavson, public domain) ----
  const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const p = new Uint8Array(256);
  let seed = 1337;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  const F3 = 1 / 3, G3 = 1 / 6;
  function noise3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0*x0 - y0*y0 - z0*z0; if (tt > 0) { g = grad3[pm12[ii + perm[jj + perm[kk]]]]; tt *= tt; n += tt * tt * (g[0]*x0 + g[1]*y0 + g[2]*z0); }
    tt = 0.6 - x1*x1 - y1*y1 - z1*z1; if (tt > 0) { g = grad3[pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; tt *= tt; n += tt * tt * (g[0]*x1 + g[1]*y1 + g[2]*z1); }
    tt = 0.6 - x2*x2 - y2*y2 - z2*z2; if (tt > 0) { g = grad3[pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; tt *= tt; n += tt * tt * (g[0]*x2 + g[1]*y2 + g[2]*z2); }
    tt = 0.6 - x3*x3 - y3*y3 - z3*z3; if (tt > 0) { g = grad3[pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; tt *= tt; n += tt * tt * (g[0]*x3 + g[1]*y3 + g[2]*z3); }
    return 32 * n;
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CELL = 10;
  const LEVELS = 9;
  let W = 0, H = 0, cols = 0, rows = 0, field = new Float32Array(0);
  let mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, a: 0, ta: 0 };
  let visible = true, last = 0, t0 = performance.now();

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL) + 2; rows = Math.ceil(H / CELL) + 2;
    field = new Float32Array(cols * rows);
    if (reduce) draw(0);
  }

  function sample(t) {
    const s = 0.0015, z = t * 0.00003;
    const mr = 260, mr2 = mr * mr;
    for (let j = 0; j < rows; j++) {
      const y = j * CELL;
      for (let i = 0; i < cols; i++) {
        const x = i * CELL;
        let v = noise3(x * s, y * s, z) * 0.92 + noise3(x * s * 1.9 + 40, y * s * 1.9, z * 1.4) * 0.08;
        if (mouse.a > 0.01) {
          const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < mr2 * 4) v += 0.16 * mouse.a * Math.exp(-d2 / mr2);
        }
        field[j * cols + i] = v;
      }
    }
  }

  function draw(t) {
    sample(t);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let l = 0; l < LEVELS; l++) {
      const th = -0.64 + (1.28 * l) / (LEVELS - 1);
      const major = l % 4 === 0;
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = field[j * cols + i], b = field[j * cols + i + 1];
          const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
          let idx = 0;
          if (a > th) idx |= 8; if (b > th) idx |= 4; if (c > th) idx |= 2; if (d > th) idx |= 1;
          if (idx === 0 || idx === 15) continue;
          const x = i * CELL, y = j * CELL;
          const top = [x + CELL * (th - a) / (b - a), y];
          const right = [x + CELL, y + CELL * (th - b) / (c - b)];
          const bottom = [x + CELL * (th - d) / (c - d), y + CELL];
          const left = [x, y + CELL * (th - a) / (d - a)];
          const seg = (p1, p2) => { ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); };
          switch (idx) {
            case 1: case 14: seg(left, bottom); break;
            case 2: case 13: seg(bottom, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(top, right); break;
            case 5: seg(left, top); seg(bottom, right); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, top); break;
            case 10: seg(left, bottom); seg(top, right); break;
          }
        }
      }
      ctx.strokeStyle = major ? "rgba(0, 127, 146, 0.26)" : "rgba(0, 150, 170, 0.14)";
      ctx.lineWidth = major ? 1.4 : 1.1;
      ctx.stroke();
    }
  }

  function frame(now) {
    if (visible && !document.hidden && now - last > 33) {
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.035;
      mouse.y += (mouse.ty - mouse.y) * 0.035;
      mouse.a += (mouse.ta - mouse.a) * 0.025;
      draw(now - t0);
    }
    requestAnimationFrame(frame);
  }

  const hero = canvas.parentElement;
  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; mouse.ta = 1;
    if (mouse.x < -1000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
  });
  hero.addEventListener("pointerleave", () => { mouse.ta = 0; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  new ResizeObserver(resize).observe(canvas);
  resize();
  if (!reduce) requestAnimationFrame(frame);
})();
