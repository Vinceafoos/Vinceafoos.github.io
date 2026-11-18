/* Site-wide interactions: nav, reveals, tilt, magnifier, console screen, misc. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Nav: scrolled state + color by section underneath ---------- */
  const nav = $("#nav");
  if (nav) {
    const sections = $$("[data-nav]");
    const update = () => {
      nav.classList.toggle("scrolled", scrollY > 10);
      const y = 34;
      let mode = "light";
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) { mode = s.dataset.nav; break; }
      }
      nav.classList.toggle("on-dark", mode === "dark");
      nav.classList.toggle("on-paper", mode === "paper");
    };
    addEventListener("scroll", update, { passive: true });
    update();

    const toggle = $(".nav-toggle", nav);
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
    $$(".nav-links a", nav).forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); toggle?.setAttribute("aria-expanded", "false"); }));
  }

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- 3D tilt on hero devices ---------- */
  if (finePointer && !reduce) {
    $$("[data-tilt]").forEach((el) => {
      const inner = $(".device-tilt", el);
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transition = "transform .12s linear";
        inner.style.transform = `rotateY(${px * 12}deg) rotateX(${-py * 10}deg) translateZ(0) scale(1.02)`;
      });
      el.addEventListener("pointerleave", () => {
        inner.style.transition = "";
        inner.style.transform = "";
      });
    });
  }

  /* ---------- Magnifying glass over the research paper ---------- */
  const sheet = $("#sheet"), lens = $("#lens"), clone = $("#lens-clone");
  if (sheet && lens && clone) {
    const content = $(".sheet-content", sheet);
    const copy = content.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    clone.appendChild(copy);
    const SCALE = 1.8;
    let rest = true;
    const place = (x, y) => {
      const cs = getComputedStyle(sheet);
      clone.style.width = sheet.clientWidth + "px";
      clone.style.height = sheet.clientHeight + "px";
      clone.style.padding = cs.padding;
      const glass = lens.firstElementChild;
      const inner = glass.clientWidth; // excludes border
      const border = (glass.offsetWidth - inner) / 2;
      lens.style.left = x + "px";
      lens.style.top = y + "px";
      // Point (x, y) in sheet coords should sit at the lens centre.
      const ox = inner / 2 - x * SCALE + border * 0;
      const oy = inner / 2 - y * SCALE;
      clone.style.transform = `translate(${ox}px, ${oy}px) scale(${SCALE})`;
      void border;
    };
    const restPos = () => place(sheet.clientWidth * 0.62, sheet.clientHeight * 0.6);
    restPos();
    new ResizeObserver(() => rest && restPos()).observe(sheet);
    if (finePointer) {
      sheet.parentElement.parentElement.addEventListener("pointermove", (e) => {
        const r = sheet.getBoundingClientRect();
        const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
        const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
        rest = false;
        lens.classList.add("tracking");
        place(x, y);
      });
      sheet.parentElement.parentElement.addEventListener("pointerleave", () => {
        rest = true;
        lens.classList.remove("tracking");
        restPos();
      });
    }
  }

  /* ---------- Console screen: typing loop + sprite run width ---------- */
  const typeEl = $("#screen-type");
  const screen = $(".screen");
  if (screen) {
    const setW = () => screen.style.setProperty("--screen-w", screen.clientWidth + "px");
    setW(); new ResizeObserver(setW).observe(screen);
  }
  if (typeEl && !reduce) {
    const words = ["games", "tools", "prototypes", "systems", "AI agents"];
    let wi = 0, ci = words[0].length, dir = -1;
    const tick = () => {
      const w = words[wi];
      ci += dir;
      typeEl.textContent = "> " + w.slice(0, ci);
      let wait = dir > 0 ? 90 : 45;
      if (dir > 0 && ci === w.length) { dir = -1; wait = 1800; }
      else if (dir < 0 && ci === 0) { dir = 1; wi = (wi + 1) % words.length; wait = 300; }
      setTimeout(tick, wait);
    };
    setTimeout(tick, 2200);
  }
  // Pressing the console's A/B buttons (just for fun)
  const abxy = $$(".abxy i");
  if (abxy.length && !reduce) {
    setInterval(() => {
      const b = abxy[Math.floor(Math.random() * abxy.length)];
      b.classList.add("press"); setTimeout(() => b.classList.remove("press"), 160);
    }, 1400);
  }

  /* ---------- Pitch card: animated pitch trace ---------- */
  const pc = $("#pitch-art");
  if (pc) {
    const ctx = pc.getContext("2d");
    let w, h, t = 0, visible = false;
    const size = () => { const dpr = Math.min(devicePixelRatio || 1, 2); w = pc.clientWidth; h = pc.clientHeight; pc.width = w * dpr; pc.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); new ResizeObserver(size).observe(pc);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(pc);
    const targets = [0.38, 0.52, 0.46, 0.52, 0.38, 0.52];
    const draw = () => {
      if (visible) {
        t += 1;
        ctx.clearRect(0, 0, w, h);
        const seg = w / 2.2, off = (t * 0.8) % (seg * targets.length);
        // target bars
        for (let k = 0; k < targets.length * 2; k++) {
          const x = k * seg - off;
          const y = targets[k % targets.length] * h;
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.beginPath(); ctx.roundRect(x + 6, y - 9, seg - 12, 18, 9); ctx.fill();
        }
        // sung pitch trace
        ctx.beginPath();
        for (let x = 0; x <= w * 0.5; x += 3) {
          const gx = x + off;
          const k = Math.floor(gx / seg) % targets.length;
          const y = targets[k] * h + Math.sin(gx * 0.05) * 5 + Math.sin(gx * 0.013) * 7;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "#ffc247"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.shadowColor = "#ffc247"; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
        // playhead
        ctx.fillStyle = "#fff"; ctx.fillRect(w * 0.5, 0, 2, h);
      }
      if (!reduce) requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------- Copy email (mailto still opens) ---------- */
  $$(".copy-email").forEach((a) => a.addEventListener("click", () => {
    const email = a.dataset.email;
    if (navigator.clipboard && email) navigator.clipboard.writeText(email).then(() => {
      a.classList.add("copied"); setTimeout(() => a.classList.remove("copied"), 1800);
    }).catch(() => {});
  }));

  /* ---------- Lightbox for project figures ---------- */
  const figs = $$("figure img");
  if (figs.length) {
    const lb = document.createElement("div");
    lb.className = "lightbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "Image viewer");
    lb.innerHTML = '<img alt="">';
    document.body.appendChild(lb);
    const img = lb.firstChild;
    const close = () => lb.classList.remove("open");
    figs.forEach((f) => f.addEventListener("click", () => { img.src = f.currentSrc || f.src; img.alt = f.alt; lb.classList.add("open"); }));
    lb.addEventListener("click", close);
    addEventListener("keydown", (e) => e.key === "Escape" && close());
  }

  /* ---------- Project TOC: highlight current section ---------- */
  const tocLinks = $$(".toc a");
  if (tocLinks.length) {
    const map = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const tio = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { tocLinks.forEach((a) => a.classList.remove("active")); map.get(e.target.id)?.classList.add("active"); }
    }, { rootMargin: "-40% 0px -55% 0px" });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) tio.observe(s); });
  }

  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();
})();
