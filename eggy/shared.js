(function (root) {
  const COLORS = ["#ff6b9d", "#ffd166", "#7ee0c6", "#8ec5ff", "#c9a0ff", "#ff9f6b"];
  const NAMES = ["蛋蛋", "团子", "糯米", "波波", "豆豆", "果果", "皮皮", "圆圆"];

  const CFG = {
    gravity: 2200,
    move: 340,
    air: 280,
    jump: -920,
    coyote: 0.16,
    jumpBuf: 0.16,
    dash: 620,
    dashT: 0.18,
    dashCd: 0.7,
    maxFall: 1100,
    w: 30,
    h: 36,
    ground: 420,
    finishX: 3520,
    tick: 1 / 20,
    maxHumans: 6,
    minField: 4,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function buildMap() {
    const plats = [];
    const hazards = [];
    const checks = [80];
    const add = (x, y, w, h, kind, extra) => {
      plats.push(Object.assign({ x, y, w, h, kind: kind || "solid" }, extra || {}));
    };

    add(-80, CFG.ground, 700, 80);
    add(560, 400, 200, 28);
    add(820, 360, 160, 28);
    add(1080, 420, 260, 36);
    hazards.push({ kind: "hammer", x: 1180, y: 300, r: 46, arm: 70, spin: 1.8 });
    add(1420, 380, 140, 24, "moveX", { amp: 70, period: 2.4 });
    add(1680, 300, 120, 24);
    add(1680, 420, 200, 28, "spring");
    add(1960, 360, 220, 26, "conveyor", { dir: 1 });
    add(2260, 320, 90, 20, "vanish", { period: 2.2, offset: 0 });
    add(2380, 320, 90, 20, "vanish", { period: 2.2, offset: 1.1 });
    add(2500, 320, 90, 20, "vanish", { period: 2.2, offset: 0.4 });
    add(2680, 400, 240, 30);
    hazards.push({ kind: "spinner", x: 2800, y: 400, r: 54, spin: -2.4 });
    add(3000, 360, 110, 22);
    add(3140, 300, 110, 22);
    add(3280, 240, 110, 22);
    add(3440, 400, 280, 50);
    checks.push(1100, 1680, 2260, 3000);

    return { plats, hazards, checks, finishX: CFG.finishX, floor: 520 };
  }

  const MAP = buildMap();

  function platBox(p, t) {
    let x = p.x;
    let y = p.y;
    if (p.kind === "moveX") x += Math.sin((t * Math.PI * 2) / p.period) * p.amp;
    if (p.kind === "moveY") y += Math.sin((t * Math.PI * 2) / p.period) * p.amp;
    return { x, y, w: p.w, h: p.h };
  }

  function platOn(p, t) {
    if (p.kind !== "vanish") return true;
    const ph = ((t + (p.offset || 0)) % p.period) / p.period;
    return ph < 0.62;
  }

  function blankPlayer(id, name, color, bot) {
    return {
      id,
      name: name || "蛋仔",
      color: color || COLORS[0],
      bot: !!bot,
      x: 60 + (id % 6) * 36,
      y: CFG.ground - CFG.h,
      vx: 0,
      vy: 0,
      facing: 1,
      on: true,
      coy: CFG.coyote,
      jbuf: 0,
      dash: 0,
      cd: 0,
      ck: 80,
      fin: 0,
      hurt: 0,
      squish: 1,
    };
  }

  function nearestCheck(x) {
    let best = MAP.checks[0];
    for (const c of MAP.checks) if (c <= x + 10) best = c;
    return best;
  }

  function respawn(p) {
    p.x = nearestCheck(p.ck || p.x) - 10;
    p.y = CFG.ground - CFG.h;
    p.on = true;
    p.vx = 0;
    p.vy = 0;
    p.on = false;
    p.hurt = 0.35;
  }

  function collideHazards(p, t) {
    const box = { x: p.x, y: p.y, w: CFG.w, h: CFG.h };
    for (const h of MAP.hazards) {
      if (h.kind === "hammer") {
        const ang = t * h.spin;
        const hx = h.x + Math.cos(ang) * h.arm;
        const hy = h.y + Math.sin(ang) * h.arm;
        const dx = p.x + CFG.w / 2 - hx;
        const dy = p.y + CFG.h / 2 - hy;
        if (dx * dx + dy * dy < (h.r + 10) * (h.r + 10)) {
          p.vx += Math.cos(ang) * 420;
          p.vy = -220;
          p.hurt = 0.25;
        }
      }
      if (h.kind === "spinner") {
        const dx = p.x + CFG.w / 2 - h.x;
        const dy = p.y + CFG.h - h.y;
        if (Math.abs(dx) < h.r && dy > -8 && dy < 28) {
          p.vx += (dx >= 0 ? 1 : -1) * 380;
          p.vy = -260;
          p.hurt = 0.2;
        }
      }
    }
  }

  function stepPlayer(p, input, dt, t) {
    if (p.fin) return p;
    p.hurt = Math.max(0, p.hurt - dt);
    p.cd = Math.max(0, p.cd - dt);
    p.dash = Math.max(0, p.dash - dt);
    p.coy = p.on ? CFG.coyote : Math.max(0, p.coy - dt);

    const left = !!input.l;
    const right = !!input.r;
    const want = (right ? 1 : 0) - (left ? 1 : 0);
    if (want) p.facing = want;
    if (input.d && p.cd <= 0 && p.dash <= 0) {
      p.dash = CFG.dashT;
      p.cd = CFG.dashCd;
      p.vy = Math.min(p.vy, -40);
    }
    const accel = p.on ? CFG.move : CFG.air;
    if (p.dash > 0) p.vx = p.facing * CFG.dash;
    else if (p.hurt <= 0) p.vx += (want * accel * 1.8 - p.vx) * Math.min(1, dt * 10);

    p.jbuf = input.j ? CFG.jumpBuf : Math.max(0, (p.jbuf || 0) - dt);
    if (p.jbuf > 0 && (p.on || p.coy > 0) && p.vy >= -80) {
      p.vy = CFG.jump;
      p.on = false;
      p.coy = 0;
      p.jbuf = 0;
      p.squish = 0.78;
    }

    const prevY = p.y;
    p.vy = clamp(p.vy + CFG.gravity * dt, -1200, CFG.maxFall);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.squish += (1 - p.squish) * Math.min(1, dt * 10);

    p.on = false;
    const body = { x: p.x, y: p.y, w: CFG.w, h: CFG.h };
    for (const plat of MAP.plats) {
      if (!platOn(plat, t)) continue;
      const b = platBox(plat, t);
      if (!aabb(body, b)) continue;
      const overlapX = Math.min(p.x + CFG.w, b.x + b.w) - Math.max(p.x, b.x);
      const overlapY = Math.min(p.y + CFG.h, b.y + b.h) - Math.max(p.y, b.y);
      const prevFeet = prevY + CFG.h;
      const fromAbove = p.vy >= -60 && prevFeet <= b.y + 28;
      if (fromAbove && overlapX > 3) {
        p.y = b.y - CFG.h;
        p.vy = 0;
        p.on = true;
        body.y = p.y;
        if (plat.kind === "spring") {
          p.vy = CFG.jump * 1.18;
          p.on = false;
        }
        if (plat.kind === "conveyor") p.x += (plat.dir || 1) * 90 * dt;
        if (plat.kind === "ice") p.vx *= 1.02;
      } else if (overlapY + 2 < overlapX) {
        if (p.x + CFG.w / 2 < b.x + b.w / 2) {
          p.x = b.x - CFG.w;
          p.vx = Math.min(0, p.vx);
        } else {
          p.x = b.x + b.w;
          p.vx = Math.max(0, p.vx);
        }
        body.x = p.x;
      }
    }

    collideHazards(p, t);
    if (p.x > (p.ck || 0) + 40) p.ck = nearestCheck(p.x);
    if (p.y > MAP.floor || p.x < -80) respawn(p);
    if (p.x + CFG.w >= MAP.finishX && p.y < 460) p.fin = t;
    p.x = clamp(p.x, -40, MAP.finishX + 80);
    return p;
  }

  function botInput(p, t) {
    const look = p.x + 54;
    let jump = false;
    let dash = false;
    for (const plat of MAP.plats) {
      const b = platBox(plat, t);
      if (b.x > p.x + 10 && b.x < look + 40 && b.y < p.y - 8) jump = true;
    }
    for (const h of MAP.hazards) {
      if (Math.abs(h.x - (p.x + 40)) < 70) {
        jump = true;
        dash = Math.random() < 0.4;
      }
    }
    if (p.y > 390) jump = true;
    return { l: false, r: true, j: jump, d: dash };
  }

  function publicPlayer(p) {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      bot: !!p.bot,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx),
      vy: Math.round(p.vy),
      facing: p.facing,
      on: p.on,
      dash: p.dash,
      fin: p.fin,
      hurt: p.hurt,
      squish: p.squish,
    };
  }

  const api = { COLORS, NAMES, CFG, MAP, clamp, aabb, platBox, platOn, blankPlayer, stepPlayer, botInput, publicPlayer, nearestCheck, respawn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Eggy = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
