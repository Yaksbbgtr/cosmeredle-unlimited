"use strict";

/* =========================================================
 * Cosmeredle Unlimited
 * Comparison rules are ported from the original Cosmeredle (CC0).
 * ========================================================= */

const SHY = "­";
const clean = (s) => s.replaceAll(SHY, "");

const CHARACTERS = window.CHARACTERS.map((c, id) => ({
  ...c,
  id,
  display: c.name.join(" "),
  plain: clean(c.name.join(" ")),
  series: clean(c.firstAppearance[1]),
}));

const SERIES = [...new Set(CHARACTERS.map((c) => c.series))].sort(
  (a, b) => countIn(b) - countIn(a),
);
function countIn(series) {
  return CHARACTERS.filter((c) => c.series === series).length;
}

/* ---------------- comparison (from the original game) ---------------- */

function fuzzyCompareArray(a, b) {
  const big = a.length >= b.length ? a : b;
  const small = big === a ? b : a;
  let matching = 0;
  for (const v of big) if (small.includes(v)) matching++;
  return matching === 0 ? "None" : matching === big.length ? "Full" : "Partial";
}

function compareName(a, b) {
  const norm = (n) => n.map((p) => p.replaceAll(/(^\(|\)$|‍)/g, ""));
  return fuzzyCompareArray(norm(a), norm(b));
}

function compareFirstAppearance(a, b) {
  if (a.length !== b.length) return "None";
  if (a[0] === b[0]) return "Full";
  if (a[1] === b[1]) return "Partial";
  return "None";
}

function compareSpecies(a, b) {
  const speciesMatches = a[0] === b[0];
  const subspeciesMatches =
    ((a[1] !== undefined && a[1] !== "Unspecified") || speciesMatches) &&
    a[1] === b[1];
  if (speciesMatches && subspeciesMatches) return "Full";
  if (speciesMatches || subspeciesMatches) return "Partial";
  return "None";
}

function compare(guess, target) {
  return [
    compareName(guess.name, target.name),
    guess.homeWorld === target.homeWorld ? "Full" : "None",
    compareFirstAppearance(guess.firstAppearance, target.firstAppearance),
    compareSpecies(guess.species, target.species),
    fuzzyCompareArray(guess.abilities, target.abilities),
  ];
}

const formatSpecies = (s) => (s.length > 1 ? `${s[0]} (${s.slice(1).join(" ")})` : s[0]);

/* ---------------- storage ---------------- */

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("cu:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("cu:" + key, JSON.stringify(value));
    } catch {}
  },
};

const settings = Object.assign(
  { series: SERIES.slice(), theme: "system", colorblind: false, reduceMotion: false, seenHelp: false },
  store.get("settings", {}),
);
// Drop any series that no longer exist; fall back to everything if empty.
settings.series = settings.series.filter((s) => SERIES.includes(s));
if (!settings.series.length) settings.series = SERIES.slice();

const stats = Object.assign(
  { played: 0, wins: 0, streak: 0, best: 0, dist: {}, round: 0 },
  store.get("stats", {}),
);

let game = store.get("game", null); // { target, guesses: [id], over: false, won: false }

const saveSettings = () => store.set("settings", settings);
const saveStats = () => store.set("stats", stats);
const saveGame = () => store.set("game", game);

/* ---------------- dom ---------------- */

const $ = (sel) => document.querySelector(sel);
const input = $("#guess-input");
const list = $("#suggestions");
const rowsEl = $("#rows");

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

/* ---------------- game flow ---------------- */

function pool() {
  const allowed = new Set(settings.series);
  return CHARACTERS.filter((c) => allowed.has(c.series));
}

function newGame() {
  const candidates = pool();
  const recent = store.get("recent", []);
  let options = candidates.filter((c) => !recent.includes(c.id));
  if (!options.length) options = candidates;
  const target = options[Math.floor(Math.random() * options.length)];
  // Avoid repeats over the last ~third of the pool.
  const keep = Math.max(1, Math.floor(candidates.length / 3));
  store.set("recent", [target.id, ...recent].slice(0, keep));

  stats.round += 1;
  saveStats();
  game = { target: target.id, guesses: [], over: false, won: false };
  saveGame();
  render(true);
  input.focus();
}

function makeGuess(id) {
  if (!game || game.over || game.guesses.includes(id)) return;
  game.guesses.unshift(id);
  const target = CHARACTERS[game.target];
  const result = compare(CHARACTERS[id], target);
  const won = result.every((r) => r === "Full");

  if (won) finish(true);
  saveGame();

  const row = buildRow(id, true);
  rowsEl.prepend(row);
  requestAnimationFrame(() => requestAnimationFrame(() => row.classList.add("revealed")));
  updateChrome();

  if (won) {
    row.classList.add("win");
    setTimeout(showEnd, settings.reduceMotion ? 50 : 1300);
  }
}

function giveUp() {
  if (!game || game.over) return;
  if (!confirm("Give up and reveal the character? This resets your streak.")) return;
  finish(false);
  saveGame();
  updateChrome();
  showEnd();
}

function finish(won) {
  game.over = true;
  game.won = won;
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.streak += 1;
    stats.best = Math.max(stats.best, stats.streak);
    const n = game.guesses.length;
    stats.dist[n] = (stats.dist[n] || 0) + 1;
  } else {
    stats.streak = 0;
  }
  saveStats();
}

/* ---------------- rendering ---------------- */

function buildRow(id, animate) {
  const c = CHARACTERS[id];
  const res = compare(c, CHARACTERS[game.target]);
  const values = [
    c.display,
    c.homeWorld,
    [c.firstAppearance[0], c.firstAppearance[0] === c.firstAppearance[1] ? "" : c.firstAppearance[1]],
    formatSpecies(c.species),
    c.abilities.join(", "),
  ];
  const row = el("div", { class: "row" + (animate ? "" : " revealed") });
  values.forEach((v, i) => {
    const back = el("div", { class: `face back ${res[i]}` });
    if (Array.isArray(v)) {
      back.append(v[0]);
      if (v[1]) back.append(el("small", {}, v[1]));
    } else back.append(v);
    const inner = el(
      "div",
      { class: "cell-inner", style: animate ? `transition-delay:${i * 120}ms` : "" },
      el("div", { class: "face front" }),
      back,
    );
    row.append(el("div", { class: "cell" }, inner));
  });
  if (!animate && res.every((r) => r === "Full")) row.classList.add("win");
  return row;
}

function render() {
  rowsEl.replaceChildren(...game.guesses.map((id) => buildRow(id, false)));
  updateChrome();
}

function updateChrome() {
  $("#round-num").textContent = stats.round;
  $("#guess-count").textContent = game.guesses.length;
  $("#streak").textContent = stats.streak;
  $("#empty").hidden = game.guesses.length > 0;
  input.disabled = game.over;
  input.placeholder = game.over ? "Round over. Start a new character →" : "Guess a Cosmere character…";
  $("#btn-giveup").disabled = game.over;
  $("#btn-new").textContent = game.over ? "Next character" : "New character";
  document.body.classList.toggle("cb", settings.colorblind);
  if (settings.theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = settings.theme;
  document.body.classList.toggle("reduce-motion", settings.reduceMotion);
}

function showEnd() {
  const t = CHARACTERS[game.target];
  const n = game.guesses.length;
  $("#end-kicker").textContent = game.won ? "You found them" : "The character was";
  $("#end-name").textContent = t.display;
  const facts = $("#end-facts");
  facts.replaceChildren();
  for (const [k, v] of [
    ["World", t.homeWorld],
    ["First book", t.firstAppearance[0]],
    ["Series", t.firstAppearance[1]],
    ["Species", formatSpecies(t.species)],
    ["Abilities", t.abilities.join(", ")],
  ]) facts.append(el("dt", {}, k), el("dd", {}, v));
  $("#end-line").textContent = game.won
    ? `Solved in ${n} ${n === 1 ? "guess" : "guesses"}. Streak: ${stats.streak}.`
    : `Gave up after ${n} ${n === 1 ? "guess" : "guesses"}.`;
  $("#dlg-end").showModal();
}

/* ---------------- autocomplete ---------------- */

let matches = [];
let active = -1;

function highlight(text, q) {
  const frag = document.createDocumentFragment();
  const plain = clean(text);
  const i = plain.toLowerCase().indexOf(q);
  if (!q || i < 0) {
    frag.append(plain);
    return frag;
  }
  frag.append(plain.slice(0, i), el("mark", {}, plain.slice(i, i + q.length)), plain.slice(i + q.length));
  return frag;
}

function search(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const guessed = new Set(game.guesses);
  const scored = [];
  for (const c of CHARACTERS) {
    if (guessed.has(c.id)) continue;
    const name = c.plain.toLowerCase();
    let score;
    if (name.startsWith(q)) score = 0;
    else if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) score = 1;
    else if (name.includes(q)) score = 2;
    else continue;
    scored.push([score, c]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].plain.localeCompare(b[1].plain));
  return scored.slice(0, 10).map((s) => s[1]);
}

function renderSuggestions() {
  const q = input.value.trim().toLowerCase();
  matches = search(q);
  active = matches.length ? 0 : -1;
  list.replaceChildren();
  if (!q) {
    closeSuggestions();
    return;
  }
  if (!matches.length) {
    list.append(el("li", { class: "none" }, "No matching character"));
  } else {
    matches.forEach((c, i) => {
      const li = el(
        "li",
        { role: "option", id: `opt-${i}`, "aria-selected": String(i === active) },
        el("span", {}, highlight(c.display, q)),
        el("small", {}, clean(c.homeWorld)),
      );
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i);
      });
      list.append(li);
    });
  }
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function moveActive(delta) {
  if (!matches.length) return;
  active = (active + delta + matches.length) % matches.length;
  [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
  list.children[active]?.scrollIntoView({ block: "nearest" });
}

function choose(i) {
  const c = matches[i];
  if (!c) return;
  input.value = "";
  closeSuggestions();
  makeGuess(c.id);
}

function closeSuggestions() {
  list.hidden = true;
  input.setAttribute("aria-expanded", "false");
}

input.addEventListener("input", renderSuggestions);
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
  else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) choose(active); }
  else if (e.key === "Escape") closeSuggestions();
});
input.addEventListener("blur", () => setTimeout(closeSuggestions, 100));
input.addEventListener("focus", () => input.value && renderSuggestions());

/* ---------------- dialogs ---------------- */

function renderStats() {
  const pct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const totalGuesses = Object.entries(stats.dist).reduce((s, [k, v]) => s + k * v, 0);
  const avg = stats.wins ? (totalGuesses / stats.wins).toFixed(1) : "–";
  $("#stat-grid").replaceChildren(
    ...[[stats.played, "Played"], [pct + "%", "Won"], [stats.streak, "Streak"], [avg, "Avg"]].map(([v, l]) =>
      el("div", {}, el("b", {}, String(v)), el("span", {}, l)),
    ),
  );
  const dist = $("#dist");
  const keys = Object.keys(stats.dist).map(Number);
  if (!keys.length) {
    dist.replaceChildren(el("p", { class: "muted small" }, "Win a round to see your distribution."));
    return;
  }
  const max = Math.max(...Object.values(stats.dist));
  const hi = Math.max(...keys);
  const rows = [];
  // Bucket long games so the chart stays readable.
  const buckets = [];
  for (let i = 1; i <= Math.min(hi, 12); i++) buckets.push([String(i), stats.dist[i] || 0, i]);
  if (hi > 12) {
    const rest = keys.filter((k) => k > 12).reduce((s, k) => s + stats.dist[k], 0);
    buckets.push(["13+", rest, 13]);
  }
  const bMax = Math.max(max, ...buckets.map((b) => b[1]));
  const last = game && game.over && game.won ? Math.min(game.guesses.length, 13) : -1;
  for (const [label, count, key] of buckets) {
    rows.push(
      el("div", { class: "dist-row" + (key === last ? " hl" : "") },
        el("span", {}, label),
        el("div", { class: "bar", style: `--w:${Math.max(6, (count / bMax) * 100)}%` }, String(count)),
      ),
    );
  }
  dist.replaceChildren(...rows);
}

function renderSettings() {
  const box = $("#series-list");
  box.replaceChildren(
    ...SERIES.map((s) => {
      const cb = el("input", { type: "checkbox", value: s });
      cb.checked = settings.series.includes(s);
      cb.addEventListener("change", () => {
        const chosen = [...box.querySelectorAll("input:checked")].map((i) => i.value);
        if (!chosen.length) {
          cb.checked = true; // need at least one
          return;
        }
        settings.series = chosen;
        saveSettings();
      });
      return el("label", {}, cb, el("span", {}, s), el("span", { class: "count" }, String(countIn(s))));
    }),
  );
  $("#opt-theme").value = settings.theme;
  $("#opt-cb").checked = settings.colorblind;
  $("#opt-motion").checked = settings.reduceMotion;
}

$("#opt-theme").addEventListener("change", (e) => {
  settings.theme = e.target.value;
  saveSettings();
  updateChrome();
});
$("#opt-cb").addEventListener("change", (e) => {
  settings.colorblind = e.target.checked;
  saveSettings();
  updateChrome();
});
$("#opt-motion").addEventListener("change", (e) => {
  settings.reduceMotion = e.target.checked;
  saveSettings();
  updateChrome();
});
$("#btn-reset-stats").addEventListener("click", () => {
  if (!confirm("Reset all your stats?")) return;
  Object.assign(stats, { played: 0, wins: 0, streak: 0, best: 0, dist: {}, round: game ? 1 : 0 });
  saveStats();
  updateChrome();
});

$("#btn-help").addEventListener("click", () => $("#dlg-help").showModal());
$("#btn-stats").addEventListener("click", () => {
  renderStats();
  $("#dlg-stats").showModal();
});
$("#btn-settings").addEventListener("click", () => {
  renderSettings();
  $("#dlg-settings").showModal();
});
$("#btn-giveup").addEventListener("click", giveUp);
$("#btn-new").addEventListener("click", () => {
  if (game && !game.over && game.guesses.length) {
    if (!confirm("Skip this character? It counts as a loss.")) return;
    finish(false);
  }
  newGame();
});
$("#dlg-end").addEventListener("close", () => {
  if ($("#dlg-end").returnValue === "next") newGame();
});
for (const d of document.querySelectorAll("dialog")) {
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
}

/* ---------------- boot ---------------- */

if (!game || CHARACTERS[game.target] === undefined) {
  newGame();
} else {
  render();
}
if (!settings.seenHelp) {
  settings.seenHelp = true;
  saveSettings();
  $("#dlg-help").showModal();
}
