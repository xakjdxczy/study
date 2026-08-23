const assert = require("assert");
const E = require("../eggy/shared");

const p = E.blankPlayer(1, "蛋蛋", E.COLORS[0], false);
p.x = 80;
p.y = 360;
for (let i = 0; i < 40; i += 1) E.stepPlayer(p, { l: 0, r: 0, j: 0, d: 0 }, 1 / 30, i / 30);
assert.ok(p.y < 420, "egg stands on the start floor, not falling through");
assert.ok(p.on, "egg is grounded on the start floor");

const q = E.blankPlayer(2, "跳跳", E.COLORS[1], false);
q.x = 80;
q.y = 360;
for (let i = 0; i < 20; i += 1) E.stepPlayer(q, { l: 0, r: 0, j: 0, d: 0 }, 1 / 20, i / 20);
assert.ok(q.on, "egg has landed before jumping");
const y0 = q.y;
E.stepPlayer(q, { l: 0, r: 0, j: 1, d: 0 }, 1 / 20, 1);
assert.ok(q.vy < 0, "jump sends the egg up");
assert.ok(q.y <= y0, "jump does not drop the egg");

const r = E.blankPlayer(3, "冲冲", E.COLORS[2], false);
r.x = 80;
r.y = 360;
for (let i = 0; i < 20; i += 1) E.stepPlayer(r, { l: 0, r: 0, j: 0, d: 0 }, 1 / 20, i / 20);
E.stepPlayer(r, { l: 0, r: 1, d: 1, j: 0 }, 1 / 20, 1);
assert.ok(r.vx > 200, "dash gives a burst of speed");

let runner = E.blankPlayer(4, "终点", E.COLORS[3], false);
runner.x = E.MAP.finishX - 10;
runner.y = 360;
for (let i = 0; i < 30; i += 1) E.stepPlayer(runner, { l: 0, r: 1, j: 0, d: 0 }, 1 / 20, i / 20);
assert.ok(runner.fin, "crossing the gate records a finish time");

const bot = E.blankPlayer(5, "bot", E.COLORS[4], true);
const input = E.botInput(bot, 0);
assert.strictEqual(input.r, true, "bots run to the right");

assert.ok(E.MAP.finishX > 3000, "course is a full obstacle run");
assert.ok(E.MAP.hazards.some((h) => h.kind === "hammer"), "course has swinging hammers");
assert.ok(E.MAP.plats.some((h) => h.kind === "vanish"), "course has vanishing floors");
assert.ok(E.MAP.plats.some((h) => h.kind === "spring"), "course has springs");

console.log("eggy sim OK");
