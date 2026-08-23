const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");
const F = require("./shared");

const PORT = Number(process.env.FIGHTER_PORT || 3012);
const HOST = process.env.FIGHTER_HOST || "127.0.0.1";
const STATIC = process.env.FIGHTER_STATIC === "1";

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
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      bot: !!p.bot,
      score: p.score,
    })),
  };
}

function broadcast(room, msg) {
  const raw = JSON.stringify(msg);
  for (const c of room.clients) if (c.readyState === 1) c.send(raw);
}

function makeRoom() {
  const room = {
    code: code(),
    host: 0,
    phase: "lobby",
    wait: 0,
    players: [],
    clients: new Set(),
    inputs: new Map(),
    world: F.blankWorld(),
  };
  rooms.set(room.code, room);
  return room;
}

function addPlayer(room, name, ws) {
  const id = nextId++;
  const color = F.COLORS[(room.players.length + id) % F.COLORS.length];
  const p = F.blankPlayer(id, String(name || "战机").slice(0, 8), color, false);
  p.ws = ws;
  room.players.push(p);
  room.clients.add(ws);
  room.inputs.set(id, { ax: 0, ay: 0, f: 0, b: 0, auto: 1 });
  ws.jet = { id, code: room.code };
  return p;
}

function dropClient(ws) {
  const meta = ws.jet;
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
  while (room.players.length < F.CFG.minField) {
    const id = nextId++;
    const p = F.blankPlayer(id, F.NAMES[i % F.NAMES.length] + "机", F.COLORS[i % F.COLORS.length], true);
    room.players.push(p);
    room.inputs.set(id, { ax: 0, ay: 0, f: 1, auto: 1, b: 0 });
    i += 1;
  }
}

function startRace(room) {
  fillBots(room);
  room.phase = "count";
  room.wait = 3;
  room.world = F.blankWorld();
  room.players.forEach((p, i) => {
    const fresh = F.blankPlayer(p.id, p.name, p.color, p.bot);
    fresh.ws = p.ws;
    fresh.x = F.CFG.W * (0.28 + (i % 4) * 0.16);
    room.players[i] = fresh;
  });
  broadcast(room, roomView(room));
  broadcast(room, { t: "go", wait: 3 });
}

function tickRoom(room, dt) {
  if (room.phase === "count") {
    room.wait -= dt;
    if (room.wait <= 0) {
      room.phase = "run";
      broadcast(room, { t: "run" });
    }
    return;
  }
  if (room.phase !== "run") return;
  F.stepWorld(room.world, room.players, room.inputs, dt);
  if (room.world.over) {
    room.phase = "over";
    const ranks = room.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot, score: p.score, place: i + 1 }));
    broadcast(room, { t: "over", win: !!room.world.win, ranks });
    return;
  }
  broadcast(room, {
    t: "st",
    phase: room.phase,
    players: room.players.map(F.publicPlayer),
    world: F.publicWorld(room.world),
  });
}

function findQuick() {
  for (const room of rooms.values()) {
    if (room.phase === "lobby" && room.players.filter((p) => !p.bot).length < F.CFG.maxHumans) return room;
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
    ws.nick = String(msg.name || "战机").slice(0, 8);
    send(ws, { t: "hi", name: ws.nick });
    return;
  }
  if (t === "create") {
    if (ws.jet) dropClient(ws);
    const room = makeRoom();
    const p = addPlayer(room, ws.nick, ws);
    room.host = p.id;
    send(ws, { t: "you", id: p.id, color: p.color });
    broadcast(room, roomView(room));
    return;
  }
  if (t === "join") {
    const room = rooms.get(String(msg.code || "").toUpperCase());
    if (!room || room.phase !== "lobby") return send(ws, { t: "err", m: "房间不在或已经开打" });
    if (room.players.filter((p) => !p.bot).length >= F.CFG.maxHumans) return send(ws, { t: "err", m: "房间满了" });
    if (ws.jet) dropClient(ws);
    const p = addPlayer(room, ws.nick, ws);
    send(ws, { t: "you", id: p.id, color: p.color });
    broadcast(room, roomView(room));
    return;
  }
  if (t === "quick") {
    if (ws.jet) dropClient(ws);
    const room = findQuick() || makeRoom();
    const p = addPlayer(room, ws.nick, ws);
    if (!room.host) room.host = p.id;
    send(ws, { t: "you", id: p.id, color: p.color });
    broadcast(room, roomView(room));
    return;
  }
  if (t === "start") {
    const room = ws.jet && rooms.get(ws.jet.code);
    if (!room || room.host !== ws.jet.id || room.phase !== "lobby") return;
    startRace(room);
    return;
  }
  if (t === "again") {
    const room = ws.jet && rooms.get(ws.jet.code);
    if (!room || room.host !== ws.jet.id) return;
    room.phase = "lobby";
    room.players = room.players.filter((p) => !p.bot);
    broadcast(room, roomView(room));
    return;
  }
  if (t === "in") {
    const room = ws.jet && rooms.get(ws.jet.code);
    if (!room || (room.phase !== "run" && room.phase !== "count")) return;
    room.inputs.set(ws.jet.id, {
      ax: Number(msg.ax) || 0,
      ay: Number(msg.ay) || 0,
      f: !!msg.f,
      b: !!msg.b,
      auto: 1,
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
    res.end("fighter-ws");
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
  ws.nick = "战机";
  send(ws, { t: "hi", name: ws.nick });
  ws.on("message", (data) => onMsg(ws, String(data)));
  ws.on("close", () => dropClient(ws));
});

const dt = F.CFG.tick;
setInterval(() => {
  for (const room of rooms.values()) tickRoom(room, dt);
}, dt * 1000);

server.listen(PORT, HOST, () => {
  console.log("fighter ws " + HOST + ":" + PORT + (STATIC ? " + static" : ""));
});

module.exports = { rooms, makeRoom, addPlayer, startRace, tickRoom, code };
