const assert = require("assert");
const E = require("../eggy/shared");

const standing = E.blankPlayer(1, "蛋蛋", E.COLORS[0], false);
assert.ok(standing.on, "new eggs start standing");
assert.ok(Math.abs(standing.y + E.CFG.h - E.CFG.ground) < 1, "new eggs stand on the start floor");
for (let i = 0; i < 40; i += 1) E.stepPlayer(standing, { l: 0, r: 0, j: 0, d: 0 }, 1 / 30, i / 30);
assert.ok(standing.y < 420, "egg stays on the start floor, not falling through");
assert.ok(standing.on, "egg is grounded on the start floor");
assert.ok(standing.y + E.CFG.h <= E.CFG.ground + 1, "feet stay on the floor top");

const p = E.blankPlayer(1, "蛋蛋", E.COLORS[0], false);
p.x = 80;
p.y = 360;
p.on = false;
for (let i = 0; i < 40; i += 1) E.stepPlayer(p, { l: 0, r: 0, j: 0, d: 0 }, 1 / 30, i / 30);
assert.ok(p.y < 420, "egg that starts in the air lands on the start floor");
assert.ok(p.on, "air-spawned egg is grounded after falling");

const tunnel = E.blankPlayer(9, "穿地", E.COLORS[5], false);
tunnel.x = 80;
tunnel.y = 300;
tunnel.vy = 800;
tunnel.on = false;
E.stepPlayer(tunnel, { l: 0, r: 0, j: 0, d: 0 }, 0.1, 0);
assert.ok(tunnel.on, "fast fall still lands instead of being shoved sideways");
assert.ok(tunnel.x > 0, "fast fall does not eject the egg off the left of the floor");
assert.ok(Math.abs(tunnel.y + E.CFG.h - E.CFG.ground) < 2, "fast fall snaps onto the floor");

const q = E.blankPlayer(2, "跳跳", E.COLORS[1], false);
q.x = 80;
for (let i = 0; i < 8; i += 1) E.stepPlayer(q, { l: 0, r: 0, j: 0, d: 0 }, 1 / 20, i / 20);
assert.ok(q.on, "egg has landed before jumping");
const y0 = q.y;
E.stepPlayer(q, { l: 0, r: 0, j: 1, d: 0 }, 1 / 20, 1);
assert.ok(q.vy < 0, "jump sends the egg up");
assert.ok(q.y <= y0, "jump does not drop the egg");

const tap = E.blankPlayer(6, "点跳", E.COLORS[4], false);
tap.x = 80;
E.stepPlayer(tap, { l: 0, r: 0, j: 1, d: 0 }, 1 / 20, 0);
assert.ok(tap.vy < 0, "a tap jump on spawn works immediately");
const afterTap = tap.vy;
E.stepPlayer(tap, { l: 0, r: 0, j: 0, d: 0 }, 1 / 20, 0.05);
assert.ok(tap.vy < 0 || tap.y < E.CFG.ground - E.CFG.h - 8, "jump keeps going after the tap is released");
assert.ok(afterTap < -400, "jump has real lift");

const late = E.blankPlayer(7, "晚跳", E.COLORS[2], false);
late.x = 80;
E.stepPlayer(late, { l: 0, r: 0, j: 1, d: 0 }, 1 / 20, 0);
const up = late.vy;
E.stepPlayer(late, { l: 0, r: 0, j: 0, d: 0 }, 1 / 20, 0.05);
assert.ok(late.jbuf === 0 || late.vy <= up, "jump buffer is consumed on takeoff");

const r = E.blankPlayer(3, "冲冲", E.COLORS[2], false);
r.x = 80;
for (let i = 0; i < 8; i += 1) E.stepPlayer(r, { l: 0, r: 0, j: 0, d: 0 }, 1 / 20, i / 20);
E.stepPlayer(r, { l: 0, r: 1, d: 1, j: 0 }, 1 / 20, 1);
assert.ok(r.vx > 200, "dash gives a burst of speed");

const walk = E.blankPlayer(8, "前跑", E.COLORS[3], false);
walk.x = 80;
const x0 = walk.x;
for (let i = 0; i < 10; i += 1) E.stepPlayer(walk, { l: 0, r: 1, j: 0, d: 0 }, 1 / 20, i / 20);
assert.ok(walk.x > x0 + 40, "holding right actually runs forward");
assert.ok(walk.on, "running on the start floor stays grounded");
assert.ok(walk.x < 480, "short run stays on the first floor");

let runner = E.blankPlayer(4, "终点", E.COLORS[3], false);
runner.x = E.MAP.finishX - 10;
runner.y = E.CFG.ground - E.CFG.h;
for (let i = 0; i < 30; i += 1) E.stepPlayer(runner, { l: 0, r: 1, j: 0, d: 0 }, 1 / 20, i / 20);
assert.ok(runner.fin, "crossing the gate records a finish time");

const bot = E.blankPlayer(5, "bot", E.COLORS[4], true);
const input = E.botInput(bot, 0);
assert.strictEqual(input.r, true, "bots run to the right");

assert.ok(E.MAP.finishX > 3000, "course is a full obstacle run");
assert.ok(E.MAP.hazards.some((h) => h.kind === "hammer"), "course has swinging hammers");
assert.ok(E.MAP.plats.some((h) => h.kind === "vanish"), "course has vanishing floors");
assert.ok(E.MAP.plats.some((h) => h.kind === "spring"), "course has springs");
assert.ok(E.CFG.jumpBuf > 0, "jumps are buffered so a tap is not lost");
assert.ok(E.CFG.ground === 420, "start floor height is stable");
assert.ok(E.MAP.floor <= 520, "fallen eggs respawn before they sit under the course");

const first = E.blankPlayer(10, "开局", E.COLORS[0], false);
first.x = 50;
for (let i = 0; i < 24; i += 1) {
  E.stepPlayer(first, { l: 0, r: 1, j: 0, d: 0 }, 1 / 20, i / 20);
  assert.ok(first.y < 500, "first stretch does not drop the runner under the course");
}
assert.ok(first.x > 200, "first stretch actually moves forward");

console.log("eggy sim OK");
