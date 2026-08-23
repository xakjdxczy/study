(() => {
  const E = window.Eggy;
  const canvas = document.getElementById("game");
  const stage = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  let W = 1280;
  let H = 720;
  let dpr = 1;

  function racing() {
    return G.phase === "race" || G.phase === "count";
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
    const nextW = Math.max(320, Math.round((box && box.width) || window.innerWidth));
    const nextH = Math.max(240, Math.round((box && box.height) || window.innerHeight));
    const nextCw = Math.round(nextW * dpr);
    const nextCh = Math.round(nextH * dpr);
    if (nextW === W && nextH === H && canvas.width === nextCw && canvas.height === nextCh) return;
    W = nextW;
    H = nextH;
    canvas.width = nextCw;
    canvas.height = nextCh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function view() {
    const padT = Math.min(80, Math.max(44, H * 0.08));
    const ground = E.CFG.ground;
    const air = 280;
    const target = E.clamp(H * 0.62, padT + 220, H - 140);
    let scale = 1;
    if (target - padT < air) scale = Math.max(0.58, (target - padT) / air);
    return { scale: scale, oy: target - ground * scale };
  }

  function sx(x) {
    return x - G.camX;
  }

  function sy(y) {
    const v = view();
    return y * v.scale + v.oy;
  }

  function sh(n) {
    return n * view().scale;
  }

  function wsUrl() {
    const q = new URLSearchParams(location.search);
    if (q.get("ws")) return q.get("ws");
    const host = location.hostname;
    if (host === "127.0.0.1" || host === "localhost") return "ws://127.0.0.1:3011";
    if (host.endsWith("github.io")) return "wss://117.72.108.246/study/eggy/ws";
    return (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "/study/eggy/ws";
  }

  const G = {
    ws: null,
    ok: false,
    me: 0,
    name: localStorage.getItem("eggy-nick") || "",
    room: null,
    phase: "boot",
    wait: 0,
    t: 0,
    camX: 0,
    players: [],
    input: { l: 0, r: 0, j: 0, d: 0 },
    offline: false,
    clouds: Array.from({ length: 8 }, (_, i) => ({ x: i * 220, y: 40 + (i % 3) * 30, s: 0.8 + (i % 3) * 0.2 })),
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
      .map((p) => `<li><span class="dot" style="background:${p.color}"></span>${p.name}${p.id === G.room.host ? " · 房主" : ""}${p.bot ? " · 机器人" : ""}</li>`)
      .join("");
    $("btnStart").style.display = G.me === G.room.host ? "inline-block" : "none";
    $("btnAgain").style.display = G.me === G.room.host ? "inline-block" : "none";
  }

  function connect() {
    try {
      G.ws = new WebSocket(wsUrl());
    } catch {
      offline("连不上联机服务，先单机跑");
      return;
    }
    G.ws.onopen = () => {
      G.ok = true;
      setStatus("已连上，可以匹配或创建房间");
      send({ t: "hello", name: G.name || $("nick").value || "蛋仔" });
      const want = new URLSearchParams(location.search).get("room");
      if (want) {
        $("code").value = want;
        send({ t: "join", code: want });
      }
    };
    G.ws.onclose = () => {
      G.ok = false;
      if (G.phase === "race") return;
      setStatus("掉线了，点快速匹配会再连。也能先单机。");
    };
    G.ws.onerror = () => {
      if (!G.ok) offline("联机服务还没好，先单机和机器人跑");
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
        G.players = [];
        show("");
        $("pads").classList.remove("hidden");
        if (!fsPending) resize();
      }
      if (m.t === "run") G.phase = "race";
      if (m.t === "st") {
        G.t = m.now;
        if (m.phase) G.phase = m.phase;
        const prev = G.players.find((p) => p.id === G.me);
        G.players = m.players;
        const nowP = G.players.find((p) => p.id === G.me);
        if (prev && nowP && G.phase === "race") {
          const dx = prev.x - nowP.x;
          const dy = prev.y - nowP.y;
          const teleported = Math.abs(dx) > 90 || Math.abs(dy) > 50;
          if (!teleported) {
            const holding = keys.l || keys.r || keys.j || keys.d;
            if (nowP.on && holding && Math.abs(dx) < 280) nowP.x = prev.x;
            else if (nowP.on && Math.abs(dx) < 180) nowP.x = prev.x * 0.6 + nowP.x * 0.4;
          }
        }
      }
      if (m.t === "over") {
        G.phase = "over";
        $("pads").classList.add("hidden");
        $("ranks").innerHTML = m.ranks
          .map((r) => `<li><span class="dot" style="background:${r.color}"></span>第${r.place}名 · ${r.name}${r.bot ? "（机器人）" : ""}</li>`)
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
    $("btnQuick").textContent = "单机开跑";
  }

  function startOffline() {
    G.offline = true;
    G.me = 1;
    G.phase = "count";
    G.wait = 3;
    G.t = 0;
    G.players = [
      E.blankPlayer(1, G.name || "蛋蛋", E.COLORS[0], false),
      E.blankPlayer(2, "团子bot", E.COLORS[1], true),
      E.blankPlayer(3, "糯米bot", E.COLORS[2], true),
      E.blankPlayer(4, "波波bot", E.COLORS[3], true),
    ];
    G.players.forEach((p, i) => {
      p.x = 50 + i * 34;
      p.y = E.CFG.ground - E.CFG.h;
      p.on = true;
    });
    show("");
    $("pads").classList.remove("hidden");
    if (!fsPending) resize();
  }

  $("nick").value = G.name;
  $("nick").addEventListener("change", () => {
    G.name = $("nick").value.slice(0, 8);
    localStorage.setItem("eggy-nick", G.name);
    send({ t: "hello", name: G.name });
  });
  $("btnCreate").onclick = () => {
    G.name = $("nick").value.slice(0, 8) || "蛋仔";
    send({ t: "hello", name: G.name });
    send({ t: "create" });
  };
  $("btnJoin").onclick = () => {
    G.name = $("nick").value.slice(0, 8) || "蛋仔";
    send({ t: "hello", name: G.name });
    send({ t: "join", code: $("code").value });
  };
  $("btnQuick").onclick = () => {
    G.name = $("nick").value.slice(0, 8) || "蛋仔";
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
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }
  window.addEventListener("keydown", (e) => {
    if (typingInField(e.target)) return;
    if (e.code === "KeyA" || e.code === "ArrowLeft") keys.l = 1;
    if (e.code === "KeyD" || e.code === "ArrowRight") keys.r = 1;
    if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp" || e.code === "KeyJ") {
      e.preventDefault();
      keys.j = 1;
      keys.jHold = performance.now() + 180;
    }
    if (e.code === "KeyK" || e.code === "ShiftLeft" || e.code === "KeyL") keys.d = 1;
    if ((e.code === "KeyF" || e.key === "f") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleFs();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyA" || e.code === "ArrowLeft") keys.l = 0;
    if (e.code === "KeyD" || e.code === "ArrowRight") keys.r = 0;
    if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp" || e.code === "KeyJ") keys.j = 0;
    if (e.code === "KeyK" || e.code === "ShiftLeft" || e.code === "KeyL") keys.d = 0;
  });

  bindHands();
  function bindHands() {
    const zone = $("moveZone");
    const stick = $("stick");
    const knob = $("stickKnob");
    let moveId = null;
    let ox = 0;
    let oy = 0;
    const held = new Map();

    function setStick(cx, cy) {
      const max = Math.min(stick.clientWidth, stick.clientHeight) * 0.34;
      const dx = cx - ox;
      const dy = cy - oy;
      const len = Math.hypot(dx, dy);
      const cl = Math.min(len, max);
      const ang = Math.atan2(dy, dx);
      knob.style.transform = "translate(" + Math.cos(ang) * cl + "px," + Math.sin(ang) * cl + "px)";
      const dead = 10;
      if (dx < -dead) {
        keys.l = 1;
        keys.r = 0;
      } else {
        keys.l = 0;
        keys.r = 1;
      }
    }

    function resetStick() {
      moveId = null;
      keys.l = 0;
      keys.r = 0;
      knob.style.transform = "translate(0,0)";
    }

    zone.addEventListener("pointerdown", (e) => {
      if (moveId !== null) return;
      e.preventDefault();
      moveId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      ox = e.clientX;
      oy = e.clientY;
      keys.l = 0;
      keys.r = 1;
      setStick(e.clientX, e.clientY);
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== moveId) return;
      e.preventDefault();
      setStick(e.clientX, e.clientY);
    });
    const endStick = (e) => {
      if (e.pointerId !== moveId) return;
      resetStick();
    };
    zone.addEventListener("pointerup", endStick);
    zone.addEventListener("pointercancel", endStick);

    document.querySelectorAll("#pads [data-k]").forEach((btn) => {
      const k = btn.getAttribute("data-k");
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        held.set(e.pointerId, { key: k, el: btn });
        keys[k] = 1;
        if (k === "j") keys.jHold = performance.now() + 180;
        btn.classList.add("is-down");
        try { btn.setPointerCapture(e.pointerId); } catch {}
      };
      const up = (e) => {
        const rec = held.get(e.pointerId);
        if (!rec || rec.key !== k) return;
        held.delete(e.pointerId);
        if (k === "j") keys.j = performance.now() < (keys.jHold || 0) ? 1 : 0;
        else keys[k] = 0;
        rec.el.classList.remove("is-down");
      };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
    });

    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest("#pads")) e.preventDefault();
    });
  }

  function fsEl() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function isFs() {
    return fsEl() === stage || fsEl() === document.documentElement;
  }
  let fsPending = false;
  function enterFs() {
    if (isFs()) return false;
    const enter = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!enter) return false;
    fsPending = true;
    const out = enter.call(stage);
    if (out && out.catch) out.catch(() => { fsPending = false; });
    setTimeout(() => {
      if (!fsPending) return;
      fsPending = false;
      resize();
    }, 900);
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
  $("fullBtn").onclick = (e) => {
    e.preventDefault();
    toggleFs();
  };
  if ($("btnLobbyFs")) {
    $("btnLobbyFs").onclick = (e) => {
      e.preventDefault();
      toggleFs();
    };
  }
  document.addEventListener("fullscreenchange", syncFs);
  document.addEventListener("webkitfullscreenchange", syncFs);

  let lastIn = 0;
  function pumpInput(now) {
    if (keys.jHold && now < keys.jHold) keys.j = 1;
    if (now - lastIn < 50) return;
    lastIn = now;
    if ((G.phase === "race" || G.phase === "count") && G.ok) {
      send({ t: "in", l: keys.l, r: keys.r, j: keys.j, d: keys.d });
    }
  }

  function me() {
    return G.players.find((p) => p.id === G.me) || G.players[0];
  }

  function wx(x) {
    return sx(x);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6ec8ff");
    g.addColorStop(0.55, "#b4e7ff");
    g.addColorStop(1, "#ffe7a8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffe9a0";
    ctx.beginPath();
    ctx.arc(W * 0.82, 70, 34, 0, Math.PI * 2);
    ctx.fill();
    G.clouds.forEach((c) => {
      const x = ((c.x - G.camX * 0.2) % (W + 200)) - 40;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.ellipse(x, c.y, 46 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 28, c.y + 4, 30 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawMap(t) {
    E.MAP.plats.forEach((p) => {
      if (!E.platOn(p, t)) return;
      const b = E.platBox(p, t);
      const x = sx(b.x);
      const y = sy(b.y);
      const pw = b.w;
      const ph = Math.max(8, sh(b.h));
      ctx.fillStyle = "#c48a3a";
      ctx.fillRect(x, y, pw, ph + 16);
      ctx.fillStyle = p.kind === "spring" ? "#7ee0c6" : p.kind === "conveyor" ? "#ffd166" : p.kind === "vanish" ? "#c9a0ff" : "#8bd17c";
      ctx.fillRect(x, y, pw, Math.max(10, Math.min(18, ph)));
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, y, pw, 5);
      if (p.kind === "conveyor") {
        ctx.fillStyle = "#c48a10";
        for (let i = 0; i < pw; i += 18) ctx.fillRect(x + ((i + t * 80) % pw), y + 10, 10, 4);
      }
    });
    E.MAP.hazards.forEach((h) => {
      if (h.kind === "hammer") {
        const ang = t * h.spin;
        ctx.save();
        ctx.translate(sx(h.x), sy(h.y));
        ctx.rotate(ang);
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(0, -6, h.arm, 12);
        ctx.fillStyle = "#ff6b9d";
        ctx.beginPath();
        ctx.arc(h.arm, 0, h.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (h.kind === "spinner") {
        ctx.save();
        ctx.translate(sx(h.x), sy(h.y));
        ctx.rotate(t * h.spin);
        ctx.fillStyle = "#ff9f6b";
        for (let i = 0; i < 4; i += 1) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(0, -8, h.r, 16);
        }
        ctx.restore();
      }
    });
    const fx = sx(E.MAP.finishX);
    const top = sy(80);
    ctx.fillStyle = "#fff";
    ctx.fillRect(fx, top, 10, Math.max(80, sy(E.CFG.ground) - top));
    ctx.fillStyle = "#16324a";
    ctx.font = "900 18px Nunito, sans-serif";
    ctx.fillText("终点", fx + 16, top + 28);
  }

  function drawEgg(p) {
    const x = sx(p.x) + E.CFG.w / 2;
    const y = sy(p.y) + sh(E.CFG.h) / 2;
    const s = p.squish || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.facing < 0 ? -1 : 1, 1);
    ctx.fillStyle = "rgba(20,40,60,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 20, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color || "#ff6b9d";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-5, -6, 6, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(4, -4, 6, 0, Math.PI * 2);
    ctx.arc(-3, -3, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2218";
    ctx.beginPath();
    ctx.arc(5.5, -3.5, 2.2, 0, Math.PI * 2);
    ctx.arc(-1.6, -2.6, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb3c7";
    ctx.beginPath();
    ctx.ellipse(-8, 4, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(9, 4, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.dash > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(-10, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#16324a";
    ctx.font = "800 11px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "", x, y - 28);
    ctx.textAlign = "left";
  }

  function drawHud() {
    if (G.phase !== "race" && G.phase !== "count") return;
    const mine = me();
    const left = Math.max(0, E.MAP.finishX - (mine ? mine.x : 0));
    const barW = G.room ? 300 : 176;
    const barX = Math.round(W / 2 - barW / 2);
    const barY = W < 720 ? 52 : 12;
    ctx.fillStyle = "rgba(22,50,74,0.72)";
    fillRound(barX, barY, barW, 36);
    ctx.fillStyle = "#fff8e3";
    ctx.font = "800 16px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("还差 " + Math.floor(left) + " 米" + (G.room ? " · 房 " + G.room.code : ""), W / 2, barY + 24);
    ctx.textAlign = "left";
    if (G.phase === "count") {
      ctx.fillStyle = "rgba(16,32,56,0.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "900 88px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.max(1, Math.ceil(G.wait))), W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  function fillRound(x, y, w, h) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function update(dt) {
    if (G.phase === "count") {
      G.wait -= dt;
      if (G.offline && G.wait <= 0) G.phase = "race";
    }
    if (G.phase === "race" && G.ok && !G.offline) {
      const mine = G.players.find((p) => p.id === G.me);
      if (mine) E.stepPlayer(mine, keys, dt, G.t);
    }
    if (G.phase === "race" && G.offline) {
      G.t += dt;
      G.players.forEach((p) => {
        const input = p.id === G.me ? keys : E.botInput(p, G.t);
        E.stepPlayer(p, input, dt, G.t);
      });
      const done = G.players.filter((p) => p.fin);
      if (done.length && (done.length >= G.players.length - 1 || G.t > 90)) {
        G.phase = "over";
        $("pads").classList.add("hidden");
        const ranks = G.players
          .slice()
          .sort((a, b) => (a.fin || 1e9) - (b.fin || 1e9) || b.x - a.x)
          .map((p, i) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot, place: i + 1 }));
        $("ranks").innerHTML = ranks
          .map((r) => `<li><span class="dot" style="background:${r.color}"></span>第${r.place}名 · ${r.name}${r.bot ? "（机器人）" : ""}</li>`)
          .join("");
        show("over");
      }
    }
    const mine = me();
    if (mine) G.camX += (mine.x - W * 0.32 - G.camX) * Math.min(1, dt * 6);
  }

  function draw() {
    drawSky();
    drawMap(G.t || 0);
    G.players.forEach(drawEgg);
    drawHud();
    if (G.phase === "boot" || G.phase === "lobby") {
      /* lobby HTML sits on top */
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = E.clamp((now - last) / 1000, 0, 0.033);
    last = now;
    pumpInput(now);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  function resizeSoon() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 50);
  }
  window.addEventListener("resize", resizeSoon);
  window.addEventListener("orientationchange", () => setTimeout(resize, 180));
  resize();
  show("lobby");
  connect();
  requestAnimationFrame(loop);
  window.PipEggy = {
    connect,
    startOffline,
    getPhase: () => G.phase,
    getPlayers: () => G.players,
    getView: view,
    screenY: sy,
    wsUrl,
  };
})();
