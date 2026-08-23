(() => {
  const F = window.Fighter;
  const canvas = document.getElementById("game");
  const stage = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let W = 720;
  let H = 1100;
  let dpr = 1;
  let scale = 1;
  let ox = 0;
  let oy = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = stage.getBoundingClientRect();
    W = Math.max(320, Math.round(box.width || window.innerWidth));
    H = Math.max(240, Math.round(box.height || window.innerHeight));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = W / F.CFG.W;
    const sy = H / F.CFG.H;
    scale = Math.min(sx, sy);
    ox = (W - F.CFG.W * scale) / 2;
    oy = (H - F.CFG.H * scale) / 2;
  }

  function sx(x) {
    return ox + x * scale;
  }
  function sy(y) {
    return oy + y * scale;
  }
  function sr(n) {
    return n * scale;
  }

  function wsUrl() {
    const q = new URLSearchParams(location.search);
    if (q.get("ws")) return q.get("ws");
    const host = location.hostname;
    if (host === "127.0.0.1" || host === "localhost") return "ws://127.0.0.1:3012";
    if (host.endsWith("github.io")) return "wss://117.72.108.246/study/fighter/ws";
    return (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/study/fighter/ws";
  }

  const G = {
    ws: null,
    ok: false,
    me: 0,
    name: localStorage.getItem("fighter-nick") || "",
    room: null,
    phase: "boot",
    wait: 0,
    players: [],
    world: F.blankWorld(),
    input: { ax: 0, ay: 0, f: 0, b: 0, auto: 1 },
    offline: false,
    stars: Array.from({ length: 48 }, (_, i) => ({
      x: (i * 97) % F.CFG.W,
      y: (i * 53) % F.CFG.H,
      s: 0.6 + (i % 4) * 0.3,
    })),
  };

  function show(id) {
    ["lobby", "room", "over"].forEach((k) => $(k).classList.toggle("hidden", k !== id));
    $("ui").style.pointerEvents = id ? "auto" : "none";
    if (!id) ["lobby", "room", "over"].forEach((k) => $(k).classList.add("hidden"));
  }

  function setStatus(s) {
    $("status").textContent = s;
  }

  function paintRoom() {
    if (!G.room) return;
    $("roomCode").textContent = G.room.code;
    $("plist").innerHTML = G.room.players
      .map((p) => `<li><span class="dot" style="background:${p.color}"></span>${p.name}${p.id === G.room.host ? " · 队长" : ""}${p.bot ? " · 僚机" : ""}</li>`)
      .join("");
    $("btnStart").style.display = G.me === G.room.host ? "inline-block" : "none";
    $("btnAgain").style.display = G.me === G.room.host ? "inline-block" : "none";
  }

  function connect() {
    try {
      G.ws = new WebSocket(wsUrl());
    } catch {
      offline("连不上联机服务，先单机飞");
      return;
    }
    G.ws.onopen = () => {
      G.ok = true;
      setStatus("已连上，可以匹配或创建房间");
      send({ t: "hello", name: G.name || $("nick").value || "战机" });
      const want = new URLSearchParams(location.search).get("room");
      if (want) {
        $("code").value = want;
        send({ t: "join", code: want });
      }
    };
    G.ws.onclose = () => {
      G.ok = false;
      if (G.phase === "run") return;
      setStatus("掉线了，点快速匹配会再连。也能先单机。");
    };
    G.ws.onerror = () => {
      if (!G.ok) offline("联机服务还没好，先单机和僚机飞");
    };
    G.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === "hi") G.name = m.name;
      if (m.t === "you") G.me = m.id;
      if (m.t === "err") setStatus(m.m);
      if (m.t === "room") {
        G.room = m;
        G.phase = m.phase;
        if (m.phase === "lobby") {
          show("room");
          history.replaceState(null, "", "?room=" + m.code);
        }
        paintRoom();
      }
      if (m.t === "go") {
        G.phase = "count";
        G.wait = m.wait || 3;
        G.world = F.blankWorld();
        G.players = [];
        show("");
        $("pads").classList.remove("hidden");
        if (!fsPending) resize();
      }
      if (m.t === "run") G.phase = "run";
      if (m.t === "st") {
        G.phase = m.phase || G.phase;
        G.players = m.players;
        G.world = Object.assign(G.world, m.world);
      }
      if (m.t === "over") {
        G.phase = "over";
        $("pads").classList.add("hidden");
        $("overTitle").textContent = m.win ? "关卡通关" : "编队被击落";
        $("ranks").innerHTML = m.ranks
          .map((r) => `<li><span class="dot" style="background:${r.color}"></span>第${r.place}名 · ${r.name} · ${r.score}分${r.bot ? "（僚机）" : ""}</li>`)
          .join("");
        show("over");
      }
    };
  }

  function send(msg) {
    if (G.ws && G.ws.readyState === 1) G.ws.send(JSON.stringify(msg));
  }

  function offline(why) {
    G.offline = true;
    setStatus(why);
    $("btnQuick").textContent = "单机起飞";
  }

  function startOffline() {
    G.offline = true;
    G.me = 1;
    G.phase = "count";
    G.wait = 3;
    G.world = F.blankWorld();
    G.players = [
      F.blankPlayer(1, G.name || "雷霆", F.COLORS[0], false),
      F.blankPlayer(2, "彗星机", F.COLORS[1], true),
    ];
    show("");
    $("pads").classList.remove("hidden");
    if (!fsPending) resize();
  }

  $("nick").value = G.name;
  $("nick").addEventListener("change", () => {
    G.name = $("nick").value.slice(0, 8);
    localStorage.setItem("fighter-nick", G.name);
    send({ t: "hello", name: G.name });
  });
  $("btnCreate").onclick = () => {
    G.name = $("nick").value.slice(0, 8) || "战机";
    send({ t: "hello", name: G.name });
    send({ t: "create" });
  };
  $("btnJoin").onclick = () => {
    G.name = $("nick").value.slice(0, 8) || "战机";
    send({ t: "hello", name: G.name });
    send({ t: "join", code: $("code").value });
  };
  $("btnQuick").onclick = () => {
    G.name = $("nick").value.slice(0, 8) || "战机";
    enterFs();
    if (G.offline || !G.ok) return startOffline();
    send({ t: "hello", name: G.name });
    send({ t: "quick" });
  };
  $("btnStart").onclick = () => {
    enterFs();
    send({ t: "start" });
  };
  $("btnAgain").onclick = () => {
    enterFs();
    send({ t: "again" });
  };
  $("btnLeave").onclick = () => {
    if (G.ws) G.ws.close();
    G.room = null;
    history.replaceState(null, "", location.pathname);
    show("lobby");
    connect();
  };
  $("btnLobby").onclick = () => {
    show("lobby");
    $("pads").classList.add("hidden");
    if (G.ok) send({ t: "again" });
  };

  const keys = G.input;
  function typingInField(el) {
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }
  window.addEventListener("keydown", (e) => {
    if (typingInField(e.target)) return;
    if (e.code === "KeyA" || e.code === "ArrowLeft") keys.ax = -1;
    if (e.code === "KeyD" || e.code === "ArrowRight") keys.ax = 1;
    if (e.code === "KeyW" || e.code === "ArrowUp") keys.ay = -1;
    if (e.code === "KeyS" || e.code === "ArrowDown") keys.ay = 1;
    if (e.code === "Space" || e.code === "KeyJ" || e.code === "KeyZ") {
      e.preventDefault();
      keys.f = 1;
    }
    if (e.code === "KeyK" || e.code === "KeyX" || e.code === "ShiftLeft") keys.b = 1;
    if ((e.code === "KeyF" || e.key === "f") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleFs();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyA" || e.code === "ArrowLeft") if (keys.ax < 0) keys.ax = 0;
    if (e.code === "KeyD" || e.code === "ArrowRight") if (keys.ax > 0) keys.ax = 0;
    if (e.code === "KeyW" || e.code === "ArrowUp") if (keys.ay < 0) keys.ay = 0;
    if (e.code === "KeyS" || e.code === "ArrowDown") if (keys.ay > 0) keys.ay = 0;
    if (e.code === "Space" || e.code === "KeyJ" || e.code === "KeyZ") keys.f = 0;
    if (e.code === "KeyK" || e.code === "KeyX" || e.code === "ShiftLeft") keys.b = 0;
  });

  (function bindHands() {
    const zone = $("moveZone");
    const stick = $("stick");
    const knob = $("stickKnob");
    let moveId = null;
    let ox0 = 0;
    let oy0 = 0;
    function setStick(cx, cy) {
      const max = Math.min(stick.clientWidth, stick.clientHeight) * 0.34;
      const dx = cx - ox0;
      const dy = cy - oy0;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, max);
      knob.style.transform = "translate(" + (dx / len) * cl + "px," + (dy / len) * cl + "px)";
      const nx = dx / max;
      const ny = dy / max;
      keys.ax = F.clamp(nx, -1, 1);
      keys.ay = F.clamp(ny, -1, 1);
    }
    zone.addEventListener("pointerdown", (e) => {
      if (moveId !== null) return;
      e.preventDefault();
      moveId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      ox0 = e.clientX;
      oy0 = e.clientY;
      setStick(e.clientX, e.clientY);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== moveId) return;
      e.preventDefault();
      setStick(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (e.pointerId !== moveId) return;
      moveId = null;
      keys.ax = 0;
      keys.ay = 0;
      knob.style.transform = "translate(0,0)";
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);

    function hold(btn, on, off) {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        on();
        btn.classList.add("is-down");
        try { btn.setPointerCapture(e.pointerId); } catch {}
      });
      const stop = () => {
        off();
        btn.classList.remove("is-down");
      };
      btn.addEventListener("pointerup", stop);
      btn.addEventListener("pointercancel", stop);
    }
    hold($("btnFire"), () => { keys.f = 1; }, () => { keys.f = 0; });
    hold($("btnBomb"), () => { keys.b = 1; }, () => { keys.b = 0; });
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest("#pads")) e.preventDefault();
    });
  })();

  let fsPending = false;
  function fsEl() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function isFs() {
    return fsEl() === stage || fsEl() === document.documentElement;
  }
  function enterFs() {
    if (isFs()) return false;
    const enter = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!enter) return false;
    fsPending = true;
    const out = enter.call(stage);
    if (out && out.catch) out.catch(() => { fsPending = false; });
    setTimeout(() => { fsPending = false; resize(); }, 900);
    return true;
  }
  function toggleFs() {
    if (isFs()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      return;
    }
    enterFs();
  }
  function syncFs() {
    const on = isFs();
    $("fullBtn").textContent = on ? "退出全屏" : "全屏";
    $("fullBtn").setAttribute("aria-pressed", on ? "true" : "false");
    if ($("btnLobbyFs")) $("btnLobbyFs").textContent = on ? "退出全屏" : "全屏";
    fsPending = false;
    resize();
  }
  $("fullBtn").onclick = (e) => { e.preventDefault(); toggleFs(); };
  $("btnLobbyFs").onclick = (e) => { e.preventDefault(); toggleFs(); };
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("webkitfullscreenchange", syncFs);

  let lastIn = 0;
  function pumpInput(now) {
    if (now - lastIn < 40) return;
    lastIn = now;
    if ((G.phase === "run" || G.phase === "count") && G.ok) {
      send({ t: "in", ax: keys.ax, ay: keys.ay, f: keys.f, b: keys.b });
    }
  }

  function me() {
    return G.players.find((p) => p.id === G.me) || G.players[0];
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#071221");
    g.addColorStop(0.55, "#12325a");
    g.addColorStop(1, "#1b4a4f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#061018";
    ctx.fillRect(0, 0, ox, H);
    ctx.fillRect(W - ox, 0, ox, H);
    G.stars.forEach((s) => {
      const y = (s.y + (G.world.t || 0) * (40 + s.s * 50)) % F.CFG.H;
      ctx.fillStyle = "rgba(255,255,255," + (0.35 + s.s * 0.2) + ")";
      ctx.fillRect(sx(s.x), sy(y), sr(2 * s.s), sr(2 * s.s));
    });
  }

  function drawJet(p, mine) {
    if (p.dead > 0 && p.lives <= 0) return;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0 && !mine) return;
    ctx.save();
    ctx.translate(sx(p.x), sy(p.y));
    const s = sr(1);
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(126,224,255,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.color || "#7ee0ff";
    ctx.beginPath();
    ctx.moveTo(0, -18 * s);
    ctx.lineTo(14 * s, 16 * s);
    ctx.lineTo(0, 10 * s);
    ctx.lineTo(-14 * s, 16 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff8e3";
    ctx.beginPath();
    ctx.moveTo(0, -8 * s);
    ctx.lineTo(5 * s, 6 * s);
    ctx.lineTo(-5 * s, 6 * s);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 " + Math.max(10, sr(12)) + "px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "", sx(p.x), sy(p.y) + sr(28));
    ctx.textAlign = "left";
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(sx(e.x), sy(e.y));
    const s = sr(e.boss ? 1.8 : 1);
    ctx.fillStyle = e.boss ? "#ff6b8a" : e.kind === "gun" ? "#ffd65a" : e.kind === "dive" ? "#ff9f6b" : "#c9a0ff";
    ctx.beginPath();
    ctx.moveTo(0, 16 * s);
    ctx.lineTo(13 * s, -12 * s);
    ctx.lineTo(0, -6 * s);
    ctx.lineTo(-13 * s, -12 * s);
    ctx.closePath();
    ctx.fill();
    if (e.boss) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    if (G.phase !== "run" && G.phase !== "count") return;
    const mine = me();
    const top = 54;
    ctx.fillStyle = "rgba(8,18,36,0.62)";
    const barW = Math.min(360, W - 40);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W / 2 - barW / 2, top, barW, 46, 16);
    else ctx.rect(W / 2 - barW / 2, top, barW, 46);
    ctx.fill();
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 15px Nunito, sans-serif";
    ctx.textAlign = "center";
    const pow = mine ? mine.pow : 1;
    const lives = mine ? mine.lives : 0;
    const bombs = mine ? mine.bombs : 0;
    const score = mine ? mine.score : 0;
    ctx.fillText("第" + (G.world.stage || 1) + "关 · " + score + "分 · 命" + lives + " · 弹" + bombs + " · 火力" + pow, W / 2, top + 30);
    ctx.textAlign = "left";
    if (G.phase === "count") {
      ctx.fillStyle = "rgba(6,16,24,0.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "900 88px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.max(1, Math.ceil(G.wait))), W / 2, H / 2);
      ctx.textAlign = "left";
    }
    if (G.world.flash > 0) {
      ctx.fillStyle = "rgba(255,240,180," + (G.world.flash * 0.45) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw() {
    drawSky();
    (G.world.drops || []).forEach((d) => {
      ctx.fillStyle = d.kind === "pow" ? "#7ee0ff" : d.kind === "bomb" ? "#ffd65a" : "#9dff8a";
      ctx.beginPath();
      ctx.arc(sx(d.x), sy(d.y), sr(11), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#102033";
      ctx.font = "900 " + Math.max(10, sr(12)) + "px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d.kind === "pow" ? "P" : d.kind === "bomb" ? "B" : "S", sx(d.x), sy(d.y) + sr(4));
      ctx.textAlign = "left";
    });
    (G.world.bullets || []).forEach((b) => {
      ctx.fillStyle = b.side === 1 ? (b.kind === "laser" ? "#9cffd8" : "#fff3a8") : "#ff6b8a";
      const h = b.kind === "laser" ? 16 : 8;
      ctx.fillRect(sx(b.x) - sr(2), sy(b.y) - sr(h / 2), sr(b.kind === "laser" ? 5 : 3), sr(h));
    });
    (G.world.enemies || []).forEach(drawEnemy);
    (G.world.boom || []).forEach((b) => {
      ctx.strokeStyle = "rgba(255,220,140," + Math.max(0, b.t * 3) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx(b.x), sy(b.y), sr((1 - b.t) * (b.r || 28)), 0, Math.PI * 2);
      ctx.stroke();
    });
    G.players.forEach((p) => drawJet(p, p.id === G.me));
    drawHud();
  }

  function update(dt) {
    if (G.phase === "count") {
      G.wait -= dt;
      if (G.offline && G.wait <= 0) G.phase = "run";
    }
    if (G.phase === "run" && G.offline) {
      const inputs = new Map();
      G.players.forEach((p) => inputs.set(p.id, p.id === G.me ? keys : F.botInput(p, G.world)));
      F.stepWorld(G.world, G.players, inputs, dt);
      if (G.world.over) {
        G.phase = "over";
        $("pads").classList.add("hidden");
        $("overTitle").textContent = G.world.win ? "关卡通关" : "编队被击落";
        const ranks = G.players
          .slice()
          .sort((a, b) => b.score - a.score)
          .map((p, i) => ({ ...p, place: i + 1 }));
        $("ranks").innerHTML = ranks
          .map((r) => `<li><span class="dot" style="background:${r.color}"></span>第${r.place}名 · ${r.name} · ${r.score}分${r.bot ? "（僚机）" : ""}</li>`)
          .join("");
        show("over");
      }
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = F.clamp((now - last) / 1000, 0, 0.033);
    last = now;
    pumpInput(now);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 180));
  resize();
  show("lobby");
  connect();
  requestAnimationFrame(loop);
  window.PipFighter = {
    connect,
    startOffline,
    getPhase: () => G.phase,
    getPlayers: () => G.players,
    getWorld: () => G.world,
    wsUrl,
  };
})();
