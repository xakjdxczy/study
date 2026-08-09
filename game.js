(() => {
  const STORAGE_KEY = "stardust-best";

  const startScreen = document.getElementById("start-screen");
  const gameScreen = document.getElementById("game-screen");
  const overScreen = document.getElementById("over-screen");
  const startBtn = document.getElementById("start-btn");
  const retryBtn = document.getElementById("retry-btn");
  const homeBtn = document.getElementById("home-btn");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const livesEl = document.getElementById("lives");
  const finalScoreEl = document.getElementById("final-score");
  const finalBestEl = document.getElementById("final-best");
  const pauseBanner = document.getElementById("pause-banner");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const starsLayer = document.getElementById("stars");

  const W = canvas.width;
  const H = canvas.height;

  let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  bestEl.textContent = String(best);

  const state = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    time: 0,
    catcher: { x: W / 2, y: H - 70, w: 86, h: 18, vx: 0 },
    entities: [],
    particles: [],
    keys: new Set(),
    pointerX: null,
    raf: 0,
    lastTs: 0,
    spawnAcc: 0,
  };

  function seedStars() {
    const count = Math.min(70, Math.floor(window.innerWidth / 14));
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.setProperty("--dur", `${2.2 + Math.random() * 3.5}s`);
      star.style.setProperty("--delay", `${Math.random() * 4}s`);
      frag.appendChild(star);
    }
    starsLayer.replaceChildren(frag);
  }

  function show(screen) {
    startScreen.classList.toggle("hidden", screen !== "start");
    gameScreen.classList.toggle("hidden", screen !== "game");
    overScreen.classList.toggle("hidden", screen !== "over");
  }

  function resetGame() {
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.lives = 3;
    state.time = 0;
    state.entities = [];
    state.particles = [];
    state.catcher.x = W / 2;
    state.catcher.vx = 0;
    state.spawnAcc = 0;
    state.lastTs = 0;
    state.pointerX = null;
    pauseBanner.classList.add("hidden");
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    livesEl.textContent = String(state.lives);
    bestEl.textContent = String(best);
  }

  function difficulty() {
    const t = state.time;
    return {
      spawnEvery: Math.max(0.28, 0.85 - t * 0.012),
      fallSpeed: 170 + t * 9,
      meteorChance: Math.min(0.42, 0.16 + t * 0.008),
    };
  }

  function spawnEntity() {
    const { fallSpeed, meteorChance } = difficulty();
    const isMeteor = Math.random() < meteorChance;
    const radius = isMeteor ? 12 + Math.random() * 8 : 8 + Math.random() * 7;
    state.entities.push({
      x: 24 + Math.random() * (W - 48),
      y: -20,
      r: radius,
      vy: fallSpeed * (0.85 + Math.random() * 0.35),
      type: isMeteor ? "meteor" : "star",
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 4,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.45,
        age: 0,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  function endGame() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(STORAGE_KEY, String(best));
    }
    finalScoreEl.textContent = String(state.score);
    finalBestEl.textContent = String(best);
    bestEl.textContent = String(best);
    show("over");
  }

  function startGame() {
    resetGame();
    show("game");
    state.raf = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseBanner.classList.toggle("hidden", !state.paused);
    if (!state.paused) {
      state.lastTs = 0;
      state.raf = requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    state.time += dt;
    const catcher = state.catcher;
    const speed = 420;

    if (state.pointerX != null) {
      const target = state.pointerX;
      const dx = target - catcher.x;
      catcher.x += dx * Math.min(1, dt * 12);
    } else {
      let dir = 0;
      if (state.keys.has("ArrowLeft") || state.keys.has("a") || state.keys.has("A")) dir -= 1;
      if (state.keys.has("ArrowRight") || state.keys.has("d") || state.keys.has("D")) dir += 1;
      catcher.vx = dir * speed;
      catcher.x += catcher.vx * dt;
    }

    catcher.x = Math.max(catcher.w / 2 + 8, Math.min(W - catcher.w / 2 - 8, catcher.x));

    state.spawnAcc += dt;
    const { spawnEvery } = difficulty();
    while (state.spawnAcc >= spawnEvery) {
      state.spawnAcc -= spawnEvery;
      spawnEntity();
    }

    for (const e of state.entities) {
      e.y += e.vy * dt;
      e.spin += e.spinSpeed * dt;
      e.wobble += dt * 2.2;
      e.x += Math.sin(e.wobble) * 18 * dt;
    }

    const top = catcher.y - catcher.h / 2;
    const left = catcher.x - catcher.w / 2;
    const right = catcher.x + catcher.w / 2;

    const next = [];
    for (const e of state.entities) {
      const hit =
        e.y + e.r >= top &&
        e.y - e.r <= catcher.y + catcher.h / 2 &&
        e.x >= left - 4 &&
        e.x <= right + 4;

      if (hit) {
        if (e.type === "star") {
          state.score += 10;
          burst(e.x, e.y, "#3ecfbf", 12);
        } else {
          state.lives -= 1;
          burst(e.x, e.y, "#e06b5c", 16);
          if (state.lives <= 0) {
            updateHud();
            endGame();
            return;
          }
        }
        updateHud();
        continue;
      }

      if (e.y - e.r > H + 20) {
        if (e.type === "star") {
          state.lives -= 1;
          burst(e.x, H - 10, "#f0b35a", 8);
          if (state.lives <= 0) {
            updateHud();
            endGame();
            return;
          }
          updateHud();
        }
        continue;
      }

      next.push(e);
    }
    state.entities = next;

    const aliveParticles = [];
    for (const p of state.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      if (p.age < p.life) aliveParticles.push(p);
    }
    state.particles = aliveParticles;
  }

  function drawStarShape(x, y, outer, inner, points, rotation) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = rotation + (i * Math.PI) / points - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(29, 74, 92, 0.35)");
    g.addColorStop(0.55, "rgba(7, 19, 31, 0.15)");
    g.addColorStop(1, "rgba(12, 36, 48, 0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 28; i += 1) {
      const x = (i * 97 + state.time * 8) % W;
      const y = (i * 53 + Math.sin(state.time + i) * 6) % (H * 0.7);
      ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
      ctx.fillStyle = "#e8f4ff";
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const e of state.entities) {
      if (e.type === "star") {
        const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.4);
        glow.addColorStop(0, "rgba(62, 207, 191, 0.55)");
        glow.addColorStop(1, "rgba(62, 207, 191, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        drawStarShape(e.x, e.y, e.r, e.r * 0.45, 5, e.spin);
        ctx.fillStyle = "#d8fff7";
        ctx.fill();
        ctx.fillStyle = "#f0b35a";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.2);
        glow.addColorStop(0, "rgba(224, 107, 92, 0.45)");
        glow.addColorStop(1, "rgba(224, 107, 92, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.spin);
        ctx.fillStyle = "#8a4a42";
        ctx.beginPath();
        ctx.moveTo(-e.r, 0);
        ctx.quadraticCurveTo(-e.r * 0.2, -e.r * 1.1, e.r * 0.9, -e.r * 0.35);
        ctx.quadraticCurveTo(e.r * 1.1, e.r * 0.2, e.r * 0.2, e.r * 0.9);
        ctx.quadraticCurveTo(-e.r * 0.6, e.r * 0.85, -e.r, 0);
        ctx.fill();
        ctx.fillStyle = "#c96b5c";
        ctx.beginPath();
        ctx.arc(-e.r * 0.15, -e.r * 0.1, e.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (const p of state.particles) {
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const c = state.catcher;
    const cg = ctx.createLinearGradient(c.x - c.w / 2, c.y, c.x + c.w / 2, c.y);
    cg.addColorStop(0, "#1a8f8a");
    cg.addColorStop(0.5, "#3ecfbf");
    cg.addColorStop(1, "#f0b35a");

    ctx.shadowColor = "rgba(62, 207, 191, 0.45)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = cg;
    ctx.beginPath();
    const left = c.x - c.w / 2;
    const right = c.x + c.w / 2;
    const top = c.y - c.h / 2;
    const bottom = c.y + c.h / 2;
    ctx.moveTo(left + 10, top);
    ctx.lineTo(right - 10, top);
    ctx.quadraticCurveTo(right + 6, c.y, right - 8, bottom);
    ctx.lineTo(left + 8, bottom);
    ctx.quadraticCurveTo(left - 6, c.y, left + 10, top);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(247, 251, 253, 0.85)";
    ctx.beginPath();
    ctx.ellipse(c.x, top + 3, c.w * 0.28, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop(ts) {
    if (!state.running || state.paused) return;
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    update(dt);
    if (!state.running) {
      draw();
      return;
    }
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function canvasXFromClient(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  }

  startBtn.addEventListener("click", startGame);
  retryBtn.addEventListener("click", startGame);
  homeBtn.addEventListener("click", () => {
    state.running = false;
    cancelAnimationFrame(state.raf);
    show("start");
  });

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
    state.keys.add(e.key);
    if (e.key === " " || e.key === "Spacebar") togglePause();
  });

  window.addEventListener("keyup", (e) => {
    state.keys.delete(e.key);
  });

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    state.pointerX = canvasXFromClient(e.clientX);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (state.pointerX == null && e.buttons === 0) return;
    state.pointerX = canvasXFromClient(e.clientX);
  });

  canvas.addEventListener("pointerup", () => {
    state.pointerX = null;
  });

  canvas.addEventListener("pointercancel", () => {
    state.pointerX = null;
  });

  seedStars();
  window.addEventListener("resize", seedStars);
})();
