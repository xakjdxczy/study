(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const BEST_KEY = "ski-safari-side-best";

  const STATE = { TITLE: "title", PLAY: "play", DEAD: "dead" };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const wrapTau = (a) => {
    const t = Math.PI * 2;
    a = ((a % t) + t) % t;
    return a > Math.PI ? a - t : a;
  };
  const SPIN_HOLD = 0.18;
  const LAND_TILT = 2.4;
  const LAND_TILT_FLIP = 2.7;

  function landingStumble(tilt, flips) {
    return Math.abs(tilt) > (flips > 0 ? LAND_TILT_FLIP : LAND_TILT);
  }

  let W = 1280;
  let H = 720;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(560, Math.round(window.innerWidth));
    H = Math.max(320, Math.round(window.innerHeight));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fillRoundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, rr);
    else {
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
    }
    ctx.fill();
  }

  const sfx = {
    ac: null,
    ready() {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === "suspended") this.ac.resume();
    },
    tone(f, d, type = "sine", v = 0.05) {
      if (!this.ac) return;
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(v, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ac.currentTime + d);
      o.connect(g).connect(this.ac.destination);
      o.start();
      o.stop(this.ac.currentTime + d);
    },
    jump() {
      this.tone(420, 0.1, "square", 0.03);
    },
    flip() {
      this.tone(660, 0.08, "triangle", 0.04);
      this.tone(880, 0.12, "sine", 0.03);
    },
    coin() {
      this.tone(980, 0.07, "triangle", 0.04);
    },
    fall() {
      this.tone(110, 0.22, "sawtooth", 0.06);
    },
    up() {
      this.tone(520, 0.08, "sine", 0.04);
    },
    mount() {
      this.tone(300, 0.1, "square", 0.04);
      this.tone(500, 0.14, "triangle", 0.04);
    },
    bury() {
      this.tone(70, 0.4, "sawtooth", 0.08);
    },
  };

  function best() {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  }
  function saveBest(n) {
    localStorage.setItem(BEST_KEY, String(n));
  }

  function blank() {
    return {
      state: STATE.TITLE,
      t: 0,
      camX: 0,
      dist: 0,
      coins: 0,
      multi: 1,
      score: 0,
      best: best(),
      p: {
        x: 220,
        y: 0,
        vy: 0,
        rot: 0,
        grounded: true,
        speed: 430,
        down: false,
        taps: 0,
        mounts: [],
        airRot0: 0,
        flips: 0,
      },
      hold: false,
      holdT: 0,
      avaX: -80,
      warn: 0,
      genX: 0,
      rocks: [],
      coinsL: [],
      rides: [],
      cabins: [],
      trees: [],
      ramps: [],
      flakes: Array.from({ length: 70 }, () => ({
        x: Math.random(),
        y: Math.random(),
        s: rand(0.8, 2.2),
        v: rand(28, 80),
      })),
      bits: [],
      spray: [],
      shake: 0,
    };
  }

  let G = blank();

  function topMount() {
    const m = G.p.mounts;
    return m.length ? m[m.length - 1] : null;
  }

  function groundY(x) {
    let y = H * 0.56 + x * 0.032;
    y += Math.sin(x * 0.0068) * 70;
    y += Math.sin(x * 0.0155) * 30;
    y += Math.sin(x * 0.029) * 12;
    for (const r of G.ramps) {
      if (x >= r.x && x <= r.x + r.w) {
        const t = (x - r.x) / r.w;
        y -= Math.sin(t * Math.PI) * r.h;
      }
    }
    for (const c of G.cabins) {
      if (x >= c.x - 6 && x <= c.x + c.w + 6) {
        const t = clamp((x - c.x) / c.w, 0, 1);
        const roof = t < 0.5 ? t * 2 : (1 - t) * 2;
        y -= 10 + c.h * roof;
      }
    }
    return y;
  }

  function slope(x) {
    const d = 8;
    return Math.atan2(groundY(x + d) - groundY(x - d), 2 * d);
  }

  function spawnAhead() {
    while (G.genX < G.p.x + W * 2.6) {
      const x = G.genX + rand(170, 360);
      const hard = clamp(G.dist / 180, 0, 1.4);
      const roll = Math.random();
      if (G.genX < 520) {
        G.trees.push({ x: x + rand(-40, 90), s: rand(0.75, 1.05), back: true });
      } else if (roll < 0.16) {
        G.ramps.push({ x, w: rand(150, 230), h: rand(50, 92) });
        const gy = groundY(x + 70);
        for (let i = 0; i < 8; i += 1) {
          G.coinsL.push({ x: x + 20 + i * 32, y: gy - 40 - Math.sin((i / 7) * Math.PI) * 62, got: false });
        }
      } else if (roll < 0.34 + hard * 0.08) {
        G.rocks.push({ x: x + 36, r: rand(16, 26), hit: false });
        if (Math.random() < 0.35 + hard * 0.2) G.rocks.push({ x: x + 120, r: rand(14, 22), hit: false });
      } else if (roll < 0.46) {
        G.cabins.push({ x, w: rand(92, 128), h: rand(48, 68) });
      } else if (roll < 0.6) {
        G.trees.push({ x, s: rand(0.9, 1.25) });
      } else if (roll < 0.78) {
        const gy = groundY(x) - 24;
        for (let i = 0; i < 7; i += 1) {
          G.coinsL.push({ x: x + i * 34, y: gy - Math.sin((i / 6) * Math.PI) * 48, got: false });
        }
      } else if (roll < 0.9) {
        G.rides.push({ x, type: pick(["penguin", "penguin", "yeti"]), taken: false, y: 0 });
      } else {
        G.rides.push({ x, type: "eagle", taken: false, y: -110 });
      }
      if (Math.random() < 0.55) G.trees.push({ x: x + rand(-90, 90), s: rand(0.65, 1.05), back: true });
      G.genX = x + 70;
    }
  }

  function resetPlay() {
    const keep = G.best;
    G = blank();
    G.best = keep;
    G.state = STATE.PLAY;
    G.p.x = 240;
    G.p.y = groundY(G.p.x);
    G.avaX = G.p.x - 520;
    G.camX = G.p.x - W * 0.34;
    G.genX = 280;
    spawnAhead();
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      G.bits.push({
        x,
        y,
        vx: rand(-90, 160),
        vy: rand(-180, -10),
        life: rand(0.22, 0.55),
        color,
      });
    }
  }

  function stumble() {
    if (G.p.down) return;
    if (G.p.mounts.length) {
      G.p.mounts.pop();
      G.shake = 7;
      burst(G.p.x, G.p.y, "#fff", 10);
      sfx.fall();
      return;
    }
    G.p.down = true;
    G.p.taps = 0;
    G.p.speed = Math.max(130, G.p.speed * 0.36);
    G.p.vy = 40;
    G.shake = 11;
    G.multi = 1;
    sfx.fall();
  }

  function stand() {
    G.p.down = false;
    G.p.taps = 0;
    G.p.speed = Math.max(G.p.speed, 320);
    sfx.up();
  }

  function bury() {
    if (G.state !== STATE.PLAY) return;
    G.state = STATE.DEAD;
    G.shake = 16;
    G.score = Math.floor(G.dist + G.coins * 8 + G.p.flips * 20);
    if (G.score > G.best) {
      G.best = G.score;
      saveBest(G.best);
    }
    sfx.bury();
  }

  function jump() {
    if (G.state !== STATE.PLAY) return;
    if (G.p.down) {
      G.p.taps += 1;
      G.p.speed += 10;
      if (G.p.taps >= 5) stand();
      return;
    }
    const mount = topMount();
    if (mount === "eagle") {
      G.p.grounded = false;
      G.p.vy = -620;
      sfx.jump();
      return;
    }
    if (!G.p.grounded) return;
    G.p.grounded = false;
    G.holdT = 0;
    G.p.vy = mount === "yeti" ? -900 : mount === "penguin" ? -840 : -760;
    G.p.airRot0 = G.p.rot;
    G.p.flips = 0;
    sfx.jump();
  }

  function update(dt) {
    G.t += dt;
    G.shake = Math.max(0, G.shake - dt * 26);
    G.flakes.forEach((f) => {
      f.x -= dt * 0.1;
      f.y += (f.v * dt) / H;
      if (f.y > 1 || f.x < -0.05) {
        f.y = -0.04;
        f.x = Math.random();
      }
    });
    G.bits = G.bits.filter((b) => {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 340 * dt;
      return b.life > 0;
    });
    G.spray = G.spray.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      return s.life > 0;
    });
    if (G.state !== STATE.PLAY) return;
    if (!G.hold) G.holdT = 0;

    const p = G.p;
    const mount = topMount();
    const sl = slope(p.x);
    const downhill = clamp(-sl, -0.12, 0.58);
    let target = 380 + downhill * 440 + G.dist * 0.35;
    if (mount === "penguin") target += 170;
    if (mount === "yeti") target += 90;
    if (mount === "eagle") target += 40;
    if (p.down) target = 145;
    p.speed += (target - p.speed) * Math.min(1, dt * 1.7);
    p.speed = clamp(p.speed, 90, 1000);
    p.x += p.speed * dt;
    G.dist = p.x / 18;

    if (p.grounded && !p.down && Math.random() < dt * 22) {
      G.spray.push({
        x: p.x - 18,
        y: p.y - 4,
        vx: rand(-80, -20),
        vy: rand(-40, 10),
        life: rand(0.15, 0.32),
      });
    }

    if (!p.grounded) {
      const grav = mount === "eagle" ? 980 : mount === "penguin" ? 1750 : 2100;
      p.vy += grav * dt;
      p.y += p.vy * dt;
      if (G.hold) G.holdT += dt;
      else G.holdT = 0;
      if (G.hold && G.holdT >= SPIN_HOLD) p.rot -= 7.4 * dt;
      const spun = Math.abs(p.rot - p.airRot0);
      const flips = Math.floor((spun + 0.35) / (Math.PI * 2));
      if (flips > p.flips) {
        p.flips = flips;
        p.speed += 80;
        G.multi = Math.min(8, G.multi + 1);
        G.score += 40 * G.multi;
        sfx.flip();
        burst(p.x, p.y, "#ffe27a", 12);
      }
      const gy = groundY(p.x);
      if (p.y >= gy && p.vy > 0) {
        p.y = gy;
        p.grounded = true;
        p.vy = 0;
        const land = Math.abs(wrapTau(p.rot - sl));
        p.rot = sl;
        if (!mount && landingStumble(land, p.flips)) stumble();
        else p.speed += 28;
      }
    } else {
      p.y = groundY(p.x);
      p.rot += (sl - p.rot) * Math.min(1, dt * 14);
    }

    const gap = p.x - G.avaX;
    const avaWant = p.down ? 240 : p.speed * (gap > 420 ? 0.92 : 0.76);
    G.avaX += avaWant * dt;
    if (gap > 620) G.avaX = p.x - 620;
    if (p.x - G.avaX < 58) bury();
    G.warn = p.x - G.avaX < 240 ? G.warn + dt : 0;

    spawnAhead();

    G.rocks.forEach((r) => {
      if (r.hit || Math.abs(r.x - p.x) > 28) return;
      if (p.y < groundY(r.x) - 36) return;
      if (mount === "yeti") {
        r.hit = true;
        burst(r.x, groundY(r.x), "#c5d0dc", 16);
        return;
      }
      r.hit = true;
      stumble();
    });
    G.trees.forEach((tr) => {
      if (tr.back || tr.hit || Math.abs(tr.x - p.x) > 22) return;
      if (p.y < groundY(tr.x) - 52) return;
      tr.hit = true;
      stumble();
    });
    G.cabins.forEach((c) => {
      if (c.hit) return;
      if (p.x < c.x + 8 || p.x > c.x + c.w - 8) return;
      const roof = groundY(p.x);
      if (p.grounded && p.y <= roof + 8) return;
      if (!p.grounded && p.y < roof - 8) return;
      if (p.y > roof + 16) {
        c.hit = true;
        stumble();
      }
    });
    G.coinsL.forEach((c) => {
      if (c.got) return;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 38) {
        c.got = true;
        G.coins += 1;
        G.score += 10 * G.multi;
        sfx.coin();
        burst(c.x, c.y, "#ffd24a", 8);
      }
    });
    G.rides.forEach((m) => {
      if (m.taken) return;
      const my = groundY(m.x) + (m.y || 0);
      const reach = m.type === "eagle" ? 70 : 34;
      if (Math.abs(m.x - p.x) > reach) return;
      if (m.type === "eagle" && p.y > my + 20) return;
      if (m.type !== "eagle" && p.y > my - 8) {
        m.taken = true;
        p.mounts.push(m.type);
        p.down = false;
        p.speed += 90;
        sfx.mount();
      } else if (m.type === "eagle" && p.y < my + 36) {
        m.taken = true;
        p.mounts.push("eagle");
        p.grounded = false;
        p.vy = Math.min(p.vy, -200);
        sfx.mount();
      }
    });

    G.camX += (p.x - W * 0.32 - G.camX) * Math.min(1, dt * 6);
    G.rocks = G.rocks.filter((r) => r.x > G.camX - 80);
    G.coinsL = G.coinsL.filter((c) => c.x > G.camX - 80 && !c.got);
    G.rides = G.rides.filter((m) => m.x > G.camX - 80);
    G.cabins = G.cabins.filter((c) => c.x + c.w > G.camX - 40);
    G.trees = G.trees.filter((t) => t.x > G.camX - 80);
    G.ramps = G.ramps.filter((r) => r.x + r.w > G.camX - 40);
  }

  function wx(x) {
    return x - G.camX;
  }
  function wy(y) {
    return y - (groundY(G.p.x) - H * 0.66);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2a7ec4");
    g.addColorStop(0.45, "#6eb7e6");
    g.addColorStop(1, "#d7eefc");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffe9a0";
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.14, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,250,220,0.35)";
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.14, 58, 0, Math.PI * 2);
    ctx.fill();

    const layers = [
      { k: 0.12, y: H * 0.42, h: 180, c: "#3d6f8c" },
      { k: 0.22, y: H * 0.48, h: 160, c: "#4f8aa3" },
      { k: 0.38, y: H * 0.54, h: 140, c: "#6aa4b8" },
    ];
    layers.forEach((L, li) => {
      ctx.fillStyle = L.c;
      ctx.beginPath();
      ctx.moveTo(-40, H);
      const shift = -((G.camX * L.k) % 280);
      for (let i = -1; i < 10; i += 1) {
        const x = shift + i * 280;
        ctx.lineTo(x, L.y + (li % 2 ? 18 : 0));
        ctx.lineTo(x + 70, L.y - L.h * 0.55);
        ctx.lineTo(x + 140, L.y - L.h * 0.18);
        ctx.lineTo(x + 210, L.y - L.h * 0.72);
        ctx.lineTo(x + 280, L.y + 8);
      }
      ctx.lineTo(W + 40, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = -1; i < 10; i += 1) {
        const x = shift + i * 280;
        ctx.beginPath();
        ctx.moveTo(x + 210, L.y - L.h * 0.72);
        ctx.lineTo(x + 188, L.y - L.h * 0.48);
        ctx.lineTo(x + 232, L.y - L.h * 0.48);
        ctx.fill();
      }
    });

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 290 - G.camX * 0.15) % (W + 240)) - 80;
      const cy = 48 + (i % 3) * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 46, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 28, cy + 4, 34, 13, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 26, cy + 5, 28, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround() {
    const step = 14;
    const x0 = G.camX - 50;
    const x1 = G.camX + W + 90;
    ctx.beginPath();
    ctx.moveTo(wx(x0), H + 40);
    ctx.lineTo(wx(x0), wy(groundY(x0)));
    for (let x = x0; x <= x1; x += step) ctx.lineTo(wx(x), wy(groundY(x)));
    ctx.lineTo(wx(x1), H + 40);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.45, "#eef7ff");
    g.addColorStop(1, "#b9d4e8");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(150,186,210,0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wx(x0), wy(groundY(x0)));
    for (let x = x0; x <= x1; x += step) ctx.lineTo(wx(x), wy(groundY(x)));
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx(x0), wy(groundY(x0)) + 7);
    for (let x = x0; x <= x1; x += step) ctx.lineTo(wx(x), wy(groundY(x)) + 7);
    ctx.stroke();
  }

  function drawTree(x, s, back) {
    const gx = wx(x);
    const gy = wy(groundY(x));
    ctx.fillStyle = "#6a4020";
    ctx.fillRect(gx - 5 * s, gy - 22 * s, 10 * s, 22 * s);
    const greens = back ? ["#245c3c", "#2d7048", "#348054"] : ["#14663a", "#1b7d45", "#239352"];
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = greens[i];
      ctx.beginPath();
      ctx.moveTo(gx, gy - (86 - i * 18) * s);
      ctx.lineTo(gx + (30 - i * 5) * s, gy - (30 - i * 11) * s);
      ctx.lineTo(gx - (30 - i * 5) * s, gy - (30 - i * 11) * s);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(gx, gy - 86 * s);
    ctx.lineTo(gx + 11 * s, gy - 70 * s);
    ctx.lineTo(gx - 11 * s, gy - 70 * s);
    ctx.fill();
  }

  function drawRock(r) {
    if (r.hit) return;
    const x = wx(r.x);
    const y = wy(groundY(r.x));
    ctx.fillStyle = "#7f8b99";
    ctx.beginPath();
    ctx.ellipse(x, y - 7, r.r, r.r * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9aa5b2";
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 12, r.r * 0.42, r.r * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 14, r.r * 0.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCabin(c) {
    const x = wx(c.x);
    const base = wy(groundY(c.x + c.w * 0.12));
    ctx.fillStyle = "#8b4a28";
    ctx.fillRect(x, base - c.h, c.w, c.h);
    ctx.fillStyle = "#c96a3d";
    for (let i = 0; i < 5; i += 1) ctx.fillRect(x + 4, base - c.h + 8 + i * 10, c.w - 8, 3);
    ctx.fillStyle = "#6b2e18";
    ctx.beginPath();
    ctx.moveTo(x - 10, base - c.h);
    ctx.lineTo(x + c.w / 2, base - c.h - 32);
    ctx.lineTo(x + c.w + 10, base - c.h);
    ctx.fill();
    ctx.fillStyle = "#fff6e0";
    ctx.beginPath();
    ctx.moveTo(x - 2, base - c.h + 2);
    ctx.lineTo(x + c.w / 2, base - c.h - 24);
    ctx.lineTo(x + c.w + 2, base - c.h + 2);
    ctx.fill();
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(x + 14, base - c.h + 18, 18, 16);
    ctx.strokeStyle = "#5a2a16";
    ctx.strokeRect(x + 14, base - c.h + 18, 18, 16);
    ctx.fillStyle = "#5a2a16";
    ctx.fillRect(x + c.w - 30, base - 30, 18, 30);
  }

  function drawPenguin(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#1a2230";
    ctx.beginPath();
    ctx.ellipse(0, -12, 13, 17, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6f9ff";
    ctx.beginPath();
    ctx.ellipse(3, -10, 8, 11, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e07a3d";
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.lineTo(22, -15);
    ctx.lineTo(10, -13);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(4, -18, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawYeti(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#eef4f8";
    ctx.beginPath();
    ctx.ellipse(0, -20, 20, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d7e2ea";
    ctx.beginPath();
    ctx.ellipse(-16, -10, 8, 12, -0.5, 0, Math.PI * 2);
    ctx.ellipse(16, -10, 8, 12, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2218";
    ctx.beginPath();
    ctx.arc(-6, -24, 2.2, 0, Math.PI * 2);
    ctx.arc(6, -24, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c45c6a";
    ctx.beginPath();
    ctx.arc(0, -16, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEagle(x, y, flap) {
    ctx.save();
    ctx.translate(x, y);
    const wing = Math.sin(flap) * 10;
    ctx.fillStyle = "#8a5a2a";
    ctx.beginPath();
    ctx.ellipse(-18, -4 + wing * 0.2, 22, 7, -0.25 + wing * 0.04, 0, Math.PI * 2);
    ctx.ellipse(18, -4 + wing * 0.2, 22, 7, 0.25 - wing * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c48a48";
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.arc(8, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0a020";
    ctx.beginPath();
    ctx.moveTo(13, -4);
    ctx.lineTo(22, -2);
    ctx.lineTo(13, 1);
    ctx.fill();
    ctx.restore();
  }

  function drawSven(p) {
    const x = wx(p.x);
    const y = wy(p.y);
    ctx.save();
    ctx.translate(x, y - (p.down ? 10 : 18));
    ctx.rotate(p.down ? 1.2 : p.rot);
    const mounts = p.mounts || [];
    mounts.forEach((m, i) => {
      const yy = 22 + i * 16;
      if (m === "penguin") drawPenguin(2, yy, 1);
      if (m === "yeti") drawYeti(0, yy + 6, 1);
      if (m === "eagle") drawEagle(0, yy - 6, G.t * 10);
    });
    ctx.fillStyle = "rgba(40,70,90,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 22, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b4424";
    ctx.fillRect(-22, 12, 46, 7);
    ctx.fillStyle = "#8a5a2e";
    ctx.fillRect(-22, 11, 46, 2);
    ctx.fillStyle = "#2f6fb8";
    ctx.beginPath();
    fillRoundRect(-9, -4, 18, 18, 5);
    ctx.fillStyle = "#e07a3d";
    ctx.beginPath();
    ctx.arc(0, -14, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3d2b0";
    ctx.beginPath();
    ctx.arc(6, -12, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c45c20";
    ctx.beginPath();
    ctx.arc(-2, -20, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#d8dde4";
    ctx.beginPath();
    ctx.ellipse(-9, -24, 4, 7, -0.5, 0, Math.PI * 2);
    ctx.ellipse(6, -25, 4, 7, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2218";
    ctx.beginPath();
    ctx.arc(8, -13, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAvalanche() {
    const wall = wx(G.avaX);
    const g = ctx.createLinearGradient(0, 0, wall + 50, 0);
    g.addColorStop(0, "rgba(232,242,250,0.55)");
    g.addColorStop(0.55, "rgba(244,250,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0.98)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Math.max(0, wall + 36), H);
    for (let i = 0; i < 26; i += 1) {
      const yy = ((i * 61 + G.t * 140) % (H + 120)) - 50;
      const xx = wall - 18 + Math.sin(G.t * 9 + i * 1.7) * 28;
      ctx.fillStyle = i % 3 === 0 ? "#e8f2fa" : i % 3 === 1 ? "#ffffff" : "#d5e6f4";
      ctx.beginPath();
      ctx.ellipse(xx, yy, 42 + (i % 6) * 7, 28 + (i % 4) * 4, G.t * 1.4 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(120,160,190,0.28)";
    ctx.fillRect(Math.max(0, wall - 6), 0, 16, H);
    if (G.p.speed > 500) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const y = 40 + i * (H / 9);
        ctx.beginPath();
        ctx.moveTo(wall + 40, y);
        ctx.lineTo(wall + 110 + (i % 3) * 20, y + 4);
        ctx.stroke();
      }
    }
  }

  function pill(text, x, y, fill = "rgba(255,255,255,0.86)", color = "#17324a") {
    ctx.font = "800 16px Nunito, sans-serif";
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = fill;
    fillRoundRect(x, y, w, 28, 14);
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(text, x + 11, y + 15);
  }

  function drawHud() {
    if (G.state === STATE.TITLE) return;
    const pad = 14;
    pill(`${Math.floor(G.dist)} 米`, pad, pad);
    pill(`金币 ${G.coins}`, pad + 118, pad, "#fff4c8", "#8a5a10");
    pill(`x${G.multi}`, pad + 236, pad, "#ffe08a", "#8a5a10");
    pill(`最佳 ${G.best}`, W - 156, pad);
    if (G.warn > 0 && Math.floor(G.t * 8) % 2 === 0) {
      ctx.fillStyle = "#e24b3a";
      ctx.beginPath();
      ctx.moveTo(pad + 16, pad + 42);
      ctx.lineTo(pad + 36, pad + 76);
      ctx.lineTo(pad, pad + 76);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "900 18px sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("!", pad + 12, pad + 68);
      ctx.font = "800 14px Nunito, sans-serif";
      ctx.fillStyle = "#e24b3a";
      ctx.fillText("雪崩！", pad + 42, pad + 66);
    }
    if (G.p.down && G.state === STATE.PLAY) {
      ctx.fillStyle = "rgba(20,30,50,0.58)";
      fillRoundRect(W / 2 - 158, 54, 316, 42, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "800 18px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`摔倒了！连点爬起来  ${G.p.taps}/5`, W / 2, 76);
      ctx.textAlign = "left";
    }
  }

  function panel(title, lines, hint) {
    const w = Math.min(500, W - 40);
    const h = 96 + lines.length * 26;
    const x = (W - w) / 2;
    const y = H * 0.18;
    ctx.fillStyle = "rgba(16, 34, 56, 0.8)";
    fillRoundRect(x, y, w, h, 22);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff8e3";
    ctx.font = "900 36px Nunito, sans-serif";
    ctx.fillText(title, W / 2, y + 48);
    ctx.fillStyle = "#d9e7f7";
    ctx.font = "700 16px Nunito, sans-serif";
    lines.forEach((line, i) => ctx.fillText(line, W / 2, y + 84 + i * 26));
    ctx.fillStyle = "#f0d36a";
    ctx.font = "800 17px Nunito, sans-serif";
    ctx.fillText(hint, W / 2, y + h - 22);
    ctx.textAlign = "left";
  }

  function draw() {
    ctx.save();
    if (G.shake) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    drawSky();
    G.trees.filter((t) => t.back).forEach((t) => drawTree(t.x, t.s, true));
    drawGround();
    G.cabins.forEach(drawCabin);
    G.rocks.forEach(drawRock);
    G.trees.filter((t) => !t.back).forEach((t) => drawTree(t.x, t.s, false));
    G.coinsL.forEach((c) => {
      if (c.got) return;
      const pulse = 1 + Math.sin(G.t * 8 + c.x) * 0.08;
      ctx.fillStyle = "#f0c14a";
      ctx.beginPath();
      ctx.arc(wx(c.x), wy(c.y), 8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff2b0";
      ctx.beginPath();
      ctx.arc(wx(c.x) - 2, wy(c.y) - 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c48a10";
      ctx.stroke();
    });
    G.rides.forEach((m) => {
      if (m.taken) return;
      const y = groundY(m.x) + (m.y || 0);
      if (m.type === "penguin") drawPenguin(wx(m.x), wy(y));
      else if (m.type === "yeti") drawYeti(wx(m.x), wy(y));
      else drawEagle(wx(m.x), wy(y), G.t * 9);
    });
    G.spray.forEach((s) => {
      ctx.globalAlpha = clamp(s.life * 3, 0, 0.7);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(wx(s.x), wy(s.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    if (G.state !== STATE.TITLE) drawSven(G.p);
    G.bits.forEach((b) => {
      ctx.globalAlpha = clamp(b.life * 2.2, 0, 1);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(wx(b.x), wy(b.y), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    G.flakes.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x * W, f.y * H, f.s, 0, Math.PI * 2);
      ctx.fill();
    });
    if (G.state !== STATE.TITLE) drawAvalanche();
    else {
      G.avaX = 90 + Math.sin(G.t * 0.7) * 12;
      G.camX = 40;
      G.p.x = 280;
      G.p.y = groundY(280);
      G.p.rot = slope(280);
      drawAvalanche();
      drawSven(G.p);
    }
    drawHud();
    if (G.state === STATE.TITLE) {
      panel(
        "滑雪大冒险",
        ["一直往右边滑，左边雪崩在追", "点一下跳跃，按住可以后空翻", "摔倒了连点屏幕爬起来", "碰到企鹅 / 雪怪 / 老鹰可以骑上去", `最佳 ${G.best}`],
        "点屏幕或按空格开始逃"
      );
    } else if (G.state === STATE.DEAD) {
      panel(
        "被雪埋了",
        [`逃了 ${Math.floor(G.dist)} 米`, `捡到 ${G.coins} 个金币`, `得分 ${G.score}`, G.score >= G.best && G.score > 0 ? "新纪录！" : `最佳 ${G.best}`],
        "再逃一次"
      );
    }
    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    sfx.ready();
    if (G.state === STATE.TITLE || G.state === STATE.DEAD) resetPlay();
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === "ArrowUp") {
      e.preventDefault();
      G.hold = true;
      if (G.state !== STATE.PLAY) start();
      else jump();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.key === "ArrowUp") G.hold = false;
  });
  const down = () => {
    sfx.ready();
    G.hold = true;
    if (G.state !== STATE.PLAY) start();
    else jump();
  };
  const up = () => {
    G.hold = false;
  };
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    down();
  });
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", up);

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);
  window.PipSki = {
    start,
    jump,
    getState: () => G.state,
    getDist: () => G.dist,
    landingStumble,
    wrapTau,
  };
})();
