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

console.log(`Sunshine English content OK · ${BOOK.units.length} units · ${words.size} words · ${checks} checks`);
