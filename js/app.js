(() => {
  const BOOK = window.TEXTBOOK;
  const STORAGE_KEY = "sunshine-english-g5";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const PAGE_KINDS = [
    ["cover", "单元封面"],
    ["dialogue", "一起说"],
    ["vocab", "认单词"],
    ["grammar", "句型屋"],
    ["reading", "读一读"],
    ["practice", "练一练"],
    ["fun", "唱一唱"],
  ];

  function buildPages() {
    const pages = [
      { key: "cover", kind: "book-cover" },
      { key: "toc", kind: "toc" },
    ];
    for (const unit of BOOK.units) {
      for (const [kind] of PAGE_KINDS) {
        pages.push({ key: `u${unit.id}-${kind}`, kind, unitId: unit.id });
      }
    }
    pages.push({ key: "words", kind: "wordbank" });
    pages.push({ key: "progress", kind: "progress" });
    return pages;
  }

  const pages = buildPages();

  function defaultProgress() {
    return {
      lastKey: "cover",
      seen: {},
      practice: {},
      learned: {},
      letter: "",
    };
  }

  function loadProgress() {
    try {
      return { ...defaultProgress(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  let progress = loadProgress();
  let pageIndex = Math.max(0, pages.findIndex((p) => p.key === progress.lastKey));
  if (pageIndex < 0) pageIndex = 0;

  function unitById(id) {
    return BOOK.units.find((u) => u.id === id);
  }

  function speak(text, { rate = 0.88, lang = "en-US" } = {}) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith("en") && /US|UK|GB/i.test(v.lang)) || voices.find((v) => v.lang.startsWith("en"));
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }

  function stopSpeak() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl(text) {
    return escapeHtml(text).replace(/\n/g, "<br />");
  }

  function markSeen(key) {
    progress.seen[key] = true;
    if (key !== "cover" && key !== "toc" && key !== "words" && key !== "progress") {
      progress.lastKey = key;
    }
    saveProgress();
  }

  function unitScore(unitId) {
    return progress.practice[String(unitId)] || null;
  }

  function unitDone(unit) {
    return PAGE_KINDS.every(([kind]) => progress.seen[`u${unit.id}-${kind}`]);
  }

  function starsFor(unit) {
    const score = unitScore(unit.id);
    if (score && score.total && score.correct === score.total) return 3;
    if (score && score.correct >= Math.ceil(score.total * 0.6)) return 2;
    if (unitDone(unit) || score) return 1;
    return 0;
  }

  function totalStars() {
    return BOOK.units.reduce((sum, u) => sum + starsFor(u), 0);
  }

  function allWords() {
    return BOOK.units.flatMap((u) => u.vocab.map((w) => ({ ...w, unitId: u.id, unitTitle: u.title })));
  }

  function renderStars(n) {
    return "★".repeat(n) + "☆".repeat(3 - n);
  }

  function goTo(key) {
    const idx = pages.findIndex((p) => p.key === key);
    if (idx < 0) return;
    pageIndex = idx;
    render();
  }

  function goBy(delta) {
    pageIndex = Math.max(0, Math.min(pages.length - 1, pageIndex + delta));
    render();
  }

  function currentPage() {
    return pages[pageIndex];
  }

  function render() {
    stopSpeak();
    const page = currentPage();
    markSeen(page.key);
    const app = $("#app");
    app.innerHTML = `
      ${renderTopbar(page)}
      <main class="sheet" id="sheet">${renderPage(page)}</main>
      ${renderPager(page)}
    `;
    bindGlobal();
    bindPage(page);
    $("#sheet").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function renderTopbar(page) {
    const unit = page.unitId ? unitById(page.unitId) : null;
    const crumb = unit ? `第 ${unit.id} 单元 · ${unit.title}` : BOOK.meta.titleZh;
    return `
      <header class="topbar">
        <button type="button" class="icon-btn" data-go="cover" aria-label="回到封面">☀</button>
        <div class="crumb">
          <strong>${escapeHtml(crumb)}</strong>
          <span>${escapeHtml(kindLabel(page))}</span>
        </div>
        <nav class="top-nav">
          <button type="button" data-go="toc">目录</button>
          <button type="button" data-go="words">生词</button>
          <button type="button" data-go="progress">进度 ${totalStars()}/36</button>
        </nav>
      </header>
    `;
  }

  function kindLabel(page) {
    if (page.kind === "book-cover") return "封面";
    if (page.kind === "toc") return "目录";
    if (page.kind === "wordbank") return "生词本";
    if (page.kind === "progress") return "我的星星";
    const found = PAGE_KINDS.find(([k]) => k === page.kind);
    return found ? found[1] : "";
  }

  function renderPager(page) {
    const prev = pages[pageIndex - 1];
    const next = pages[pageIndex + 1];
    return `
      <footer class="pager">
        <button type="button" class="btn btn--ghost" data-step="-1" ${pageIndex === 0 ? "disabled" : ""}>上一页</button>
        <p class="pager__num">${pageIndex + 1} / ${pages.length}</p>
        <button type="button" class="btn btn--primary" data-step="1" ${pageIndex === pages.length - 1 ? "disabled" : ""}>${next ? "下一页" : "到末页了"}</button>
      </footer>
    `;
  }

  function renderPage(page) {
    switch (page.kind) {
      case "book-cover":
        return renderCover();
      case "toc":
        return renderToc();
      case "cover":
        return renderUnitCover(unitById(page.unitId));
      case "dialogue":
        return renderDialogue(unitById(page.unitId));
      case "vocab":
        return renderVocab(unitById(page.unitId));
      case "grammar":
        return renderGrammar(unitById(page.unitId));
      case "reading":
        return renderReading(unitById(page.unitId));
      case "practice":
        return renderPractice(unitById(page.unitId));
      case "fun":
        return renderFun(unitById(page.unitId));
      case "wordbank":
        return renderWordbank();
      case "progress":
        return renderProgress();
      default:
        return "<p>这一页还在装订中。</p>";
    }
  }

  function renderCover() {
    return `
      <section class="cover">
        <p class="cover__series">小学英语互动课本</p>
        <h1 class="cover__zh">${escapeHtml(BOOK.meta.titleZh)}</h1>
        <p class="cover__en">${escapeHtml(BOOK.meta.title)}</p>
        <div class="cover__badge">
          <span>${escapeHtml(BOOK.meta.grade)}</span>
          <span>${escapeHtml(BOOK.meta.volume)}</span>
        </div>
        <div class="mascot" aria-hidden="true">
          <div class="fox">🦊</div>
          <p>大家好，我是${escapeHtml(BOOK.meta.mascotZh)}！</p>
        </div>
        <p class="lede">${escapeHtml(BOOK.meta.blurb)}</p>
        <div class="cta-row">
          <button type="button" class="btn btn--primary" data-go="toc">打开目录</button>
          <button type="button" class="btn btn--ghost" data-go="${progress.lastKey !== "cover" ? progress.lastKey : "u1-cover"}">继续阅读</button>
        </div>
        <ul class="cover__cast">
          <li>Lily 莉莉</li>
          <li>Tom 汤姆</li>
          <li>Maya 玛雅</li>
          <li>Ben 本</li>
          <li>Ms. Green 格林老师</li>
          <li>Pip 皮普</li>
        </ul>
      </section>
    `;
  }

  function renderToc() {
    const cards = BOOK.units
      .map((u) => {
        const s = starsFor(u);
        return `
          <button type="button" class="toc-card" data-go="u${u.id}-cover" style="--unit:${u.color}">
            <span class="toc-card__no">Unit ${u.id}</span>
            <span class="toc-card__emoji">${u.emoji}</span>
            <strong>${escapeHtml(u.title)}</strong>
            <em>${escapeHtml(u.titleZh)}</em>
            <span class="stars" aria-label="${s} 颗星">${renderStars(s)}</span>
          </button>
        `;
      })
      .join("");
    return `
      <section>
        <p class="kicker">Contents</p>
        <h2>目录</h2>
        <p class="lede lede--wide">十二个单元，跟着皮普从“他是什么样的人”走到“给朋友写一封信”。点进一课就可以听、读、练。</p>
        <div class="toc-grid">${cards}</div>
        <div class="cta-row">
          <button type="button" class="btn btn--ghost" data-go="words">生词本</button>
          <button type="button" class="btn btn--ghost" data-go="progress">我的星星</button>
        </div>
      </section>
    `;
  }

  function renderUnitCover(unit) {
    const goals = unit.goals.map((g) => `<li>${escapeHtml(g)}</li>`).join("");
    return `
      <section class="unit-hero" style="--unit:${unit.color}">
        <p class="kicker">Unit ${unit.id}</p>
        <p class="unit-hero__emoji">${unit.emoji}</p>
        <h2>${escapeHtml(unit.title)}</h2>
        <p class="zh-title">${escapeHtml(unit.titleZh)}</p>
        <h3>这节课我们会</h3>
        <ul class="goals">${goals}</ul>
        <div class="cta-row">
          <button type="button" class="btn btn--primary" data-step="1">开始上课</button>
        </div>
      </section>
    `;
  }

  function renderDialogue(unit) {
    const d = unit.dialogue;
    const lines = d.lines
      .map(
        (line, i) => `
        <article class="line" data-line="${i}">
          <button type="button" class="line__speak" data-speak="${escapeHtml(line.text)}" aria-label="朗读">🔊</button>
          <div>
            <p class="line__who">${escapeHtml(line.speaker)}</p>
            <p class="line__en">${escapeHtml(line.text)}</p>
            <p class="line__zh">${escapeHtml(line.zh)}</p>
          </div>
        </article>
      `
      )
      .join("");
    const all = d.lines.map((l) => `${l.speaker}: ${l.text}`).join(". ");
    return `
      <section>
        <p class="kicker">Let's talk</p>
        <h2>${escapeHtml(d.title)}</h2>
        <p class="zh-title">${escapeHtml(d.titleZh)}</p>
        <p class="scene">${escapeHtml(d.scene)}<br /><span>${escapeHtml(d.sceneZh)}</span></p>
        <div class="cta-row">
          <button type="button" class="btn btn--primary" data-speak-all="${escapeHtml(all)}">整段跟读</button>
        </div>
        <div class="dialogue">${lines}</div>
      </section>
    `;
  }

  function renderVocab(unit) {
    const cards = unit.vocab
      .map((w) => {
        const learned = progress.learned[w.en] ? " is-learned" : "";
        return `
          <article class="word-card${learned}" data-word="${escapeHtml(w.en)}">
            <button type="button" class="word-card__en" data-speak="${escapeHtml(w.en)}">${escapeHtml(w.en)}</button>
            <p class="ipa">${escapeHtml(w.ipa)}</p>
            <p class="zh">${escapeHtml(w.zh)}</p>
            <p class="ex" data-speak="${escapeHtml(w.example)}">${escapeHtml(w.example)}</p>
            <p class="ex-zh">${escapeHtml(w.exampleZh)}</p>
            <button type="button" class="chip" data-learn="${escapeHtml(w.en)}">${progress.learned[w.en] ? "已会" : "我会了"}</button>
          </article>
        `;
      })
      .join("");
    return `
      <section>
        <p class="kicker">Let's learn</p>
        <h2>本课单词</h2>
        <p class="lede">点英文可以听发音，点例句可以听整句。觉得会了，就按“我会了”。</p>
        <div class="word-grid">${cards}</div>
      </section>
    `;
  }

  function renderGrammar(unit) {
    const g = unit.grammar;
    const notes = g.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("");
    const examples = g.examples
      .map(
        (ex) => `
        <li>
          <button type="button" class="plain-speak" data-speak="${escapeHtml(ex.en)}">${escapeHtml(ex.en)}</button>
          <span>${escapeHtml(ex.zh)}</span>
        </li>`
      )
      .join("");
    return `
      <section>
        <p class="kicker">Grammar house</p>
        <h2>${escapeHtml(g.title)}</h2>
        <p class="zh-title">${escapeHtml(g.titleZh)}</p>
        <p class="pattern" data-speak="${escapeHtml(g.pattern)}">${escapeHtml(g.pattern)}</p>
        <ul class="notes">${notes}</ul>
        <h3>看例子</h3>
        <ul class="examples">${examples}</ul>
      </section>
    `;
  }

  function renderReading(unit) {
    const r = unit.reading;
    return `
      <section>
        <p class="kicker">Let's read</p>
        <h2>${escapeHtml(r.title)}</h2>
        <p class="zh-title">${escapeHtml(r.titleZh)}</p>
        <div class="cta-row">
          <button type="button" class="btn btn--primary" data-speak-all="${escapeHtml(r.text)}">听短文</button>
          <button type="button" class="btn btn--ghost" id="toggle-zh">显示中文</button>
        </div>
        <article class="reading" data-speak-all="${escapeHtml(r.text)}">${nl(r.text)}</article>
        <article class="reading reading--zh hidden" id="reading-zh">${nl(r.textZh)}</article>
      </section>
    `;
  }

  function renderPractice(unit) {
    const saved = unitScore(unit.id);
    const items = unit.practice
      .map((item, i) => renderItem(item, i, saved))
      .join("");
    return `
      <section>
        <p class="kicker">Practice</p>
        <h2>练一练</h2>
        <p class="lede">做完点“交卷”。听一听的题目，先按喇叭再选。</p>
        <form class="quiz" id="quiz" data-unit="${unit.id}">
          ${items}
          <div class="cta-row">
            <button type="submit" class="btn btn--primary">交卷</button>
            <button type="button" class="btn btn--ghost" id="reset-quiz">重做</button>
          </div>
          <p class="quiz-result" id="quiz-result">${saved ? `上次 ${saved.correct} / ${saved.total}` : ""}</p>
        </form>
      </section>
    `;
  }

  function renderItem(item, i, saved) {
    const head = `<p class="q-head"><span>第 ${i + 1} 题</span>${item.type === "listen" ? "" : ""}</p><p class="q">${escapeHtml(item.q || (item.type === "listen" ? "听一听，选出所听到的句子。" : item.type === "order" ? "把单词排成正确的句子。" : ""))}</p>`;
    if (item.type === "choice" || item.type === "listen") {
      const opts = item.options
        .map(
          (opt, oi) => `
          <label class="opt">
            <input type="radio" name="q${i}" value="${oi}" />
            <span>${escapeHtml(opt)}</span>
          </label>`
        )
        .join("");
      const listenBtn =
        item.type === "listen"
          ? `<button type="button" class="btn btn--ghost" data-speak="${escapeHtml(item.audio)}">▶ 听句子</button>`
          : "";
      return `<fieldset class="q-card" data-index="${i}">${head}${listenBtn}${opts}</fieldset>`;
    }
    if (item.type === "fill") {
      return `<fieldset class="q-card" data-index="${i}">${head}
        <p class="hint">提示：${escapeHtml(item.hint || "")}</p>
        <input class="fill" name="q${i}" autocomplete="off" placeholder="写出单词" />
      </fieldset>`;
    }
    if (item.type === "tf") {
      return `<fieldset class="q-card" data-index="${i}">${head}
        <label class="opt"><input type="radio" name="q${i}" value="true" /><span>对 True</span></label>
        <label class="opt"><input type="radio" name="q${i}" value="false" /><span>错 False</span></label>
      </fieldset>`;
    }
    if (item.type === "order") {
      const chips = item.words
        .map((w, wi) => `<button type="button" class="order-chip" data-word="${escapeHtml(w)}" data-i="${wi}">${escapeHtml(w)}</button>`)
        .join("");
      return `<fieldset class="q-card" data-index="${i}" data-type="order" data-answer="${escapeHtml(item.answer)}">
        ${head}
        <div class="order-pool">${chips}</div>
        <p class="order-out" data-out>点击单词，按顺序排句子</p>
        <input type="hidden" name="q${i}" value="" />
      </fieldset>`;
    }
    return "";
  }

  function renderFun(unit) {
    const lines = unit.fun.chant.map((l) => `<li data-speak="${escapeHtml(l)}">${escapeHtml(l)}</li>`).join("");
    const extra =
      unit.id === 12
        ? `
        <label class="letter-box">
          <span>把你的短信写在这里（会保存在这台设备上）</span>
          <textarea id="my-letter" rows="7" placeholder="Dear friend,&#10;My name is ...">${escapeHtml(progress.letter || "")}</textarea>
        </label>`
        : "";
    return `
      <section>
        <p class="kicker">Fun time</p>
        <h2>${escapeHtml(unit.fun.title)}</h2>
        <p class="zh-title">${escapeHtml(unit.fun.titleZh)}</p>
        <div class="cta-row">
          <button type="button" class="btn btn--primary" data-speak-all="${escapeHtml(unit.fun.chant.join(" "))}">整首听</button>
        </div>
        <ol class="chant">${lines}</ol>
        ${extra}
      </section>
    `;
  }

  function renderWordbank() {
    const words = allWords();
    const learnedN = words.filter((w) => progress.learned[w.en]).length;
    const cards = words
      .map(
        (w) => `
        <article class="word-card word-card--mini${progress.learned[w.en] ? " is-learned" : ""}">
          <button type="button" class="word-card__en" data-speak="${escapeHtml(w.en)}">${escapeHtml(w.en)}</button>
          <p class="zh">${escapeHtml(w.zh)}</p>
          <p class="mini-unit">U${w.unitId} ${escapeHtml(w.unitTitle)}</p>
        </article>`
      )
      .join("");
    return `
      <section>
        <p class="kicker">Word bank</p>
        <h2>生词本</h2>
        <p class="lede">本册共 ${words.length} 个重点词组。已标记“我会了” ${learnedN} 个。</p>
        <input class="search" id="word-search" type="search" placeholder="搜索英文或中文" />
        <div class="word-grid" id="word-grid">${cards}</div>
      </section>
    `;
  }

  function renderProgress() {
    const rows = BOOK.units
      .map((u) => {
        const score = unitScore(u.id);
        const s = starsFor(u);
        return `<tr>
          <td>U${u.id}</td>
          <td>${escapeHtml(u.title)}</td>
          <td class="stars">${renderStars(s)}</td>
          <td>${score ? `${score.correct}/${score.total}` : "还没交卷"}</td>
          <td><button type="button" class="linkish" data-go="u${u.id}-cover">去上课</button></td>
        </tr>`;
      })
      .join("");
    const doneAll = BOOK.units.every((u) => unitScore(u.id));
    return `
      <section>
        <p class="kicker">My stars</p>
        <h2>我的进度</h2>
        <p class="lede">一共可以拿到 36 颗星。每个单元：看完课得 1 星，练习及格 2 星，全对 3 星。</p>
        <p class="big-stars">${totalStars()} <span>/ 36</span></p>
        <div class="table-wrap">
          <table class="progress-table">
            <thead><tr><th>单元</th><th>题目</th><th>星星</th><th>练习</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${
          doneAll
            ? `<div class="diploma">
                <p>Certificate</p>
                <h3>阳光英语五年级结业卡</h3>
                <p>你读完了十二个单元，还会给朋友写信。Pip is proud of you!</p>
              </div>`
            : `<p class="lede">把每个单元的“练一练”交一遍，就会出现结业卡。</p>`
        }
      </section>
    `;
  }

  function bindGlobal() {
    $$("[data-go]").forEach((btn) => btn.addEventListener("click", () => goTo(btn.dataset.go)));
    $$("[data-step]").forEach((btn) => btn.addEventListener("click", () => goBy(Number(btn.dataset.step))));
    $$("[data-speak]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        speak(el.dataset.speak);
      })
    );
    $$("[data-speak-all]").forEach((el) =>
      el.addEventListener("click", () => speak(el.dataset.speakAll, { rate: 0.86 }))
    );
  }

  function bindPage(page) {
    if (page.kind === "reading") {
      $("#toggle-zh")?.addEventListener("click", () => {
        const box = $("#reading-zh");
        const hidden = box.classList.toggle("hidden");
        $("#toggle-zh").textContent = hidden ? "显示中文" : "收起中文";
      });
    }
    if (page.kind === "vocab") {
      $$("[data-learn]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const word = btn.dataset.learn;
          progress.learned[word] = !progress.learned[word];
          saveProgress();
          render();
        });
      });
    }
    if (page.kind === "practice") bindQuiz(unitById(page.unitId));
    if (page.kind === "fun" && page.unitId === 12) {
      $("#my-letter")?.addEventListener("input", (e) => {
        progress.letter = e.target.value;
        saveProgress();
      });
    }
    if (page.kind === "wordbank") {
      $("#word-search")?.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        $$("#word-grid .word-card").forEach((card) => {
          card.hidden = q && !card.textContent.toLowerCase().includes(q);
        });
      });
    }
  }

  function bindQuiz(unit) {
    $$(".q-card[data-type='order']").forEach((card) => {
      const picked = [];
      const out = $("[data-out]", card);
      const hidden = $("input[type='hidden']", card);
      const refresh = () => {
        hidden.value = picked.join(" ");
        out.textContent = picked.length ? picked.join(" ") : "点击单词，按顺序排句子";
      };
      $$(".order-chip", card).forEach((chip) => {
        chip.addEventListener("click", () => {
          if (chip.classList.contains("is-used")) {
            const idx = picked.indexOf(chip.dataset.word);
            if (idx >= 0) picked.splice(idx, 1);
            chip.classList.remove("is-used");
          } else {
            picked.push(chip.dataset.word);
            chip.classList.add("is-used");
          }
          refresh();
        });
      });
    });

    $("#quiz")?.addEventListener("submit", (e) => {
      e.preventDefault();
      gradeQuiz(unit, new FormData(e.target));
    });
    $("#reset-quiz")?.addEventListener("click", () => {
      delete progress.practice[String(unit.id)];
      saveProgress();
      render();
    });
  }

  function normalize(s) {
    return String(s || "")
      .trim()
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/[.?!,]/g, (m, offset, str) => (offset === str.length - 1 ? m : m))
      .replace(/[.?!,]+$/g, "")
      .toLowerCase();
  }

  function gradeQuiz(unit, form) {
    let correct = 0;
    unit.practice.forEach((item, i) => {
      const card = $(`.q-card[data-index="${i}"]`);
      const raw = form.get(`q${i}`);
      let ok = false;
      if (item.type === "choice" || item.type === "listen") {
        ok = Number(raw) === item.answer;
      } else if (item.type === "tf") {
        ok = String(raw) === String(item.answer);
      } else if (item.type === "fill") {
        ok = normalize(raw) === normalize(item.answer);
      } else if (item.type === "order") {
        ok = normalize(raw) === normalize(item.answer);
      }
      if (ok) correct += 1;
      card?.classList.toggle("is-right", ok);
      card?.classList.toggle("is-wrong", !ok);
    });
    const total = unit.practice.length;
    progress.practice[String(unit.id)] = { correct, total };
    saveProgress();
    const result = $("#quiz-result");
    if (result) {
      result.textContent =
        correct === total ? `全对！${correct} / ${total}  ★★★` : `本次 ${correct} / ${total}。错题已标出来，可以再试。`;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.key === "ArrowRight") goBy(1);
    if (e.key === "ArrowLeft") goBy(-1);
  });

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }

  render();
})();
