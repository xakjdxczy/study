const assert = require("assert");
const F = require("../fighter/shared");

const p = F.blankPlayer(1, "雷霆", F.COLORS[0], false);
assert.ok(p.y > F.CFG.H * 0.7, "player starts at the bottom of the sky");
assert.strictEqual(p.pow, 1, "new jet starts at weapon level 1");

const s1 = F.weaponShots(p);
assert.strictEqual(s1.length, 1, "level 1 is a single shot");
p.pow = 3;
assert.ok(F.weaponShots(p).length >= 3, "level 3 spreads more bullets");
p.pow = 5;
assert.ok(F.weaponShots(p).some((s) => s.kind === "laser"), "max power adds lasers");

const world = F.blankWorld();
F.firePlayer(world, p);
assert.ok(world.bullets.length >= 1, "firing adds player bullets");
assert.ok(world.bullets.every((b) => b.side === 1), "player bullets are friendly");

const drop = { kind: "pow" };
F.collectDrop(p, drop);
assert.strictEqual(p.pow, 5, "collecting P upgrades the cannon");
p.pow = 2;
F.collectDrop(p, { kind: "bomb" });
assert.ok(p.bombs > 3, "collecting B adds a bomb");
F.collectDrop(p, { kind: "shield" });
assert.ok(p.shield > 0, "collecting S gives a shield");

const inputs = new Map();
inputs.set(1, { ax: 1, ay: 0, f: 1, auto: 1, b: 0 });
const x0 = p.x;
F.stepWorld(world, [p], inputs, 1 / 30);
assert.ok(p.x > x0, "holding right moves the jet");

const dummy = F.blankWorld();
dummy.t = 1;
F.spawnWave(dummy, [p]);
assert.ok(dummy.enemies.length >= 1, "waves spawn enemy planes from the sky");

const target = F.blankPlayer(2, "靶", F.COLORS[1], false);
const hunt = F.blankWorld();
hunt.enemies.push({ id: 9, kind: "scout", x: target.x, y: target.y - 40, hp: 1, vx: 0, vy: 0, t: 0, fire: 9, boss: false });
hunt.bullets.push({ id: 10, x: target.x, y: target.y - 20, vx: 0, vy: -400, side: 1, kind: "n", dmg: 1, owner: p.id, life: 1 });
F.stepWorld(hunt, [p], inputs, 1 / 30);
assert.ok(hunt.enemies.length === 0 || hunt.enemies[0].hp < 1, "player shots hit enemy planes");

p.inv = 0;
p.shield = 0;
p.lives = 3;
F.hurtPlayer(p);
assert.strictEqual(p.lives, 2, "a hit costs a life");
assert.ok(p.inv > 0, "a hit grants brief invincibility");
p.shield = 3;
p.inv = 0;
const lives = p.lives;
F.hurtPlayer(p);
assert.strictEqual(p.lives, lives, "a shield soaks one hit");

p.bombs = 2;
p.bombCd = 0;
p.dead = 0;
hunt.bullets.push({ id: 11, x: 10, y: 10, vx: 0, vy: 80, side: 2, kind: "e", dmg: 1, life: 1 });
F.useBomb(hunt, p);
assert.strictEqual(p.bombs, 1, "bomb spends a charge");
assert.ok(hunt.bullets.every((b) => b.side === 1), "bomb clears enemy bullets");
assert.ok(hunt.flash > 0, "bomb flashes the sky");
assert.ok((hunt.pops || []).some((pop) => pop.txt === "清屏"), "bomb shows a clear-sky cue");

p.pow = 2;
const popWorld = F.blankWorld();
F.collectDrop(p, { kind: "pow" }, popWorld);
assert.ok(popWorld.pops.some((pop) => String(pop.txt).includes("火力")), "collecting P shows a power-up cue");

p.lives = 1;
p.inv = 0;
p.shield = 0;
p.dead = 0;
F.hurtPlayer(p);
assert.strictEqual(p.lives, 0, "the last hit spends the final life");
assert.ok(p.dead > 0, "the last hit knocks the jet out");
F.stepPlayer(popWorld, p, { ax: 1, f: 1, auto: 1 }, 1 / 30);
assert.ok(p.dead > 0 && p.lives <= 0, "a jet with no lives stays out of the fight");

const bot = F.blankPlayer(3, "僚机", F.COLORS[2], true);
const bi = F.botInput(bot, world);
assert.ok(bi.f || bi.auto, "wingmen keep firing");

assert.ok(F.CFG.maxPow >= 5, "weapon has several upgrade steps");
assert.ok(F.CFG.stages >= 3, "there are multiple stages");

console.log("fighter sim OK");
