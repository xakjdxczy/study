#!/usr/bin/env node
const assert = require("assert");
const path = require("path");
const BOOK = require(path.join(__dirname, "..", "js", "content.js"));

const KINDS = ["choice", "fill", "order", "tf", "listen"];
let checks = 0;

function ok(cond, message) {
  assert.ok(cond, message);
  checks += 1;
}

ok(BOOK.meta.title === "Sunshine English", "book title");
ok(BOOK.units.length === 12, "twelve units");
ok(Array.isArray(BOOK.letters) && BOOK.letters.length === 26, "26 letters");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
BOOK.letters.forEach((item, i) => {
  ok(item.letter === alphabet[i], `letter order ${alphabet[i]}`);
  ok(item.word && item.zh && item.emoji && item.ipa, `letter fields ${item.letter}`);
  ok(item.word[0].toUpperCase() === item.letter, `word starts with ${item.letter}: ${item.word}`);
});

const words = new Set();
BOOK.units.forEach((unit) => {
  ok(unit.id >= 1 && unit.title && unit.titleZh, `unit ${unit.id} titles`);
  ok(unit.goals.length >= 3, `unit ${unit.id} goals`);
  ok(unit.dialogue.lines.length >= 6, `unit ${unit.id} dialogue`);
  ok(unit.vocab.length >= 8, `unit ${unit.id} vocab`);
  ok(unit.grammar.examples.length >= 3, `unit ${unit.id} grammar`);
  ok(unit.reading.text.length > 80, `unit ${unit.id} reading`);
  ok(unit.practice.length === 6, `unit ${unit.id} has 6 practice items`);
  ok(unit.fun.chant.length >= 4, `unit ${unit.id} chant`);

  unit.vocab.forEach((w) => {
    ok(w.en && w.ipa && w.zh && w.example, `vocab complete: ${w.en}`);
    ok(!w.ipa.includes("�"), `ipa clean: ${w.en}`);
    words.add(w.en);
  });

  unit.practice.forEach((item, i) => {
    ok(KINDS.includes(item.type), `U${unit.id} Q${i + 1} type`);
    if (item.type === "choice" || item.type === "listen") {
      ok(Array.isArray(item.options) && item.options.length >= 3, `U${unit.id} Q${i + 1} options`);
      ok(item.answer >= 0 && item.answer < item.options.length, `U${unit.id} Q${i + 1} answer index`);
    }
    if (item.type === "listen") ok(item.audio && item.options.includes(item.audio), `U${unit.id} listen matches`);
    if (item.type === "fill") ok(item.answer && item.q.includes("_____"), `U${unit.id} fill`);
    if (item.type === "order") {
      const joined = item.words.join(" ").replace(/\s+\?/g, "?").replace(/\s+\./g, ".");
      ok(item.answer && item.words.length >= 3, `U${unit.id} order words`);
      const normalizedAnswer = item.answer.replace(/[.?]/g, (m) => ` ${m}`).replace(/\s+/g, " ").trim();
      const fromWords = item.words.join(" ");
      ok(
        item.words.every((w) => item.answer.includes(w.replace(/[.?]/g, "")) || item.answer.includes(w)),
        `U${unit.id} order uses its words (${fromWords} -> ${item.answer})`
      );
      ok(joined.split(" ").length >= 3, `order not empty ${joined}`);
    }
    if (item.type === "tf") ok(typeof item.answer === "boolean", `U${unit.id} tf`);
  });
});

ok(words.size >= 80, `enough unique words (${words.size})`);

const fs = require("fs");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
ok(app.includes('key: "home"'), "home page is registered");
ok(app.includes("主目录"), "main menu label exists");
ok(app.includes("function renderHome"), "main menu renderer exists");
ok(app.includes('key: "hello"'), "hello world page is registered");
ok(app.includes("Hello, world!"), "hello world text exists");
ok(app.includes("function renderHello"), "hello world renderer exists");
ok(app.includes('key: "abc"'), "abc game page is registered");
ok(app.includes("26字母游戏") || app.includes("26 字母游戏"), "abc game label exists");
ok(app.includes("function renderAbc"), "abc game renderer exists");
ok(app.includes("滑雪大冒险"), "ski game card exists");
ok(app.includes('href: "ski/"'), "ski game links to ski folder");

const abcSrc = fs.readFileSync(path.join(__dirname, "..", "js", "abc.js"), "utf8");
ok(abcSrc.includes("function startListen"), "listen game exists");
ok(abcSrc.includes("function startOrder"), "order game exists");
ok(abcSrc.includes("function startMatch"), "match game exists");
ok(abcSrc.includes("function startMissing"), "missing game exists");
ok(abcSrc.includes("function startStart"), "starts-with game exists");
ok(abcSrc.includes("function playSong"), "alphabet line exists");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
ok(html.includes("js/abc.js"), "abc script is on the page");

const skiHtml = fs.readFileSync(path.join(__dirname, "..", "ski", "index.html"), "utf8");
const skiJs = fs.readFileSync(path.join(__dirname, "..", "ski", "game.js"), "utf8");
ok(skiHtml.includes("滑雪大冒险"), "ski title exists");
ok(skiHtml.includes("game.js"), "ski script is on the page");
ok(skiHtml.includes("fullBtn"), "ski page has a fullscreen button");
ok(skiJs.includes("requestFullscreen") || skiJs.includes("webkitRequestFullscreen"), "ski can request browser fullscreen");
ok(skiJs.includes("toggleFs") || skiJs.includes("toggleFullscreen"), "ski can toggle fullscreen");
ok(skiJs.includes("function spawnAhead"), "ski spawn exists");
ok(skiJs.includes("function jump"), "ski jump exists");
ok(skiJs.includes("p.x += p.speed * dt"), "ski scrolls the skier to the right");
ok(skiJs.includes("G.avaX"), "ski tracks avalanche on the left");
ok(skiJs.includes("function stumble"), "ski stumble recovery exists");
ok(skiJs.includes("function landingStumble"), "ski landing uses a forgiving tilt check");
ok(skiJs.includes("SPIN_HOLD"), "ski delays backflip spin so a tap does not count as a bad landing");
ok(skiJs.includes("didSpin"), "ski only tilt-checks landings after a real backflip spin");
ok(skiJs.includes('stumble("land")'), "ski counts landing stumbles separately from hits");
ok(!skiJs.includes("land > 1.12"), "ski no longer uses the strict 64-degree landing fail");
ok(skiJs.includes("雪崩"), "ski avalanche warning exists");
ok(skiJs.includes("penguin"), "ski penguins exist");
ok(skiJs.includes("yeti"), "ski yetis exist");
ok(skiJs.includes("PipSki"), "ski test hooks exist");

require(path.join(__dirname, "..", "js", "abc.js"));
const abcProgress = { abc: global.ABC.defaultAbcProgress() };
global.ABC.init({
  letters: BOOK.letters,
  escapeHtml: (s) => String(s),
  speak: () => {},
  progress: abcProgress,
  saveProgress: () => {},
  rerender: () => {},
});
ok(global.ABC.render().includes("26 字母游戏"), "abc hub title");
global.ABC.openView("learn");
ok(global.ABC.render().includes("认字母"), "learn view");
ok(global.ABC.render().includes("apple"), "learn shows apple");
global.ABC.openView("listen");
ok(global.ABC.render().includes("听字母"), "listen view");
ok((global.ABC.render().match(/data-abc-listen/g) || []).length === 4, "listen has 4 choices");
global.ABC.openView("order");
ok((global.ABC.render().match(/data-abc-order/g) || []).length === 26, "order has 26 tiles");
global.ABC.openView("match");
ok((global.ABC.render().match(/data-abc-flip/g) || []).length === 16, "match has 16 cards");
global.ABC.openView("missing");
ok(global.ABC.render().includes("缺哪个"), "missing view");
ok(global.ABC.render().includes("abc-song-tile--blank"), "missing has a blank");
global.ABC.openView("start");
ok(global.ABC.render().includes("开头字母"), "start view");
ok(global.ABC.render().includes("abc-blank"), "start masks first letter");
global.ABC.reset();
ok(global.ABC.render().includes("abc-modes"), "reset returns to hub");

console.log(
  `Sunshine English content OK · ${BOOK.units.length} units · ${BOOK.letters.length} letters · ${words.size} words · ${checks} checks`
);
