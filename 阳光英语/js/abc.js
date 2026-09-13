/* 26-letter games for Sunshine English */
(function (root) {
  const HUES = [8, 22, 36, 48, 78, 132, 168, 196, 214, 248, 286, 328];

  function defaultState() {
    return {
      view: "hub",
      caseMode: "upper",
      focus: 0,
      listen: null,
      order: null,
      match: null,
      missing: null,
      start: null,
    };
  }

  function defaultAbcProgress() {
    return {
      learned: {},
      scores: {
        listen: null,
        order: null,
        match: null,
        missing: null,
        start: null,
      },
    };
  }

  let state = defaultState();
  let deps = {
    letters: [],
    escapeHtml: (s) => String(s),
    speak: () => {},
    progress: { abc: defaultAbcProgress() },
    saveProgress: () => {},
    rerender: () => {},
  };
  let orderTick = null;
  let flipTimer = null;
  let songChain = null;

  function letters() {
    return deps.letters;
  }

  function abc() {
    if (!deps.progress.abc) deps.progress.abc = defaultAbcProgress();
    if (!deps.progress.abc.learned) deps.progress.abc.learned = {};
    if (!deps.progress.abc.scores) deps.progress.abc.scores = defaultAbcProgress().scores;
    return deps.progress.abc;
  }

  function hue(i) {
    return HUES[i % HUES.length];
  }

  function tileStyle(i) {
    return `background: hsl(${hue(i)} 64% 46%);`;
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function optionsFor(answer, count = 4) {
    const pool = letters()
      .map((l) => l.letter)
      .filter((ch) => ch !== answer);
    const picks = shuffle(pool).slice(0, count - 1);
    return shuffle([answer, ...picks]);
  }

  function showLetter(ch, mode = state.caseMode) {
    return mode === "lower" ? ch.toLowerCase() : ch.toUpperCase();
  }

  function learnedCount() {
    return letters().filter((l) => abc().learned[l.letter]).length;
  }

  function scoreStars(score, total) {
    if (!score || !total) return 0;
    if (score === total) return 3;
    if (score >= Math.ceil(total * 0.6)) return 2;
    return 1;
  }

  function stars() {
    const data = abc();
    let n = 0;
    if (learnedCount() >= 26) n += 1;
    const listen = data.scores.listen;
    if (listen) n += scoreStars(listen.correct, listen.total) >= 2 ? 1 : 0;
    if (data.scores.order) n += 1;
    if (data.scores.match) n += 1;
    const missing = data.scores.missing;
    if (missing) n += scoreStars(missing.correct, missing.total) >= 2 ? 1 : 0;
    const start = data.scores.start;
    if (start) n += scoreStars(start.correct, start.total) >= 2 ? 1 : 0;
    return Math.min(6, n);
  }

  function clearTimers() {
    if (orderTick) {
      clearInterval(orderTick);
      orderTick = null;
    }
    if (flipTimer) {
      clearTimeout(flipTimer);
      flipTimer = null;
    }
    songChain = null;
  }

  function reset() {
    clearTimers();
    state = defaultState();
  }

  function goHub() {
    clearTimers();
    state = defaultState();
    deps.rerender();
  }

  function formatTime(ms) {
    const s = Math.max(0, ms) / 1000;
    return s.toFixed(1) + " 秒";
  }

  function speakLetter(item, withWord = false) {
    const ch = item.letter;
    deps.speak(withWord ? `${ch}, ${item.word}` : ch);
  }

  function renderStars(n, max = 3) {
    return "★".repeat(n) + "☆".repeat(max - n);
  }

  function hubCards() {
    const data = abc();
    return [
      {
        view: "learn",
        emoji: "📖",
        title: "认字母",
        desc: `点 A 到 Z，听读音、记单词。已会 ${learnedCount()} / 26。`,
        meta: learnedCount() >= 26 ? "已认完" : "还在认",
      },
      {
        view: "song",
        emoji: "🎵",
        title: "字母排队",
        desc: "跟着皮普从 A 念到 Z，看字母一个一个亮起来。",
        meta: "听一听",
      },
      {
        view: "listen",
        emoji: "👂",
        title: "听字母",
        desc: "听读音，选出听到的字母。一共 10 题。",
        meta: data.scores.listen ? `${data.scores.listen.correct}/${data.scores.listen.total}` : "还没玩",
      },
      {
        view: "order",
        emoji: "🏁",
        title: "按顺序",
        desc: "在打乱的字母里，按 A → Z 的顺序点完。",
        meta: data.scores.order ? formatTime(data.scores.order.ms) : "还没玩",
      },
      {
        view: "match",
        emoji: "🃏",
        title: "大小写",
        desc: "翻牌，把 A 和 a 配成一对。",
        meta: data.scores.match ? `${data.scores.match.moves} 步` : "还没玩",
      },
      {
        view: "missing",
        emoji: "❓",
        title: "缺哪个",
        desc: "一排字母少了一个，把它找回来。",
        meta: data.scores.missing ? `${data.scores.missing.correct}/${data.scores.missing.total}` : "还没玩",
      },
      {
        view: "start",
        emoji: "🍎",
        title: "开头字母",
        desc: "看见苹果，就要想到 A。看图选开头字母。",
        meta: data.scores.start ? `${data.scores.start.correct}/${data.scores.start.total}` : "还没玩",
      },
    ];
  }

  function renderHub() {
    const cards = hubCards()
      .map(
        (c) => `
        <button type="button" class="abc-mode" data-abc-view="${c.view}">
          <span class="abc-mode__emoji">${c.emoji}</span>
          <strong>${deps.escapeHtml(c.title)}</strong>
          <em>${deps.escapeHtml(c.desc)}</em>
          <span class="abc-mode__meta">${deps.escapeHtml(c.meta)}</span>
        </button>`
      )
      .join("");
    return `
      <section class="abc">
        <p class="kicker">ABC games</p>
        <p class="abc-hero-emoji" aria-hidden="true">🅰️</p>
        <h2>26 字母游戏</h2>
        <p class="zh-title">跟皮普玩 A 到 Z</p>
        <p class="lede">先认字母，再听一听、按顺序、对大小写。星星会记在这台设备上。</p>
        <p class="abc-stars">字母星星 ${stars()} / 6　${renderStars(Math.min(3, stars()), 3)}</p>
        <div class="abc-modes">${cards}</div>
        <div class="cta-row">
          <button type="button" class="btn btn--ghost" data-go="home">回主目录</button>
        </div>
      </section>
    `;
  }

  function renderLearn() {
    const item = letters()[state.focus] || letters()[0];
    const learned = abc().learned[item.letter];
    const wall = letters()
      .map((l, i) => {
        const on = i === state.focus ? " is-focus" : "";
        const done = abc().learned[l.letter] ? " is-learned" : "";
        return `<button type="button" class="abc-tile${on}${done}" data-abc-focus="${i}" style="${tileStyle(i)}" aria-label="${l.letter}">${showLetter(l.letter)}</button>`;
      })
      .join("");
    return `
      <section class="abc">
        <p class="kicker">Learn letters</p>
        <h2>认字母</h2>
        <p class="lede">点字母听读音。大字或单词也可以点。会了就按「我会了」。</p>
        <div class="cta-row">
          <button type="button" class="btn btn--ghost" data-abc-case="upper">大写 A</button>
          <button type="button" class="btn btn--ghost" data-abc-case="lower">小写 a</button>
          <button type="button" class="btn btn--primary" data-abc-speak-focus>听 ${showLetter(item.letter)}</button>
        </div>
        <article class="abc-focus" data-abc-speak-focus>
          <p class="abc-focus__emoji">${item.emoji}</p>
          <p class="abc-focus__letter">${showLetter(item.letter)} <span>${showLetter(item.letter, state.caseMode === "upper" ? "lower" : "upper")}</span></p>
          <p class="abc-focus__word">${deps.escapeHtml(item.word)} <span class="ipa">${deps.escapeHtml(item.ipa)}</span></p>
          <p class="zh">${deps.escapeHtml(item.zh)}</p>
          <button type="button" class="chip" data-abc-learn="${item.letter}">${learned ? "已会" : "我会了"}</button>
        </article>
        <div class="abc-wall" role="list">${wall}</div>
        <p class="lede">已会 ${learnedCount()} / 26</p>
        <div class="cta-row">
          <button type="button" class="btn btn--ghost" data-abc-hub>回游戏目录</button>
        </div>
      </section>
    `;
  }

  function renderSong() {
    const tiles = letters()
      .map(
        (l, i) =>
          `<span class="abc-song-tile" data-song="${i}" style="${tileStyle(i)}">${showLetter(l.letter)}</span>`
      )
      .join("");
    return `
      <section class="abc">
        <p class="kicker">Alphabet line</p>
        <h2>字母排队</h2>
        <p class="lede">按「从 A 念到 Z」，字母会跟着亮。也可以点任意一个再听一遍。</p>
        <div class="cta-row">
          <button type="button" class="btn btn--primary" data-abc-song>从 A 念到 Z</button>
          <button type="button" class="btn btn--ghost" data-abc-song-stop>停</button>
        </div>
        <div class="abc-song" id="abc-song">${tiles}</div>
        <div class="cta-row">
          <button type="button" class="btn btn--ghost" data-abc-hub>回游戏目录</button>
        </div>
      </section>
    `;
  }

  function renderQuizShell(title, kicker, lede, inner) {
    return `
      <section class="abc">
        <p class="kicker">${kicker}</p>
        <h2>${title}</h2>
        <p class="lede">${lede}</p>
        ${inner}
        <div class="cta-row">
          <button type="button" class="btn btn--ghost" data-abc-hub>回游戏目录</button>
        </div>
      </section>
    `;
  }

  function renderChoices(options, name) {
    return options
      .map(
        (ch) =>
          `<button type="button" class="abc-choice" data-${name}="${ch}" style="${tileStyle(ch.charCodeAt(0) - 65)}">${showLetter(ch)}</button>`
      )
      .join("");
  }

  function renderListen() {
    const g = state.listen;
    if (g.done) {
      return renderQuizShell(
        "听字母",
        "Listen",
        `做完了！${g.correct} / ${g.total}`,
        `<p class="abc-result">${g.correct === g.total ? "全对！耳朵真灵。" : "错的可以再听一遍。"}</p>
         <div class="cta-row"><button type="button" class="btn btn--primary" data-abc-view="listen">再玩一次</button></div>`
      );
    }
    const item = g.items[g.i];
    return renderQuizShell(
      "听字母",
      "Listen",
      `第 ${g.i + 1} / ${g.total} 题。先听，再选。`,
      `<div class="cta-row">
          <button type="button" class="btn btn--primary" data-abc-replay>▶ 再听一次</button>
        </div>
        <div class="abc-choices">${renderChoices(item.options, "abc-listen")}</div>
        <p class="abc-feedback" id="abc-feedback">${g.message || ""}</p>`
    );
  }

  function renderOrder() {
    const g = state.order;
    const next = letters()[g.next];
    if (g.done) {
      return renderQuizShell(
        "按顺序",
        "A to Z",
        `用了 ${formatTime(g.ms)}，点错 ${g.miss} 次。`,
        `<p class="abc-result">${g.miss === 0 ? "一次都没点错，真棒！" : "26 个字母都排好了。"}</p>
         <div class="cta-row"><button type="button" class="btn btn--primary" data-abc-view="order">再玩一次</button></div>`
      );
    }
    const tiles = g.order
      .map((idx) => {
        const l = letters()[idx];
        const done = idx < g.next ? " is-done" : "";
        return `<button type="button" class="abc-tile${done}" data-abc-order="${idx}" style="${tileStyle(idx)}">${showLetter(l.letter)}</button>`;
      })
      .join("");
    return renderQuizShell(
      "按顺序",
      "A to Z",
      `下一个是 <strong>${showLetter(next.letter)}</strong>`,
      `<p class="abc-timer" id="abc-timer">${formatTime(Date.now() - g.start)}</p>
       <div class="abc-wall abc-wall--play">${tiles}</div>
       <p class="lede">已点 ${g.next} / 26　点错 ${g.miss} 次</p>`
    );
  }

  function renderMatch() {
    const g = state.match;
    if (g.done) {
      return renderQuizShell(
        "大小写",
        "Match",
        `配完了，用了 ${g.moves} 步。`,
        `<p class="abc-result">${g.moves === g.cards.length / 2 ? "一步一对，记忆力很好！" : "A 和 a 都找到家了。"}</p>
         <div class="cta-row"><button type="button" class="btn btn--primary" data-abc-view="match">再玩一次</button></div>`
      );
    }
    const cards = g.cards
      .map((c, i) => {
        const open = c.face || c.matched;
        const cls = `abc-flip${c.matched ? " is-matched" : ""}${c.face ? " is-face" : ""}`;
        const face = c.kind === "upper" ? c.letter : c.letter.toLowerCase();
        return `<button type="button" class="${cls}" data-abc-flip="${i}" ${c.matched ? "disabled" : ""}>
          <span class="abc-flip__inner">${open ? face : "?"}</span>
        </button>`;
      })
      .join("");
    return renderQuizShell(
      "大小写",
      "Match",
      `把大写和小写配成一对。已配 ${g.matched} / ${g.cards.length / 2} 对，走了 ${g.moves} 步。`,
      `<div class="abc-flip-grid">${cards}</div>`
    );
  }

  function renderMissing() {
    const g = state.missing;
    if (g.done) {
      return renderQuizShell(
        "缺哪个",
        "Missing",
        `做完了！${g.correct} / ${g.total}`,
        `<p class="abc-result">${g.correct === g.total ? "一个都没漏掉。" : "再看一眼字母表，就更熟了。"}</p>
         <div class="cta-row"><button type="button" class="btn btn--primary" data-abc-view="missing">再玩一次</button></div>`
      );
    }
    const item = g.items[g.i];
    const row = item.shown
      .map((ch) =>
        ch
          ? `<span class="abc-song-tile" style="${tileStyle(ch.charCodeAt(0) - 65)}">${showLetter(ch)}</span>`
          : `<span class="abc-song-tile abc-song-tile--blank">?</span>`
      )
      .join("");
    return renderQuizShell(
      "缺哪个",
      "Missing",
      `第 ${g.i + 1} / ${g.total} 题。中间少了谁？`,
      `<div class="abc-song abc-song--row">${row}</div>
       <div class="abc-choices">${renderChoices(item.options, "abc-missing")}</div>
       <p class="abc-feedback" id="abc-feedback">${g.message || ""}</p>`
    );
  }

  function renderStart() {
    const g = state.start;
    if (g.done) {
      return renderQuizShell(
        "开头字母",
        "Starts with",
        `做完了！${g.correct} / ${g.total}`,
        `<p class="abc-result">${g.correct === g.total ? "单词开头都抓住了。" : "再看一遍图，记得更牢。"}</p>
         <div class="cta-row"><button type="button" class="btn btn--primary" data-abc-view="start">再玩一次</button></div>`
      );
    }
    const item = g.items[g.i];
    const rest = item.word.slice(1);
    return renderQuizShell(
      "开头字母",
      "Starts with",
      `第 ${g.i + 1} / ${g.total} 题。这个单词的开头是哪个字母？`,
      `<article class="abc-focus">
          <p class="abc-focus__emoji">${item.emoji}</p>
          <p class="abc-focus__word"><span class="abc-blank">_</span>${deps.escapeHtml(rest)}</p>
          <p class="zh">${deps.escapeHtml(item.zh)}</p>
        </article>
        <div class="abc-choices">${renderChoices(item.options, "abc-start")}</div>
        <p class="abc-feedback" id="abc-feedback">${g.message || ""}</p>`
    );
  }

  function render() {
    switch (state.view) {
      case "learn":
        return renderLearn();
      case "song":
        return renderSong();
      case "listen":
        return renderListen();
      case "order":
        return renderOrder();
      case "match":
        return renderMatch();
      case "missing":
        return renderMissing();
      case "start":
        return renderStart();
      default:
        return renderHub();
    }
  }

  function startListen() {
    const items = shuffle(letters())
      .slice(0, 10)
      .map((l) => ({
        letter: l.letter,
        options: optionsFor(l.letter),
      }));
    state.view = "listen";
    state.listen = { items, i: 0, correct: 0, total: items.length, done: false, message: "" };
    deps.rerender();
    deps.speak(items[0].letter);
  }

  function startOrder() {
    state.view = "order";
    state.order = {
      order: shuffle(letters().map((_, i) => i)),
      next: 0,
      miss: 0,
      start: Date.now(),
      ms: 0,
      done: false,
    };
    deps.rerender();
  }

  function startMatch() {
    const picks = shuffle(letters()).slice(0, 8);
    const cards = shuffle(
      picks.flatMap((l) => [
        { letter: l.letter, kind: "upper", face: false, matched: false },
        { letter: l.letter, kind: "lower", face: false, matched: false },
      ])
    );
    state.view = "match";
    state.match = { cards, open: [], matched: 0, moves: 0, lock: false, done: false };
    deps.rerender();
  }

  function startMissing() {
    const items = [];
    const used = new Set();
    while (items.length < 8) {
      const startAt = Math.floor(Math.random() * 22);
      const hole = Math.floor(Math.random() * 5);
      const key = `${startAt}-${hole}`;
      if (used.has(key)) continue;
      used.add(key);
      const run = letters().slice(startAt, startAt + 5);
      const answer = run[hole].letter;
      const shown = run.map((l, i) => (i === hole ? "" : l.letter));
      items.push({ shown, answer, options: optionsFor(answer) });
    }
    state.view = "missing";
    state.missing = { items, i: 0, correct: 0, total: items.length, done: false, message: "" };
    deps.rerender();
  }

  function startStart() {
    const items = shuffle(letters())
      .slice(0, 10)
      .map((l) => ({
        letter: l.letter,
        word: l.word,
        zh: l.zh,
        emoji: l.emoji,
        options: optionsFor(l.letter),
      }));
    state.view = "start";
    state.start = { items, i: 0, correct: 0, total: items.length, done: false, message: "" };
    deps.rerender();
  }

  function openView(view) {
    clearTimers();
    if (view === "learn") {
      state.view = "learn";
      deps.rerender();
      speakLetter(letters()[state.focus], true);
      return;
    }
    if (view === "song") {
      state.view = "song";
      deps.rerender();
      return;
    }
    if (view === "listen") return startListen();
    if (view === "order") return startOrder();
    if (view === "match") return startMatch();
    if (view === "missing") return startMissing();
    if (view === "start") return startStart();
    state.view = "hub";
    deps.rerender();
  }

  function afterPick(game, ok, answer) {
    if (!game || game.done || game.lock) return;
    game.lock = true;
    game.message = ok ? "对了！" : `是 ${showLetter(answer)}`;
    if (ok) game.correct += 1;
    const box = document.getElementById("abc-feedback");
    if (box) box.textContent = game.message;
    window.setTimeout(() => {
      game.i += 1;
      game.message = "";
      if (game.i >= game.total) {
        game.done = true;
        abc().scores[state.view] = { correct: game.correct, total: game.total };
        deps.saveProgress();
      } else {
        game.lock = false;
      }
      deps.rerender();
      if (!game.done && state.view === "listen") {
        deps.speak(game.items[game.i].letter);
      }
    }, ok ? 550 : 850);
  }

  function playSong(rootEl) {
    const tiles = [...rootEl.querySelectorAll(".abc-song-tile")];
    let i = 0;
    const token = {};
    songChain = token;
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    function mark(idx) {
      tiles.forEach((t, n) => t.classList.toggle("is-on", n === idx));
    }

    function next() {
      if (songChain !== token) return;
      if (i >= letters().length) {
        mark(-1);
        return;
      }
      mark(i);
      const text = letters()[i].letter;
      if (!window.speechSynthesis) {
        i += 1;
        window.setTimeout(next, 400);
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.9;
      utter.onend = () => {
        i += 1;
        next();
      };
      utter.onerror = () => {
        i += 1;
        next();
      };
      window.speechSynthesis.speak(utter);
    }
    next();
  }

  function bindOrderTimer() {
    clearTimers();
    if (!state.order || state.order.done) return;
    orderTick = setInterval(() => {
      const el = document.getElementById("abc-timer");
      if (el && state.order && !state.order.done) {
        el.textContent = formatTime(Date.now() - state.order.start);
      }
    }, 100);
  }

  function bind(root) {
    root.querySelectorAll("[data-abc-view]").forEach((btn) => {
      btn.addEventListener("click", () => openView(btn.dataset.abcView));
    });
    root.querySelectorAll("[data-abc-hub]").forEach((btn) => {
      btn.addEventListener("click", goHub);
    });
    root.querySelectorAll("[data-abc-case]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.caseMode = btn.dataset.abcCase;
        deps.rerender();
      });
    });
    root.querySelectorAll("[data-abc-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.focus = Number(btn.dataset.abcFocus);
        deps.rerender();
        speakLetter(letters()[state.focus], true);
      });
    });
    root.querySelectorAll("[data-abc-speak-focus]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        speakLetter(letters()[state.focus], el.tagName === "ARTICLE");
      });
    });
    root.querySelectorAll("[data-abc-learn]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const ch = btn.dataset.abcLearn;
        abc().learned[ch] = !abc().learned[ch];
        deps.saveProgress();
        deps.rerender();
      });
    });
    root.querySelectorAll("[data-abc-song]").forEach((btn) => {
      btn.addEventListener("click", () => playSong(root));
    });
    root.querySelectorAll("[data-abc-song-stop]").forEach((btn) => {
      btn.addEventListener("click", () => {
        songChain = null;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        root.querySelectorAll(".abc-song-tile").forEach((t) => t.classList.remove("is-on"));
      });
    });
    root.querySelectorAll("[data-song]").forEach((tile) => {
      tile.addEventListener("click", () => {
        const i = Number(tile.dataset.song);
        state.focus = i;
        speakLetter(letters()[i]);
      });
    });
    root.querySelectorAll("[data-abc-replay]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = state.listen && state.listen.items[state.listen.i];
        if (item) deps.speak(item.letter);
      });
    });
    root.querySelectorAll("[data-abc-listen]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.listen || state.listen.done) return;
        const pick = btn.dataset.abcListen;
        const item = state.listen.items[state.listen.i];
        afterPick(state.listen, pick === item.letter, item.letter);
      });
    });
    root.querySelectorAll("[data-abc-order]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = state.order;
        if (!g || g.done) return;
        const idx = Number(btn.dataset.abcOrder);
        if (idx === g.next) {
          g.next += 1;
          if (g.next >= 26) {
            g.done = true;
            g.ms = Date.now() - g.start;
            abc().scores.order = { ms: g.ms, miss: g.miss };
            deps.saveProgress();
          }
          deps.rerender();
        } else if (idx >= g.next) {
          g.miss += 1;
          btn.classList.add("is-miss");
          deps.speak(letters()[g.next].letter);
          window.setTimeout(() => btn.classList.remove("is-miss"), 280);
        }
      });
    });
    root.querySelectorAll("[data-abc-flip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = state.match;
        if (!g || g.done || g.lock) return;
        const i = Number(btn.dataset.abcFlip);
        const card = g.cards[i];
        if (card.face || card.matched) return;
        card.face = true;
        g.open.push(i);
        if (g.open.length < 2) {
          deps.rerender();
          return;
        }
        g.moves += 1;
        const a = g.cards[g.open[0]];
        const b = g.cards[g.open[1]];
        if (a.letter === b.letter && a.kind !== b.kind) {
          a.matched = true;
          b.matched = true;
          g.matched += 1;
          g.open = [];
          if (g.matched === g.cards.length / 2) {
            g.done = true;
            abc().scores.match = { moves: g.moves };
            deps.saveProgress();
          }
          deps.rerender();
        } else {
          g.lock = true;
          deps.rerender();
          flipTimer = setTimeout(() => {
            a.face = false;
            b.face = false;
            g.open = [];
            g.lock = false;
            deps.rerender();
          }, 750);
        }
      });
    });
    root.querySelectorAll("[data-abc-missing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.missing || state.missing.done) return;
        const item = state.missing.items[state.missing.i];
        afterPick(state.missing, btn.dataset.abcMissing === item.answer, item.answer);
      });
    });
    root.querySelectorAll("[data-abc-start]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.start || state.start.done) return;
        const item = state.start.items[state.start.i];
        afterPick(state.start, btn.dataset.abcStart === item.letter, item.letter);
      });
    });

    if (state.view === "order") bindOrderTimer();
  }

  function onKey(e) {
    if (state.view !== "order" || !state.order || state.order.done) return;
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    const idx = e.key.toUpperCase().charCodeAt(0) - 65;
    const btn = document.querySelector(`[data-abc-order="${idx}"]`);
    btn?.click();
  }

  root.ABC = {
    init(next) {
      deps = { ...deps, ...next };
    },
    reset,
    render,
    bind,
    openView,
    onKey,
    stars,
    learnedCount,
    defaultAbcProgress,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
