// Pitch Imperfect, live in the browser.
// Same approach as the hackathon app: mic -> Web Audio AnalyserNode -> pitchy
// (McLeod pitch method) -> smoothed frequency -> scored against each lyric
// line's target note using the original 8% / 18% / 30% tiers.
const root = document.getElementById("pi");
if (root) init(root);

function init(root) {
  const $ = (s) => root.querySelector(s);
  const canvas = $("canvas"), ctx = canvas.getContext("2d");
  const startBtn = $("#pi-start"), toneBtn = $("#pi-tone"), octave = $("#pi-octave");
  const noteEl = $("#pi-note b"), hzEl = $("#pi-note span"), fbEl = $("#pi-feedback");
  const lyricEl = $("#pi-lyric"), scoreEl = $("#pi-score b"), gradeEl = $("#pi-score span"), msgEl = $("#pi-msg");

  // Twinkle line targets from the original TWINKLE_DATA
  const LINES = [
    { text: "Twinkle, twinkle, little star,", f: 392.0 },
    { text: "How I wonder what you are.", f: 329.63 },
    { text: "Up above the world so high,", f: 349.23 },
    { text: "Like a diamond in the sky.", f: 329.63 },
    { text: "Twinkle, twinkle, little star,", f: 392.0 },
    { text: "How I wonder what you are.", f: 329.63 },
  ];
  const LINE_S = 4.2;
  const LO = 196, HI = 523.25; // G3..C5 on screen
  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const noteName = (f) => { const m = Math.round(69 + 12 * Math.log2(f / 440)); return NAMES[(m % 12 + 12) % 12] + (Math.floor(m / 12) - 1); };

  let W = 0, H = 0;
  const size = () => { const dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (!running) draw(0); };
  new ResizeObserver(size).observe(canvas);

  let running = false, audio = null, analyser = null, buf = null, detector = null, stream = null, raf = 0;
  let t0 = 0, smooth = 0, score = 0, max = 0, trace = [];

  const yOf = (f) => H - ((Math.log2(f) - Math.log2(LO)) / (Math.log2(HI) - Math.log2(LO))) * (H - 40) - 20;
  const fold = (f, target) => {
    if (!octave.checked) return f;
    while (f < target / Math.SQRT2) f *= 2;
    while (f > target * Math.SQRT2) f /= 2;
    return f;
  };

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const pxPerS = W / 9, head = W * 0.3;
    // guide lines
    ctx.font = "11px JetBrains Mono, monospace";
    for (const f of [196, 261.63, 329.63, 392, 523.25]) {
      const y = yOf(f);
      ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillText(noteName(f), 8, y - 4);
    }
    // target bars
    const total = LINES.length * LINE_S;
    for (let k = -1; k < LINES.length * 2; k++) {
      const start = k * LINE_S, line = LINES[((k % LINES.length) + LINES.length) % LINES.length];
      const x = head + (start - (t % total)) * pxPerS - (t >= total ? 0 : 0);
      const active = t % total >= start && t % total < start + LINE_S;
      ctx.fillStyle = active ? "rgba(255,194,71,.35)" : "rgba(255,255,255,.12)";
      ctx.beginPath(); ctx.roundRect(x + 4, yOf(line.f) - 11, LINE_S * pxPerS - 8, 22, 11); ctx.fill();
    }
    // sung trace
    ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffc247"; ctx.shadowColor = "#ffc247"; ctx.shadowBlur = 12;
    ctx.beginPath();
    let pen = false;
    for (const p of trace) {
      const x = head - (t - p.t) * pxPerS;
      if (x < -10) continue;
      if (!p.f) { pen = false; continue; }
      const y = yOf(p.f);
      pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      pen = true;
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    // playhead
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(head, 0, 2, H);
    if (!running) {
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "600 16px Space Grotesk, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Press Start, allow the mic, and sing along", W / 2, H - 26); ctx.textAlign = "left";
    }
  }

  function loop() {
    const t = (performance.now() - t0) / 1000;
    const li = Math.floor(t / LINE_S) % LINES.length;
    const line = LINES[li], next = LINES[(li + 1) % LINES.length];
    lyricEl.innerHTML = `${line.text}<small>Target ${noteName(line.f)} · next: ${next.text}</small>`;

    analyser.getFloatTimeDomainData(buf);
    const [freq, clarity] = detector.findPitch(buf, audio.sampleRate);
    let shown = 0;
    if (clarity > 0.7 && freq > 50 && freq < 1000) {
      smooth = smooth ? smooth * 0.8 + freq * 0.2 : freq;
      const f = fold(smooth, line.f);
      shown = f;
      const diff = Math.abs(f - line.f) / line.f;
      const delta = diff < 0.08 ? 15 : diff < 0.18 ? 8 : diff < 0.3 ? 4 : 0;
      max += 15; score += delta;
      fbEl.textContent = delta === 15 ? "Perfect!" : delta === 8 ? "Great" : delta === 4 ? "Close" : "Keep trying";
      fbEl.className = "pi-feedback " + (delta === 15 ? "perfect" : delta === 8 ? "great" : delta === 4 ? "close" : "");
      noteEl.textContent = noteName(smooth);
      hzEl.textContent = `${smooth.toFixed(0)} Hz`;
    } else {
      smooth = smooth * 0.98;
      fbEl.textContent = "Listening…"; fbEl.className = "pi-feedback";
    }
    trace.push({ t, f: shown });
    if (trace.length > 900) trace.shift();
    const pct = max ? Math.round((score / max) * 100) : 0;
    scoreEl.textContent = String(score).padStart(6, "0");
    gradeEl.textContent = max ? `${pct}% accuracy · ${pct >= 85 ? "S" : pct >= 70 ? "A" : pct >= 50 ? "B" : "C"}` : "Grade: —";
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  async function start() {
    msgEl.textContent = "";
    startBtn.disabled = true;
    try {
      const { PitchDetector } = await import("https://cdn.jsdelivr.net/npm/pitchy@4.1.0/+esm");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") await audio.resume();
      const src = audio.createMediaStreamSource(stream);
      analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      detector = PitchDetector.forFloat32Array(analyser.fftSize);
      running = true; t0 = performance.now(); score = 0; max = 0; trace = []; smooth = 0;
      startBtn.textContent = "■ Stop"; startBtn.classList.add("rec"); startBtn.disabled = false;
      loop();
    } catch (e) {
      startBtn.disabled = false;
      msgEl.textContent = e && e.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser's site settings to play." : "Couldn't start the microphone on this device.";
    }
  }
  function stop() {
    running = false; cancelAnimationFrame(raf);
    stream?.getTracks().forEach((tr) => tr.stop());
    audio?.close();
    startBtn.textContent = "● Start singing"; startBtn.classList.remove("rec");
    fbEl.textContent = "Mic off"; fbEl.className = "pi-feedback";
    draw(0);
  }
  startBtn.addEventListener("click", () => (running ? stop() : start()));

  toneBtn.addEventListener("click", () => {
    const t = running ? (performance.now() - t0) / 1000 : 0;
    const f = LINES[Math.floor(t / LINE_S) % LINES.length].f;
    const ac = running && audio ? audio : new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.25, ac.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.2);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 1.25);
  });

  lyricEl.innerHTML = `${LINES[0].text}<small>Target ${noteName(LINES[0].f)}</small>`;
  size();
}
