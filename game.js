import { SONGS } from "./songs.js";

const MAX_GUESSES = 6;
const STORAGE_PREFIX = "mounddle:v1";
const EPOCH = new Date(2024, 0, 1); // local date the puzzle counter starts from

// ── DOM ────────────────────────────────────────────────────────────────────
const boardEl = document.getElementById("board");
const attemptsEl = document.getElementById("attempts");
const formEl = document.getElementById("guess-form");
const inputEl = document.getElementById("guess-input");
const guessButtonEl = formEl.querySelector("button[type='submit']");
const datalistEl = document.getElementById("songs-list");
const errorEl = document.getElementById("error");
const giveUpEl = document.getElementById("give-up");
const resultEl = document.getElementById("result");
const dateEl = document.getElementById("date");

// ── Helpers ────────────────────────────────────────────────────────────────
function normalizeTitle(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// ── Song lookup ────────────────────────────────────────────────────────────
const byTitle = new Map();
for (const song of SONGS) {
  const key = normalizeTitle(song.title);
  if (!byTitle.has(key)) byTitle.set(key, song);
}

// ── Today's puzzle ─────────────────────────────────────────────────────────
const today = startOfDay(new Date());
const puzzleNumber = Math.floor((today.getTime() - EPOCH.getTime()) / 86400000);
const answer = SONGS[((puzzleNumber % SONGS.length) + SONGS.length) % SONGS.length];

function storageKey() {
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${STORAGE_PREFIX}:${yyyy}-${mm}-${dd}`;
}

// ── State ──────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return { guesses: [], status: "playing" };
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.guesses)) {
      const status = parsed.status === "won" || parsed.status === "lost"
        ? parsed.status
        : "playing";
      return { guesses: parsed.guesses, status };
    }
  } catch (e) {
    // Ignore corrupted storage and start fresh.
  }
  return { guesses: [], status: "playing" };
}

function saveState() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch (e) {
    // Storage may be unavailable; the game still works for this session.
  }
}

const state = loadState();

// ── Rendering ──────────────────────────────────────────────────────────────
function cell(text, className) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let i = 0; i < MAX_GUESSES; i++) {
    const row = document.createElement("div");
    row.className = "row" + (i === state.guesses.length - 1 ? " row--latest" : "");

    const guess = state.guesses[i];
    if (guess) {
      const isAnswer = normalizeTitle(guess.title) === normalizeTitle(answer.title);
      const artistMatch = guess.artist === answer.artist;
      const albumMatch = guess.album === answer.album;

      row.appendChild(cell(guess.title, "cell" + (isAnswer ? " cell--match" : "")));
      row.appendChild(cell(guess.artist, "cell cell--dim" + (artistMatch ? " cell--match" : "")));
      row.appendChild(cell(guess.album, "cell cell--dim" + (albumMatch ? " cell--match" : "")));
    } else {
      row.appendChild(cell("·", "cell cell--empty"));
      row.appendChild(cell("·", "cell cell--empty"));
      row.appendChild(cell("·", "cell cell--empty"));
    }

    boardEl.appendChild(row);
  }
}

function renderAttempts() {
  if (state.status === "playing") {
    attemptsEl.textContent = `${state.guesses.length} / ${MAX_GUESSES} guesses`;
  } else if (state.status === "won") {
    attemptsEl.textContent = `Solved in ${state.guesses.length} ${state.guesses.length === 1 ? "guess" : "guesses"}`;
  } else {
    attemptsEl.textContent = "";
  }
}

function renderControls() {
  const over = state.status !== "playing";
  inputEl.disabled = over;
  guessButtonEl.disabled = over;
  giveUpEl.hidden = over;
  if (over) {
    formEl.hidden = true;
  }
}

function shareText() {
  const outcome = state.status === "won" ? `${state.guesses.length}/${MAX_GUESSES}` : "X/6";
  const lines = [`MOUNDDLE #${puzzleNumber} ${outcome}`, ""];
  for (const guess of state.guesses) {
    const song = normalizeTitle(guess.title) === normalizeTitle(answer.title);
    const artist = guess.artist === answer.artist;
    const album = guess.album === answer.album;
    lines.push((song ? "🟩" : "⬛") + (artist ? "🟩" : "⬛") + (album ? "🟩" : "⬛"));
  }
  return lines.join("\n");
}

async function copyShare() {
  const text = shareText();
  const feedback = document.getElementById("copy-feedback");
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e) {
    ok = false;
  }
  if (!ok) ok = legacyCopy(text);
  if (feedback) feedback.textContent = ok ? "Copied!" : "Couldn't copy — copy manually below.";
}

function legacyCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function renderResult() {
  resultEl.hidden = true;
  if (state.status !== "won" && state.status !== "lost") return;

  const won = state.status === "won";
  resultEl.hidden = false;
  resultEl.innerHTML = `
    <h2 class="result-title">${won ? "You found it" : "The song was…"}</h2>
    <p class="answer">
      <strong>${escapeHtml(answer.title)}</strong>
      <span class="answer-meta">${escapeHtml(answer.artist)} · ${escapeHtml(answer.album)}</span>
    </p>
    <div class="share-row">
      <button class="btn btn-primary" id="share-btn" type="button">${won ? "Share" : "Share"}</button>
      <span class="copy-feedback" id="copy-feedback" aria-live="polite"></span>
    </div>
    <p class="next">
      <span id="countdown"></span>
    </p>
  `;
  document.getElementById("share-btn").addEventListener("click", copyShare);
  updateCountdown();
}

function updateCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = next.getTime() - now.getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  el.textContent = `Next song in ${h}h ${m}m ${s}s`;
}

function renderDate() {
  const label = today.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  dateEl.textContent = `#${puzzleNumber} · ${label}`;
}

function render() {
  renderBoard();
  renderAttempts();
  renderControls();
  renderResult();
}

// ── Game actions ───────────────────────────────────────────────────────────
function showError(message) {
  errorEl.textContent = message;
}

function clearError() {
  errorEl.textContent = "";
}

function handleGuess(event) {
  event.preventDefault();
  clearError();

  if (state.status !== "playing") return;

  const raw = inputEl.value;
  if (!raw.trim()) {
    showError("Type a song title first.");
    return;
  }

  const key = normalizeTitle(raw);
  const song = byTitle.get(key);
  if (!song) {
    showError(`“${raw.trim()}” isn't in the song list — pick a suggestion.`);
    return;
  }

  if (state.guesses.some((g) => normalizeTitle(g.title) === key)) {
    showError("You already guessed that song.");
    inputEl.value = "";
    inputEl.focus();
    return;
  }

  state.guesses.push({ title: song.title, artist: song.artist, album: song.album });

  if (key === normalizeTitle(answer.title)) {
    state.status = "won";
  } else if (state.guesses.length >= MAX_GUESSES) {
    state.status = "lost";
  }

  saveState();
  render();
  inputEl.value = "";
  if (state.status === "playing") inputEl.focus();
}

function giveUp() {
  if (state.status !== "playing") return;
  state.status = "lost";
  saveState();
  render();
}

// ── Init ───────────────────────────────────────────────────────────────────
for (const song of SONGS) {
  const option = document.createElement("option");
  option.value = song.title;
  datalistEl.appendChild(option);
}

formEl.addEventListener("submit", handleGuess);
giveUpEl.addEventListener("click", giveUp);
inputEl.addEventListener("input", clearError);

renderDate();
render();
inputEl.focus();

// Keep the countdown ticking while the result is visible.
setInterval(() => {
  if (state.status === "won" || state.status === "lost") updateCountdown();
}, 1000);
