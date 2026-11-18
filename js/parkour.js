/* A small runner that does parkour across the hero:
   Design → Build → Play → the research paper → the controller → back to Design.
   Surfaces are measured from the live layout, so the route adapts to any screen. */
(() => {
  const el = document.getElementById("parkour");
  const hero = el && el.closest(".hero");
  if (!el || !hero) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const RUN = 120;          // px per second
  let segs = [], total = 0, t = 0, last = 0, visible = true, raf = 0;

  // Top surface of an element, in hero coordinates. `inset` trims the ends.
  function surface(node, { yOff = 0, l = 0.04, r = 0.04 } = {}) {
    const h = hero.getBoundingClientRect(), b = node.getBoundingClientRect();
    return { x0: b.left - h.left + b.width * l, x1: b.right - h.left - b.width * r, y: b.top - h.top + yOff };
  }
  // Glyph tops sit below the span box; offset by a share of the font size.
  function wordSurface(w) {
    const fs = parseFloat(getComputedStyle(w).fontSize);
    if (w.classList.contains("w-design")) return surface(w, { yOff: fs * 0.33, l: 0.26, r: 0.2 }); // x-height of "esign"
    const share = w.classList.contains("w-play") ? 0.3 : 0.2;
    return surface(w, { yOff: fs * share, l: 0.05, r: 0.12 });
  }

  function build() {
    const words = [...hero.querySelectorAll("h1 .w")];
    const consoleBody = hero.querySelector(".console-body");
    const sheet = hero.querySelector(".sheet");
    if (words.length < 3 || !consoleBody || !sheet) return false;

    const [d, b, p] = words.map(wordSurface);
    const paper = surface(sheet, { yOff: 1, l: 0.3, r: 0.1 });
    const con = surface(consoleBody, { yOff: 1, l: 0.12, r: 0.12 });

    // Route: list of [x, y] stops; consecutive stops on the same surface are runs, others are jumps.
    const route = [
      { x: d.x0, y: d.y, s: "d" }, { x: d.x1, y: d.y, s: "d" },
      { x: b.x0, y: b.y, s: "b" }, { x: b.x1, y: b.y, s: "b" },
      { x: p.x0, y: p.y, s: "p" }, { x: p.x1, y: p.y, s: "p" },
      { x: paper.x0 + 10, y: paper.y, s: "paper" }, { x: paper.x1, y: paper.y, s: "paper" },
      { x: paper.x1, y: paper.y, s: "paper", pause: 0.7 }, { x: paper.x0, y: paper.y, s: "paper" },
      { x: con.x1, y: con.y, s: "con" }, { x: con.x0, y: con.y, s: "con" },
      { x: con.x0, y: con.y, s: "con", pause: 0.5 },
      { x: d.x0, y: d.y, s: "d" },
    ];

    segs = []; total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], c = route[i + 1];
      let seg;
      if (c.pause) seg = { kind: "idle", a, c, dur: c.pause };
      else if (a.s === c.s) seg = { kind: "run", a, c, dur: Math.max(0.05, Math.abs(c.x - a.x) / RUN) };
      else {
        const dist = Math.hypot(c.x - a.x, c.y - a.y);
        const hgt = 20 + Math.min(36, Math.abs(c.x - a.x) * 0.08); // hop above the higher surface
        seg = { kind: "jump", a, c, hgt, dur: Math.min(1.05, Math.max(0.5, dist / 520)) };
      }
      seg.start = total; total += seg.dur;
      segs.push(seg);
    }
    return true;
  }

  function pose(time) {
    const tt = time % total;
    const seg = segs.find((s) => tt >= s.start && tt < s.start + s.dur) || segs[segs.length - 1];
    const k = Math.min(1, (tt - seg.start) / seg.dur);
    const { a, c } = seg;
    let x, y, dir = c.x >= a.x ? 1 : -1, state = seg.kind;
    if (seg.kind === "jump") {
      x = a.x + (c.x - a.x) * k;
      const peak = Math.min(a.y, c.y) - seg.hgt;
      // quadratic through start, peak-ish control, end
      const cy = 2 * peak - (a.y + c.y) / 2;
      y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * cy + k * k * c.y;
    } else if (seg.kind === "idle") {
      x = a.x; y = a.y;
      const next = segs[segs.indexOf(seg) + 1];
      dir = next ? (next.c.x >= next.a.x ? 1 : -1) : 1;
    } else {
      x = a.x + (c.x - a.x) * k; y = a.y;
    }
    return { x, y, dir, state };
  }

  function place({ x, y, dir, state }) {
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.transform = `translate(${x - w / 2}px, ${y - h}px)`;
    el.classList.toggle("left", dir < 0);
    el.classList.toggle("air", state === "jump");
    el.classList.toggle("idle", state === "idle");
  }

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (visible && !document.hidden) {
      const lap = Math.floor(t / total);
      t += dt;
      if (Math.floor(t / total) !== lap) { build(); t = t % total; } // re-measure each lap
      place(pose(t));
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!build()) return;
    el.classList.add("ready");
    if (reduce) {
      // Stand still on the controller.
      const s = segs.find((x) => x.a.s === "con");
      place({ x: (s.a.x + s.c.x) / 2, y: s.a.y, dir: -1, state: "idle" });
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Wait for fonts + the hero entrance animation so measurements are final.
  const go = () => setTimeout(start, 1900);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);

  // Debug hook: el._seek(seconds) freezes the runner at a point on the route.
  el._seek = (s) => { visible = false; t = s; place(pose(t)); return { t: s, total, segs: segs.map((g) => [g.kind, g.a.s + '>' + g.c.s, +g.start.toFixed(2)]) }; };

  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { build(); }, 150); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
})();
