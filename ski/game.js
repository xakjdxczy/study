(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const distEl = document.getElementById("dist");
  const coinsEl = document.getElementById("coins");
  const bestEl = document.getElementById("best");
  const toastEl = document.getElementById("toast");

  const STORAGE = "pip-ski-safari-best";
  const LANES = [-1, 0, 1];

  const STATE = { TITLE: "title", PLAY: "play", DEAD: "dead" };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  let W = 720;
  let H = 1280;
  let dpr = 1;

  function resize() {
    const wrap = document.getElementById("wrap");
    const r = wrap.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(360, Math.round(r.width));
    H = Math.max(560, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const audio = {
    ctx: null,
    ensure() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    beep(freq, dur, type = "sine", vol = 0.06) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    },
    coin() {
      this.beep(880, 0.08, "triangle", 0.05);
      this.beep(1320, 0.1, "sine", 0.04);
    },
    jump() {
      this.beep(320, 0.12, "square", 0.035);
    },
    crash() {
      this.beep(90, 0.28, "sawtooth", 0.08);
    },
    power() {
      this.beep(523, 0.1, "sine", 0.05);
      this.beep(784, 0.16, "triangle", 0.05);
    },
  };

  function loadBest() {
    return Number(localStorage.getItem(STORAGE) || 0) || 0;
  }

  function saveBest(n) {
    localStorage.setItem(STORAGE, String(n));
  }

  function emptyGame() {
    return {
      state: STATE.TITLE,
      t: 0,
      dist: 0,
      coins: 0,
      score: 0,
      best: loadBest(),
      speed: 46,
      spawnAt: 18,
      lane: 0,
      laneX: 0,
      jump: 0,
      jumpV: 0,
      invuln: 0,
      magnet: 0,
      combo: 0,
      shake: 0,
      objects: [],
      flakes: Array.from({ length: 70 }, () => ({
        x: Math.random(),
        y: Math.random(),
        s: rand(0.6, 2.2),
        v: rand(18, 46),
      })),
      bits: [],
    };
  }

  let G = emptyGame();

  function toast(text, ms = 900) {
    toastEl.hidden = false;
    toastEl.textContent = text;
    clearTimeout(toast.tid);
    toast.tid = setTimeout(() => {
      toastEl.hidden = true;
    }, ms);
  }

  function project(z) {
    const horizon = H * 0.2;
    const near = H * 0.92;
    const t = 1 / (1 + z * 0.0145);
    const y = horizon + (1 - t) * (near - horizon);
    const scale = 0.22 + 0.78 * (1 - t);
    const roadHalf = W * 0.46 * scale;
    return { y, scale, roadHalf, t };
  }

  function laneX(lane, z) {
    const p = project(z);
    return W / 2 + lane * p.roadHalf * 0.62;
  }

  function spawnPattern() {
    const z0 = 118;
    const kind = Math.random();
    const add = (lane, type, z = z0, extra = {}) => {
      G.objects.push({ lane, type, z, taken: false, ...extra });
    };
    if (kind < 0.22) {
      add(pick(LANES), pick(["tree", "tree", "rock", "snowman"]));
    } else if (kind < 0.4) {
      const gap = pick(LANES);
      LANES.forEach((l) => {
        if (l !== gap) add(l, "tree");
      });
    } else if (kind < 0.55) {
      const lane = pick(LANES);
      add(lane, pick(["rock", "snowman"]));
      add(pick(LANES.filter((l) => l !== lane)), "coin", z0 + 8);
    } else if (kind < 0.74) {
      const lane = pick(LANES);
      for (let i = 0; i < 6; i += 1) add(lane, "coin", z0 + i * 7);
    } else if (kind < 0.86) {
      const start = pick(LANES);
      for (let i = 0; i < 5; i += 1) {
        const lane = clamp(start + (i % 3) - 1, -1, 1);
        add(lane, "coin", z0 + i * 8);
      }
    } else if (kind < 0.93) {
      add(pick(LANES), "star");
    } else {
      add(pick(LANES), "magnet");
    }
    if (Math.random() < 0.35) add(pick(LANES), "coin", z0 + 28);
  }

  function resetPlay() {
    const best = G.best;
    G = emptyGame();
    G.best = best;
    G.state = STATE.PLAY;
    G.lane = 0;
    G.laneX = 0;
    hud.hidden = false;
    spawnPattern();
    spawnPattern();
  }

  function moveLane(dir) {
    if (G.state !== STATE.PLAY) return;
    G.lane = clamp(G.lane + dir, -1, 1);
  }

  function jump() {
    if (G.state !== STATE.PLAY || G.jump > 0) return;
    G.jump = 1;
    G.jumpV = 1;
    audio.jump();
  }

  function burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i += 1) {
      G.bits.push({
        x,
        y,
        vx: rand(-90, 90),
        vy: rand(-140, -20),
        life: rand(0.25, 0.55),
        color,
      });
    }
  }

  function crash() {
    G.state = STATE.DEAD;
    G.shake = 14;
    G.score = Math.floor(G.dist + G.coins * 12 + G.combo * 2);
    if (G.score > G.best) {
      G.best = G.score;
      saveBest(G.best);
    }
    audio.crash();
    toast("哎哟，撞到了");
  }

  function update(dt) {
    G.t += dt;
    G.flakes.forEach((f) => {
      f.y += (f.v * dt) / H;
      if (f.y > 1) {
        f.y = -0.05;
        f.x = Math.random();
      }
    });
    G.bits = G.bits.filter((b) => {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 280 * dt;
      return b.life > 0;
    });
    G.shake = Math.max(0, G.shake - dt * 28);
    if (G.state !== STATE.PLAY) return;

    G.speed = Math.min(108, 46 + G.dist * 0.085);
    const step = G.speed * dt;
    G.dist += step * 0.42;
    G.laneX += (G.lane - G.laneX) * Math.min(1, dt * 12);
    if (G.jump > 0) {
      G.jumpV -= dt * 3.4;
      G.jump = Math.max(0, G.jump + G.jumpV * dt * 2.1);
    }
    G.invuln = Math.max(0, G.invuln - dt);
    G.magnet = Math.max(0, G.magnet - dt);

    if (G.dist > G.spawnAt) {
      G.spawnAt += rand(14, 22) - Math.min(8, G.dist * 0.01);
      spawnPattern();
    }

    const playerZ = 8;
    G.objects.forEach((o) => {
      o.z -= step;
      if (G.magnet > 0 && o.type === "coin" && !o.taken && o.z < 42) {
        o.lane += (G.lane - o.lane) * dt * 4;
      }
      if (o.taken || o.z > 16 || o.z < 2) return;
      const near = Math.abs(o.z - playerZ) < (o.type === "coin" || o.type === "star" || o.type === "magnet" ? 5.2 : 3.4);
      const same = Math.abs(o.lane - G.laneX) < 0.45;
      if (!near || !same) return;
      if (o.type === "coin") {
        o.taken = true;
        G.coins += 1;
        G.combo += 1;
        audio.coin();
        burst(laneX(G.laneX, playerZ), project(playerZ).y - 30, "#ffd24a", 10);
      } else if (o.type === "star") {
        o.taken = true;
        G.invuln = 4.2;
        audio.power();
        toast("星星护体！");
      } else if (o.type === "magnet") {
        o.taken = true;
        G.magnet = 5.5;
        audio.power();
        toast("金币磁铁！");
      } else {
        const tall = o.type === "tree";
        if (G.invuln > 0) return;
        if (!tall && G.jump > 0.18) {
          G.combo += 2;
          return;
        }
        crash();
      }
    });
    G.objects = G.objects.filter((o) => o.z > -6 && !o.taken);

    distEl.textContent = `${Math.floor(G.dist)} 米`;
    coinsEl.textContent = `★ ${G.coins}`;
    bestEl.textContent = `最佳 ${G.best}`;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3d8fda");
    g.addColorStop(0.42, "#8fd0f5");
    g.addColorStop(1, "#eef7ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#f8fbff";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.28);
    ctx.lineTo(W * 0.18, H * 0.16);
    ctx.lineTo(W * 0.34, H * 0.26);
    ctx.lineTo(W * 0.52, H * 0.12);
    ctx.lineTo(W * 0.72, H * 0.24);
    ctx.lineTo(W * 0.9, H * 0.14);
    ctx.lineTo(W, H * 0.26);
    ctx.lineTo(W, H * 0.34);
    ctx.lineTo(0, H * 0.34);
    ctx.fill();
  }

  function drawRoad() {
    const top = project(130);
    const bot = project(0);
    ctx.beginPath();
    ctx.moveTo(W / 2 - top.roadHalf * 1.15, top.y);
    ctx.lineTo(W / 2 + top.roadHalf * 1.15, top.y);
    ctx.lineTo(W / 2 + bot.roadHalf * 1.2, bot.y + 40);
    ctx.lineTo(W / 2 - bot.roadHalf * 1.2, bot.y + 40);
    ctx.closePath();
    const snow = ctx.createLinearGradient(0, top.y, 0, H);
    snow.addColorStop(0, "#d7e9f8");
    snow.addColorStop(1, "#f7fbff");
    ctx.fillStyle = snow;
    ctx.fill();

    ctx.fillStyle = "rgba(70, 130, 170, 0.12)";
    for (const lane of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + lane * top.roadHalf * 0.7, top.y);
      ctx.lineTo(W / 2 + lane * bot.roadHalf * 0.72, bot.y + 30);
      ctx.lineTo(W / 2 + lane * bot.roadHalf * 0.72 + 3, bot.y + 30);
      ctx.lineTo(W / 2 + lane * top.roadHalf * 0.7 + 2, top.y);
      ctx.fill();
    }
  }

  function drawTree(x, y, s) {
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(x - 4 * s, y - 6 * s, 8 * s, 18 * s);
    ctx.fillStyle = "#1f7a46";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x, y - (52 - i * 12) * s);
      ctx.lineTo(x + (28 - i * 4) * s, y - (18 - i * 8) * s);
      ctx.lineTo(x - (28 - i * 4) * s, y - (18 - i * 8) * s);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(x, y - 52 * s);
    ctx.lineTo(x + 8 * s, y - 42 * s);
    ctx.lineTo(x - 8 * s, y - 42 * s);
    ctx.fill();
  }

  function drawRock(x, y, s) {
    ctx.fillStyle = "#7d8796";
    ctx.beginPath();
    ctx.ellipse(x, y, 20 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9aa4b2";
    ctx.beginPath();
    ctx.ellipse(x - 6 * s, y - 4 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(x, y - 8 * s, 16 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnowman(x, y, s) {
    ctx.fillStyle = "#f4f8ff";
    ctx.beginPath();
    ctx.arc(x, y - 4 * s, 13 * s, 0, Math.PI * 2);
    ctx.arc(x, y - 22 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d2430";
    ctx.fillRect(x - 10 * s, y - 34 * s, 20 * s, 4 * s);
    ctx.fillRect(x - 6 * s, y - 40 * s, 12 * s, 8 * s);
    ctx.beginPath();
    ctx.arc(x - 3 * s, y - 24 * s, 1.4 * s, 0, Math.PI * 2);
    ctx.arc(x + 3 * s, y - 24 * s, 1.4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e07a3d";
    ctx.beginPath();
    ctx.moveTo(x, y - 22 * s);
    ctx.lineTo(x + 8 * s, y - 20 * s);
    ctx.lineTo(x, y - 19 * s);
    ctx.fill();
  }

  function drawCoin(x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 6) * 0.2);
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c48a10";
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.fillStyle = "#fff3b0";
    ctx.font = `bold ${12 * s}px Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", 0, 1);
    ctx.restore();
  }

  function drawGem(x, y, s, color, glyph) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 13 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${14 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, x, y + 1);
  }

  function drawPip(x, y, s, lean, jumpH) {
    ctx.save();
    ctx.translate(x, y - jumpH);
    ctx.rotate(lean * 0.18);
    ctx.fillStyle = "#6b4420";
    ctx.fillRect(-16 * s, 18 * s, 12 * s, 6 * s);
    ctx.fillRect(4 * s, 18 * s, 12 * s, 6 * s);
    ctx.fillStyle = "#e07a3d";
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 16 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6e8";
    ctx.beginPath();
    ctx.ellipse(0, 8 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e07a3d";
    ctx.beginPath();
    ctx.moveTo(-12 * s, -14 * s);
    ctx.lineTo(-18 * s, -28 * s);
    ctx.lineTo(-4 * s, -16 * s);
    ctx.moveTo(12 * s, -14 * s);
    ctx.lineTo(18 * s, -28 * s);
    ctx.lineTo(4 * s, -16 * s);
    ctx.fill();
    ctx.fillStyle = "#3d7ec9";
    ctx.fillRect(-14 * s, -4 * s, 28 * s, 5 * s);
    ctx.beginPath();
    ctx.arc(16 * s, -2 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2218";
    ctx.beginPath();
    ctx.arc(-5 * s, -4 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.arc(5 * s, -4 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c45c6a";
    ctx.beginPath();
    ctx.arc(0, 1 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    if (G.invuln > 0) {
      ctx.strokeStyle = "rgba(255, 220, 80, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawObjects() {
    const list = [...G.objects].sort((a, b) => b.z - a.z);
    list.forEach((o) => {
      const p = project(o.z);
      const x = laneX(o.lane, o.z);
      const y = p.y;
      const s = p.scale;
      if (o.type === "tree") drawTree(x, y, s);
      else if (o.type === "rock") drawRock(x, y, s);
      else if (o.type === "snowman") drawSnowman(x, y, s);
      else if (o.type === "coin") drawCoin(x, y - 18 * s, s, G.t);
      else if (o.type === "star") drawGem(x, y - 20 * s, s, "#e4b01a", "✦");
      else if (o.type === "magnet") drawGem(x, y - 20 * s, s, "#3d7ec9", "🧲");
    });
  }

  function drawBits() {
    G.bits.forEach((b) => {
      ctx.globalAlpha = clamp(b.life * 2.4, 0, 1);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawSnow() {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    G.flakes.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x * W, f.y * H, f.s, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function panel(title, lines, hint) {
    const w = Math.min(420, W - 40);
    const h = 240 + lines.length * 22;
    const x = (W - w) / 2;
    const y = H * 0.28;
    ctx.fillStyle = "rgba(18, 32, 54, 0.72)";
    roundRect(x, y, w, h, 22);
    ctx.fill();
    ctx.fillStyle = "#fff8e3";
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.min(36, W * 0.07)}px Fraunces, serif`;
    ctx.fillText(title, W / 2, y + 54);
    ctx.fillStyle = "#d9e7f7";
    ctx.font = "700 16px Nunito, sans-serif";
    lines.forEach((line, i) => ctx.fillText(line, W / 2, y + 96 + i * 26));
    ctx.fillStyle = "#f0d36a";
    ctx.font = "800 17px Nunito, sans-serif";
    ctx.fillText(hint, W / 2, y + h - 28);
  }

  function draw() {
    ctx.save();
    if (G.shake) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    drawSky();
    drawRoad();
    drawObjects();
    const p = project(8);
    const x = laneX(G.laneX, 8);
    const jumpH = G.jump * 54 * p.scale;
    drawPip(x, p.y - 10, p.scale * 1.15, G.laneX - G.lane, jumpH);
    drawBits();
    drawSnow();

    if (G.state === STATE.TITLE) {
      hud.hidden = true;
      panel("滑雪大冒险", ["小狐皮普冲下山坡", "左右换道 · 上滑 / 空格跳跃", "树要躲开，石头可以跳过去", `最佳纪录 ${G.best}`], "点屏幕或按空格开始");
    } else if (G.state === STATE.DEAD) {
      panel(
        "滑倒啦",
        [`这一趟 ${Math.floor(G.dist)} 米`, `捡到 ${G.coins} 个星星`, `得分 ${G.score}`, G.score >= G.best && G.score > 0 ? "新纪录！" : `最佳 ${G.best}`],
        "再来一次"
      );
    }
    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.04);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function startOrRetry() {
    audio.ensure();
    if (G.state === STATE.TITLE || G.state === STATE.DEAD) resetPlay();
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "a", "A"].includes(e.key)) {
      e.preventDefault();
      if (G.state === STATE.PLAY) moveLane(-1);
    } else if (["ArrowRight", "d", "D"].includes(e.key)) {
      e.preventDefault();
      if (G.state === STATE.PLAY) moveLane(1);
    } else if (["ArrowUp", "w", "W", " "].includes(e.key)) {
      e.preventDefault();
      if (G.state === STATE.PLAY) jump();
      else startOrRetry();
    } else if (e.key === "Enter") startOrRetry();
  });

  let touch = null;
  canvas.addEventListener("pointerdown", (e) => {
    touch = { x: e.clientX, y: e.clientY };
    audio.ensure();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!touch) {
      startOrRetry();
      return;
    }
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    touch = null;
    if (G.state !== STATE.PLAY) {
      startOrRetry();
      return;
    }
    if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) jump();
    } else if (Math.abs(dx) > 28) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (e.clientX < window.innerWidth / 2) {
      moveLane(-1);
    } else {
      moveLane(1);
    }
  });

  window.addEventListener("resize", resize);
  resize();
  bestEl.textContent = `最佳 ${G.best}`;
  requestAnimationFrame(loop);

  window.PipSki = { startOrRetry, jump, moveLane, getState: () => G.state };
})();
