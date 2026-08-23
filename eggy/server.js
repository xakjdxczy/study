const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");
const E = require("./shared");

const PORT = Number(process.env.EGGY_PORT || 3011);
const HOST = process.env.EGGY_HOST || "127.0.0.1";
const STATIC = process.env.EGGY_STATIC === "1";

const rooms = new Map();
let nextId = 1;

function code() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += s[(Math.random() * s.length) | 0];
  return rooms.has(out) ? code() : out;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function roomView(room) {
  return {
    t: "room",
    code: room.code,
    host: room.host,
    phase: room.phase,
    wait: room.wait,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      bot: !!p.bot,
      fin: p.fin,
    })),
  };
}

function broadcast(room, msg) {
  const raw = JSON.stringify(msg);
  for (const c of room.clients) if (c.readyState === 1) c.send(raw);
}

function makeRoom(hostId) {
  const room = {
    code: code(),
    host: hostId,
    phase: "lobby",
    wait: 0,
    t: 0,
    players: [],
    clients: new Set(),
    inputs: new Map(),
  };
  rooms.set(room.code, room);
  return room;
}

function addPlayer(room, name, ws) {
  const id = nextId++;
  const color = E.COLORS[(room.players.length + id) % E.COLORS.length];
  const p = E.blankPlayer(id, String(name || "蛋仔").slice(0, 8), color, false);
  p.ws = ws;
  room.players.push(p);
  room.clients.add(ws);
  room.inputs.set(id, { l: 0, r: 0, j: 0, d: 0 });
  ws.egg = { id, code: room.code };
  return p;
}

function dropClient(ws) {
  const meta = ws.egg;
  if (!meta) return;
  const room = rooms.get(meta.code);
  if (!room) return;
  room.clients.delete(ws);
  room.players = room.players.filter((p) => p.id !== meta.id);
  room.inputs.delete(meta.id);
  if (room.host === meta.id && room.players.find((p) => !p.bot)) {
    room.host = room.players.find((p) => !p.bot).id;
  }
  if (!room.players.some((p) => !p.bot)) {
    rooms.delete(room.code);
    return;
  }
  broadcast(room, roomView(room));
}

function fillBots(room) {
  let i = 0;
  while (room.players.length < E.CFG.minField) {
    const id = nextId++;
    const p = E.blankPlayer(id, E.NAMES[i % E.NAMES.length] + "bot", E.COLORS[i % E.COLORS.length], true);
    room.players.push(p);
    room.inputs.set(id, { l: 0, r: 1, j: 0, d: 0 });
    i += 1;
  }
}

function startRace(room) {
  fillBots(room);
  room.phase = "count";
  room.wait = 3;
  room.t = 0;
  room.players.forEach((p, i) => {
    const fresh = E.blankPlayer(p.id, p.name, p.color, p.bot);
    fresh.ws = p.ws;
    fresh.x = 50 + i * 34;
    fresh.y = E.CFG.ground - E.CFG.h;
    fresh.on = true;
    room.players[i] = fresh;
  });
  broadcast(room, roomView(room));
  broadcast(room, { t: "go", wait: 3 });
}

function finishIfNeeded(room) {
  const live = room.players.filter((p) => !p.fin);
  const done = room.players.filter((p) => p.fin);
  if (done.length && (live.length === 0 || done.length >= Math.max(1, room.players.length - 1) || room.t > 90)) {
    room.phase = "over";
    const ranks = room.players
      .slice()
      .sort((a, b) => (a.fin || 1e9) - (b.fin || 1e9) || b.x - a.x)
      .map((p, i) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot, place: i + 1, fin: p.fin, x: p.x }));
    broadcast(room, { t: "over", ranks });
  }
}

function tickRoom(room, dt) {
  if (room.phase === "count") {
    room.wait -= dt;
    if (room.wait <= 0) {
      room.phase = "race";
      room.t = 0;
      broadcast(room, { t: "run" });
    }
    return;
  }
  if (room.phase !== "race") return;
  room.t += dt;
  for (const p of room.players) {
    let input = room.inputs.get(p.id) || { l: 0, r: 0, j: 0, d: 0 };
    if (p.bot) input = E.botInput(p, room.t);
    E.stepPlayer(p, input, dt, room.t);
  }
  finishIfNeeded(room);
  broadcast(room, {
    t: "st",
    now: room.t,
    phase: room.phase,
    players: room.players.map(E.publicPlayer),
  });
}

function findQuick() {
  for (const room of rooms.values()) {
    if (room.phase === "lobby" && room.players.filter((p) => !p.bot).length < E.CFG.maxHumans) return room;
  }
  return null;
}

function onMsg(ws, data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch {
    return;
  }
  const t = msg.t;
  if (t === "hello") {
    ws.nick = String(msg.name || "蛋仔").slice(0, 8);
    send(ws, { t: "hi", name: ws.nick });
    return;
  }
  if (t === "create") {
    if (ws.egg) dropClient(ws);
    const room = makeRoom(0);
    const p = addPlayer(room, ws.nick, ws);
    room.host = p.id;
    send(ws, { t: "you", id: p.id, color: p.color });
    broadcast(room, roomView(room));
    return;
  }
  if (t === "join") {
    const room = rooms.get(String(msg.code || "").toUpperCase());
    if (!room || room.phase !== "lobby") return send(ws, { t: "err", m: "房间不在或已经开赛" });
    if (room.players.filter((p) => !p.bot).length >= E.CFG.maxHumans) return send(ws, { t: "err", m: "房间满了" });
    if (ws.egg) dropClient(ws);
    const p = addPlayer(room, ws.nick, ws);
    send(ws, { t: "you", id: p.id, color: p.color });
    broadcast(room, roomView(room));
    return;
  }
  if (t === "quick") {
    if (ws.egg) dropClient(ws);
    const room = findQuick() || makeRoom(0);
    const p = addPlayer(room, ws.nick, ws);
    if (!room.host) room.host = p.id;
    send(ws, { t: "you", id: p.id, color: p.color });
    broadcast(room, roomView(room));
    return;
  }
  if (t === "start") {
    const room = ws.egg && rooms.get(ws.egg.code);
    if (!room || room.host !== ws.egg.id || room.phase !== "lobby") return;
    startRace(room);
    return;
  }
  if (t === "again") {
    const room = ws.egg && rooms.get(ws.egg.code);
    if (!room || room.host !== ws.egg.id) return;
    room.phase = "lobby";
    room.players = room.players.filter((p) => !p.bot);
    broadcast(room, roomView(room));
    return;
  }
  if (t === "in") {
    const room = ws.egg && rooms.get(ws.egg.code);
    if (!room || (room.phase !== "race" && room.phase !== "count")) return;
    room.inputs.set(ws.egg.id, {
      l: !!msg.l,
      r: !!msg.r,
      j: !!msg.j,
      d: !!msg.d,
    });
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  if (!STATIC) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("eggy-ws");
    return;
  }
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/") url = "/index.html";
  const file = path.join(__dirname, path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, ""));
  if (!file.startsWith(__dirname)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.nick = "蛋仔";
  send(ws, { t: "hi", name: ws.nick });
  ws.on("message", (data) => onMsg(ws, String(data)));
  ws.on("close", () => dropClient(ws));
});

const dt = E.CFG.tick;
setInterval(() => {
  for (const room of rooms.values()) tickRoom(room, dt);
}, dt * 1000);

server.listen(PORT, HOST, () => {
  console.log("eggy ws " + HOST + ":" + PORT + (STATIC ? " + static" : ""));
});

module.exports = { rooms, makeRoom, addPlayer, startRace, tickRoom, code };
