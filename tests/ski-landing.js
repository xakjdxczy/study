const assert = require("assert");

function wrapTau(a) {
  const t = Math.PI * 2;
  a = ((a % t) + t) % t;
  return a > Math.PI ? a - t : a;
}

const SPIN_HOLD = 0.18;
const LAND_TILT = 2.4;
const LAND_TILT_FLIP = 2.7;
const SPIN = 7.4;

function landingStumble(tilt, flips) {
  return Math.abs(tilt) > (flips > 0 ? LAND_TILT_FLIP : LAND_TILT);
}

function tiltAfter(airTime, holdTime) {
  const spinT = Math.max(0, Math.min(holdTime, airTime) - SPIN_HOLD);
  return Math.abs(wrapTau(spinT * SPIN));
}

assert.strictEqual(landingStumble(0, 0), false, "upright landing is fine");
assert.strictEqual(landingStumble(1.12, 0), false, "old 64-degree fail now lands");
assert.strictEqual(landingStumble(Math.PI * 0.5, 0), false, "90-degree tilt still lands");
assert.strictEqual(landingStumble(2.2, 0), false, "about 126 degrees still lands");
assert.strictEqual(landingStumble(Math.PI, 0), true, "upside-down landing still stumbles");
assert.strictEqual(landingStumble(2.5, 1), false, "after a flip, 143 degrees lands");
assert.strictEqual(landingStumble(Math.PI, 1), true, "after a flip, upside-down still stumbles");

assert.strictEqual(landingStumble(tiltAfter(0.5, 0.12), 0), false, "quick tap does not spin");
assert.strictEqual(landingStumble(tiltAfter(0.55, 0.28), 0), false, "short hold on a hop lands");
assert.strictEqual(landingStumble(tiltAfter(0.72, 0.72), 0), false, "holding a normal jump lands");
assert.ok(tiltAfter(0.2, 0.2) < 1.12, "a sloppy tap stays under the old fail line");

console.log("ski landing feel OK");
