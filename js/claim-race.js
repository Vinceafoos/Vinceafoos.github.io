// Pass the Mic: simulation of the claim race.
// With the lock on, claim_message() takes SELECT ... FOR UPDATE on the row, so a
// second transaction waits, then sees the row is already claimed. With it off,
// both transactions read "unclaimed" and both clients are told they won.
const root = document.getElementById("ptm");
if (root) init(root);

function init(root) {
  const $ = (s) => root.querySelector(s);
  const log = $(".db-log"), lockEl = $(".db-lock"), rowEl = $("#db-claimed"), lockToggle = $("#ptm-lock");
  const players = {
    a: { name: "Alex", color: "#4d8bf0", btn: $("#claim-a"), status: $("#status-a"), card: $("#card-a") },
    b: { name: "Jamie", color: "#ef7b54", btn: $("#claim-b"), status: $("#status-b"), card: $("#card-b") },
  };
  let row, holder, queue, results, timers = [];

  const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
  const line = (cls, html) => {
    const d = document.createElement("div");
    d.className = cls; d.innerHTML = html;
    log.appendChild(d);
    while (log.children.length > 7) log.firstChild.remove();
  };
  const setLock = (who) => {
    holder = who;
    lockEl.classList.toggle("locked", !!who);
    lockEl.textContent = who ? `🔒 locked by ${players[who].name}` : "🔓 unlocked";
  };
  const setRow = () => { rowEl.textContent = row.claimed_by ? `'${players[row.claimed_by].name}'` : "NULL"; };

  function reset() {
    timers.forEach(clearTimeout); timers = [];
    row = { claimed_by: null }; queue = []; results = {};
    setLock(null); setRow();
    log.innerHTML = "";
    line("sys", "Sam sent a new voice note. One person can claim it.");
    for (const p of Object.values(players)) {
      p.btn.disabled = false; p.btn.textContent = "Claim & Listen";
      p.status.className = "phone-status"; p.status.textContent = "";
      p.card.classList.remove("playing");
    }
  }

  async function claim(id) {
    const p = players[id];
    if (p.btn.disabled) return;
    p.btn.disabled = true; p.btn.textContent = "Claiming…";
    p.status.className = "phone-status wait"; p.status.textContent = "Sending claim…";
    const latency = 40 + Math.random() * 160;
    await wait(latency);
    line(id, `${p.name} → <b>rpc('claim_message')</b> arrives (+${latency.toFixed(0)}ms)`);
    if (lockToggle.checked) return lockedClaim(id);
    return naiveClaim(id);
  }

  async function lockedClaim(id) {
    const p = players[id];
    if (holder) {
      line(id, `${p.name}'s transaction <b>waits</b> for the row lock…`);
      p.status.textContent = "Waiting for lock…";
      await new Promise((r) => queue.push(r));
    }
    setLock(id);
    line(id, `BEGIN; SELECT … <b>FOR UPDATE</b>. ${p.name} holds the lock`);
    await wait(650);
    if (!row.claimed_by) {
      row.claimed_by = id; setRow();
      line(id, `claimed_by IS NULL → UPDATE claimed_by = '${p.name}'; COMMIT`);
      finish(id, true);
    } else {
      line(id, `claimed_by = '${players[row.claimed_by].name}' → return <b>already_claimed</b>`);
      finish(id, false, players[row.claimed_by].name);
    }
    setLock(null);
    await wait(250);
    queue.shift()?.();
  }

  async function naiveClaim(id) {
    const p = players[id];
    const seen = row.claimed_by;
    line(id, `${p.name} reads claimed_by = ${seen ? `'${players[seen].name}'` : "NULL"}`);
    await wait(650);
    if (!seen) {
      row.claimed_by = id; setRow();
      line(id, `${p.name} writes claimed_by = '${p.name}'`);
      finish(id, true);
      results[id] = true;
      if (results.a && results.b) line("bad", `⚠️ <b>Both clients were told they won.</b> The last write wins, so the row says '${p.name}' but both phones are playing the clip.`);
    } else {
      finish(id, false, players[seen].name);
    }
  }

  function finish(id, won, winner) {
    const p = players[id];
    p.btn.textContent = won ? "Listening…" : "Claimed";
    p.status.className = "phone-status " + (won ? "win" : "lose");
    p.status.textContent = won ? "🎙️ You got it! Listen, then reply." : `Too slow. ${winner} got it.`;
    p.card.classList.toggle("playing", won);
  }

  players.a.btn.addEventListener("click", () => claim("a"));
  players.b.btn.addEventListener("click", () => claim("b"));
  $("#ptm-race").addEventListener("click", () => { reset(); setTimeout(() => { claim("a"); claim("b"); }, 200); });
  $("#ptm-reset").addEventListener("click", reset);
  lockToggle.addEventListener("change", reset);
  reset();
}
