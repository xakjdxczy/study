(function (root) {
  const COLORS = ["#7ee0ff", "#ffd65a", "#ff7ab0", "#9dff8a", "#d2a8ff", "#ff9f6b"];
  const NAMES = ["雷霆", "彗星", "猎鹰", "流星", "苍穹", "闪电", "银翼", "火羽"];

  const CFG = {
    W: 720,
    H: 1100,
    tick: 1 / 30,
    playerSpeed: 460,
    autoFire: 0.16,
    holdFire: 0.08,
    maxPow: 5,
    lives: 3,
    bombs: 4,
    maxBombs: 6,
    inv: 2.4,
    hitR: 8,
    maxHumans: 4,
    minField: 2,
    stageLen: 78,
    stages: 3,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function blankPlayer(id, name, color, bot) {
    const slot = (id - 1) % 4;
    return {
      id,
      name: name || "战机",
      color: color || COLORS[slot],
      bot: !!bot,
      x: CFG.W * (0.28 + slot * 0.16),
      y: CFG.H - 150,
      vx: 0,
      vy: 0,
      pow: 1,
      bombs: CFG.bombs,
      lives: CFG.lives,
      score: 0,
      hp: 1,
      fire: 0,
      bombCd: 0,
      inv: CFG.inv,
      dead: 0,
      shield: 0,
      wantX: 0,
      wantY: 0,
    };
  }

  function blankWorld() {
    return {
      t: 0,
      stage: 1,
      wave: 1,
      nid: 1,
      enemies: [],
      bullets: [],
      drops: [],
      boom: [],
      pops: [],
      flash: 0,
      over: false,
      win: false,
      bossDone: false,
    };
  }

  function nextId(world) {
    world.nid += 1;
    return world.nid;
  }

  function addBullet(world, b) {
    world.bullets.push(Object.assign({ id: nextId(world), life: 2.4 }, b));
  }

  function addEnemy(world, e) {
    world.enemies.push(
      Object.assign(
        {
          id: nextId(world),
          hp: 1,
          fire: 0.6,
          t: 0,
          vx: 0,
          vy: 90,
        },
        e
      )
    );
  }

  function weaponShots(p) {
    const x = p.x;
    const y = p.y - 18;
    const shots = [];
    const pow = clamp(p.pow | 0, 1, CFG.maxPow);
    if (pow === 1) shots.push({ x: x, y: y, vx: 0, vy: -760, kind: "n" });
    if (pow === 2) {
      shots.push({ x: x - 10, y: y, vx: 0, vy: -780, kind: "n" });
      shots.push({ x: x + 10, y: y, vx: 0, vy: -780, kind: "n" });
    }
    if (pow === 3) {
      shots.push({ x: x, y: y, vx: 0, vy: -800, kind: "n" });
      shots.push({ x: x - 12, y: y + 4, vx: -160, vy: -760, kind: "n" });
      shots.push({ x: x + 12, y: y + 4, vx: 160, vy: -760, kind: "n" });
    }
    if (pow >= 4) {
      shots.push({ x: x, y: y, vx: 0, vy: -840, kind: "n" });
      shots.push({ x: x - 14, y: y + 2, vx: -120, vy: -800, kind: "n" });
      shots.push({ x: x + 14, y: y + 2, vx: 120, vy: -800, kind: "n" });
      shots.push({ x: x - 22, y: y + 8, vx: -260, vy: -720, kind: "n" });
      shots.push({ x: x + 22, y: y + 8, vx: 260, vy: -720, kind: "n" });
    }
    if (pow >= 5) {
      shots.push({ x: x - 8, y: y - 6, vx: 0, vy: -980, kind: "laser" });
      shots.push({ x: x + 8, y: y - 6, vx: 0, vy: -980, kind: "laser" });
    }
    return shots;
  }

  function firePlayer(world, p) {
    weaponShots(p).forEach((s) => {
      addBullet(world, {
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        side: 1,
        kind: s.kind,
        owner: p.id,
        dmg: s.kind === "laser" ? 2 : 1,
      });
    });
  }

  function useBomb(world, p) {
    if (p.bombs <= 0 || p.bombCd > 0 || p.dead > 0 || p.lives <= 0) return false;
    p.bombs -= 1;
    p.bombCd = 0.55;
    world.flash = 0.48;
    world.bullets = world.bullets.filter((b) => b.side === 1);
    world.enemies.forEach((e) => {
      e.hp -= e.boss ? 10 : 5;
    });
    p.score += 80;
    world.boom = world.boom || [];
    world.boom.push({ x: p.x, y: p.y, t: 0.62, r: 210 });
    world.pops = world.pops || [];
    world.pops.push({ x: p.x, y: p.y - 40, t: 0.9, txt: "清屏", c: "#ffd65a" });
    return true;
  }

  function nearestPlayer(players, x, y) {
    let best = null;
    let bestD = 1e12;
    players.forEach((p) => {
      if (p.dead > 0) return;
      const d = dist2(p.x, p.y, x, y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    });
    return best;
  }

  function spawnDrop(world, x, y, force) {
    const roll = force || (Math.random() < 0.34 ? "pow" : Math.random() < 0.16 ? "bomb" : Math.random() < 0.14 ? "shield" : null);
    if (!roll) return;
    world.drops.push({ id: nextId(world), kind: roll, x: x, y: y, vy: 70 });
  }

  function collectDrop(p, drop, world) {
    let txt = "道具";
    let c = "#ffe27a";
    if (drop.kind === "pow") {
      p.pow = clamp(p.pow + 1, 1, CFG.maxPow);
      txt = "火力" + p.pow;
      c = "#7ee0ff";
    }
    if (drop.kind === "bomb") {
      p.bombs = clamp(p.bombs + 1, 0, CFG.maxBombs);
      txt = "炸弹+1";
      c = "#ffd65a";
    }
    if (drop.kind === "shield") {
      p.shield = 6.5;
      txt = "护盾";
      c = "#9dff8a";
    }
    p.score += 40;
    if (world) {
      world.pops = world.pops || [];
      world.pops.push({ x: p.x, y: p.y - 28, t: 0.85, txt: txt, c: c });
    }
  }

  function spawnWave(world, players) {
    const t = world.t;
    const stage = world.stage;
    const beat = t % CFG.stageLen;
    const hard = 1 + (stage - 1) * 0.35;
    world.wave = beat < 18 ? 1 : beat < 40 ? 2 : beat < 58 ? 3 : 4;

    if (beat < 56 && Math.abs((t * 10) % 1) < 0.08) {
      /* paced by callers using leftover timers */
    }

    if (world._next == null) world._next = 0.4;
    if (t < world._next) return;
    const gap = world.wave === 4 ? 1.1 : clamp(0.85 - stage * 0.08, 0.38, 0.9);
    world._next = t + gap;

    if (world.wave === 4) {
      if (!world.bossDone && !world.enemies.some((e) => e.boss)) {
        world.bossDone = true;
        addEnemy(world, {
          kind: "boss",
          boss: true,
          x: CFG.W / 2,
          y: 120,
          hp: 70 + stage * 22,
          vy: 20,
          fire: 0.2,
        });
      }
      return;
    }

    const lane = 70 + Math.random() * (CFG.W - 140);
    const pick = Math.random();
    const easy = world.stage === 1 && (world.wave === 1 || world.t < 24);
    if (easy || world.wave === 1 || pick < 0.42) {
      addEnemy(world, { kind: "scout", x: lane, y: -30, hp: 1, vy: 128 * hard });
    } else if (pick < 0.72) {
      addEnemy(world, { kind: "zig", x: lane, y: -30, hp: 2, vy: 110 * hard, amp: 70 });
    } else if (pick < 0.9) {
      addEnemy(world, { kind: "gun", x: lane, y: -36, hp: 3, vy: 74 * hard, fire: 1.15 });
    } else {
      const tgt = nearestPlayer(players, lane, 0);
      addEnemy(world, {
        kind: "dive",
        x: lane,
        y: -40,
        hp: 2,
        vy: 40,
        aimX: tgt ? tgt.x : CFG.W / 2,
        aimY: tgt ? tgt.y : CFG.H - 160,
      });
    }
  }

  function enemyShoot(world, e, players) {
    const tgt = nearestPlayer(players, e.x, e.y);
    if (!tgt) return;
    const dx = tgt.x - e.x;
    const dy = tgt.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    if (e.boss) {
      for (let i = 0; i < 10; i += 1) {
        const a = (Math.PI * 2 * i) / 10 + e.t * 1.4;
        addBullet(world, {
          x: e.x,
          y: e.y + 20,
          vx: Math.cos(a) * 150,
          vy: Math.sin(a) * 150,
          side: 2,
          kind: "e",
          dmg: 1,
        });
      }
      return;
    }
    addBullet(world, {
      x: e.x,
      y: e.y + 12,
      vx: (dx / len) * 155,
      vy: (dy / len) * 155,
      side: 2,
      kind: "e",
      dmg: 1,
    });
  }

  function stepEnemy(world, e, players, dt) {
    e.t += dt;
    if (e.kind === "zig") e.x += Math.sin(e.t * 3.2) * (e.amp || 60) * dt * 4;
    if (e.kind === "dive" && e.t > 0.45) {
      const dx = (e.aimX || CFG.W / 2) - e.x;
      const dy = (e.aimY || CFG.H) - e.y;
      const len = Math.hypot(dx, dy) || 1;
      e.vx = (dx / len) * 240;
      e.vy = (dy / len) * 240;
    }
    if (e.boss) {
      e.x = CFG.W / 2 + Math.sin(e.t * 0.8) * 180;
      e.y = 130 + Math.sin(e.t * 1.4) * 18;
    }
    e.x += (e.vx || 0) * dt;
    e.y += (e.vy || 0) * dt;
    e.fire -= dt;
    if (e.fire <= 0 && (e.kind === "gun" || e.kind === "dive" || e.boss)) {
      e.fire = e.boss ? 0.95 : 1.45;
      enemyShoot(world, e, players);
    }
  }

  function hurtPlayer(p) {
    if (p.dead > 0 || p.inv > 0) return false;
    if (p.shield > 0) {
      p.shield = 0;
      p.inv = 0.8;
      return false;
    }
    p.lives -= 1;
    p.pow = Math.max(1, p.pow - 1);
    p.inv = CFG.inv;
    if (p.lives <= 0) {
      p.dead = 99;
      p.lives = 0;
    }
    return true;
  }

  function stepPlayer(world, p, input, dt) {
    p.inv = Math.max(0, p.inv - dt);
    p.fire = Math.max(0, p.fire - dt);
    p.bombCd = Math.max(0, p.bombCd - dt);
    p.shield = Math.max(0, p.shield - dt);
    if (p.lives <= 0) {
      p.dead = Math.max(p.dead, 1);
      return;
    }
    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0 && p.lives > 0) {
        p.x = CFG.W / 2;
        p.y = CFG.H - 150;
        p.inv = CFG.inv;
        p.dead = 0;
      }
      return;
    }

    const ax = clamp(Number(input.ax) || (input.r ? 1 : 0) - (input.l ? 1 : 0), -1, 1);
    const ay = clamp(Number(input.ay) || (input.d ? 1 : 0) - (input.u ? 1 : 0), -1, 1);
    p.x = clamp(p.x + ax * CFG.playerSpeed * dt, 28, CFG.W - 28);
    p.y = clamp(p.y + ay * CFG.playerSpeed * dt, 70, CFG.H - 40);

    const wantFire = input.f || input.auto;
    const cd = input.f ? CFG.holdFire : CFG.autoFire;
    if (wantFire && p.fire <= 0) {
      p.fire = cd;
      firePlayer(world, p);
    }
    if (input.b) useBomb(world, p);
  }

  function botInput(p, world) {
    const threat = world.bullets.find((b) => b.side === 2 && Math.abs(b.x - p.x) < 36 && b.y < p.y && b.y > p.y - 160);
    const drop = world.drops.find((d) => Math.abs(d.x - p.x) < 180 && d.y < p.y + 40);
    let ax = 0;
    let ay = 0;
    if (threat) ax = threat.x >= p.x ? -1 : 1;
    else if (drop) {
      ax = drop.x > p.x + 8 ? 1 : drop.x < p.x - 8 ? -1 : 0;
      ay = drop.y > p.y + 10 ? 1 : -0.2;
    } else {
      ax = Math.sin(world.t * 1.4 + p.id) * 0.7;
      ay = Math.sin(world.t * 0.9 + p.id * 2) * 0.25;
    }
    const bomb = world.bullets.filter((b) => b.side === 2 && dist2(b.x, b.y, p.x, p.y) < 70 * 70).length > 8;
    return { ax: ax, ay: ay, f: 1, auto: 1, b: bomb ? 1 : 0 };
  }

  function stepWorld(world, players, inputs, dt) {
    if (world.over) return world;
    world.t += dt;
    world.flash = Math.max(0, world.flash - dt);
    if (world.t > CFG.stageLen) {
      world.t = 0;
      world.stage += 1;
      world._next = 0.3;
      world.bossDone = false;
      world.enemies = world.enemies.filter((e) => e.boss);
    }
    if (world.stage > CFG.stages && !world.enemies.some((e) => e.boss)) {
      world.win = true;
      world.over = true;
      return world;
    }

    spawnWave(world, players);

    players.forEach((p) => {
      const input = inputs.get ? inputs.get(p.id) : inputs[p.id];
      const use = p.bot ? botInput(p, world) : input || { auto: 1 };
      if (!p.bot) use.auto = 1;
      stepPlayer(world, p, use, dt);
    });

    world.enemies.forEach((e) => stepEnemy(world, e, players, dt));
    world.bullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    });
    world.drops.forEach((d) => {
      d.y += d.vy * dt;
    });

    world.bullets.forEach((b) => {
      if (b.side !== 1) return;
      world.enemies.forEach((e) => {
        if (e.hp <= 0) return;
        const r = e.boss ? 46 : 18;
        if (dist2(b.x, b.y, e.x, e.y) < r * r) {
          e.hp -= b.dmg || 1;
          b.life = 0;
          const owner = players.find((p) => p.id === b.owner);
          if (owner) owner.score += 12;
        }
      });
    });

    world.enemies.slice().forEach((e) => {
      if (e.hp > 0) return;
      spawnDrop(world, e.x, e.y, e.boss ? "pow" : null);
      const killer = players[0];
      if (killer) killer.score += e.boss ? 800 : 60;
      world.boom.push({ x: e.x, y: e.y, t: 0.28, r: e.boss ? 70 : 28 });
    });
    world.enemies = world.enemies.filter((e) => e.hp > 0 && e.y < CFG.H + 80 && e.x > -80 && e.x < CFG.W + 80);

    world.bullets.forEach((b) => {
      if (b.side !== 2) return;
      players.forEach((p) => {
        if (p.dead > 0) return;
        if (dist2(b.x, b.y, p.x, p.y) < (CFG.hitR + 4) * (CFG.hitR + 4)) {
          if (hurtPlayer(p)) b.life = 0;
        }
      });
    });
    world.enemies.forEach((e) => {
      players.forEach((p) => {
        if (p.dead > 0) return;
        const r = (e.boss ? 40 : 16) + CFG.hitR;
        if (dist2(e.x, e.y, p.x, p.y) < r * r) hurtPlayer(p);
      });
    });

    world.drops.forEach((d) => {
      players.forEach((p) => {
        if (p.dead > 0) return;
        const pull = dist2(d.x, d.y, p.x, p.y);
        if (pull < 92 * 92) {
          d.x += (p.x - d.x) * 0.16;
          d.y += (p.y - d.y) * 0.16;
        }
        if (pull < 32 * 32) {
          collectDrop(p, d, world);
          d.gone = true;
        }
      });
    });

    world.bullets = world.bullets.filter((b) => b.life > 0 && b.y > -40 && b.y < CFG.H + 40 && b.x > -40 && b.x < CFG.W + 40);
    world.drops = world.drops.filter((d) => !d.gone && d.y < CFG.H + 30);
    world.boom = (world.boom || []).filter((b) => {
      b.t -= dt;
      return b.t > 0;
    });
    world.pops = (world.pops || []).filter((pop) => {
      pop.t -= dt;
      pop.y -= 36 * dt;
      return pop.t > 0;
    });

    const humans = players.filter((p) => !p.bot);
    const liveHumans = humans.filter((p) => p.dead <= 0 || p.lives > 0);
    if (humans.length && liveHumans.every((p) => p.dead > 0 && p.lives <= 0)) {
      world.over = true;
      world.win = false;
    }
    return world;
  }

  function publicPlayer(p) {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      bot: !!p.bot,
      x: Math.round(p.x),
      y: Math.round(p.y),
      pow: p.pow,
      bombs: p.bombs,
      lives: p.lives,
      score: p.score,
      inv: p.inv,
      dead: p.dead,
      shield: p.shield,
    };
  }

  function publicWorld(world) {
    return {
      t: Math.round(world.t * 10) / 10,
      stage: world.stage,
      wave: world.wave,
      over: world.over,
      win: world.win,
      flash: world.flash,
      enemies: world.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        x: Math.round(e.x),
        y: Math.round(e.y),
        hp: e.hp,
        boss: !!e.boss,
      })),
      bullets: world.bullets.map((b) => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        vx: Math.round(b.vx),
        vy: Math.round(b.vy),
        side: b.side,
        kind: b.kind,
      })),
      drops: world.drops.map((d) => ({ id: d.id, kind: d.kind, x: Math.round(d.x), y: Math.round(d.y) })),
      boom: (world.boom || []).map((b) => ({ x: b.x, y: b.y, t: b.t, r: b.r })),
      pops: (world.pops || []).map((pop) => ({
        x: Math.round(pop.x),
        y: Math.round(pop.y),
        t: Math.round(pop.t * 100) / 100,
        txt: pop.txt,
        c: pop.c,
      })),
    };
  }

  const api = {
    COLORS,
    NAMES,
    CFG,
    clamp,
    dist2,
    blankPlayer,
    blankWorld,
    weaponShots,
    firePlayer,
    useBomb,
    collectDrop,
    spawnDrop,
    spawnWave,
    stepPlayer,
    stepWorld,
    botInput,
    publicPlayer,
    publicWorld,
    hurtPlayer,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Fighter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
