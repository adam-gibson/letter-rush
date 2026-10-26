// UI controller: wires the DOM to the game logic and the data store.
import { BUILT_IN_CATEGORIES } from './categories.js';
import { ALPHABET, Game, parseLetters } from './game.js';
import { createStore, LocalStore } from './data/store.js';
import * as auth from './auth.js';
import { requestWakeLock, releaseWakeLock } from './wake-lock.js';

const REQUIRED = 6;
const PRESET_TARGETS = [5, 10, 15, 20];

const state = {
  store: new LocalStore(),
  user: null,
  settings: null,
  custom: [],      // [{ id, name, createdAt }]
  game: null,
  filter: '',
  animating: false,
  presenting: false,
};

const $ = (id) => document.getElementById(id);
const el = {
  homeScreen: $('home-screen'), homeLink: $('home-link'), helpBtn: $('help-btn'),
  playBtn: $('play-btn'), installBtn: $('install-btn'), syncHint: $('sync-hint'), syncSigninBtn: $('sync-signin-btn'),
  setupScreen: $('setup-screen'), gameScreen: $('game-screen'),
  chosenCount: $('chosen-count'), chosenList: $('chosen-list'),
  randomiseBtn: $('randomise-btn'), clearBtn: $('clear-btn'),
  filter: $('category-filter'), grid: $('category-grid'),
  customForm: $('custom-form'), customInput: $('custom-input'), customList: $('custom-list'), customCount: $('custom-count'),
  targetOptions: $('target-options'), customTargetWrap: $('custom-target-wrap'), customTarget: $('custom-target'),
  excludeToggle: $('exclude-toggle'), difficultInput: $('difficult-input'),
  startBtn: $('start-btn'),
  targetDisplay: $('target-display'), letter: $('letter'), status: $('letter-status'),
  drawBtn: $('draw-btn'), redrawBtn: $('redraw-btn'),
  gameCats: $('game-categories'), used: $('used-letters'), remaining: $('remaining'),
  presentBtn: $('present-btn'), exitPresentBtn: $('exit-present-btn'),
  restartBtn: $('restart-btn'), endBtn: $('end-btn'),
  confirmDialog: $('confirm-dialog'), confirmMsg: $('confirm-message'), confirmOk: $('confirm-ok'),
  toast: $('toast'),
  account: $('account'), signinBtn: $('signin-btn'), accountMenu: $('account-menu'),
  accountEmail: $('account-email'), signoutBtn: $('signout-btn'),
  signinDialog: $('signin-dialog'), signinForm: $('signin-form'), signinEmail: $('signin-email'),
  signinStatus: $('signin-status'), signinCancel: $('signin-cancel'),
};

// ---------- Helpers ----------

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (value != null && value !== false) node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

const collate = (a, b) => a.localeCompare(b, 'en-GB');

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}

function confirmDialog(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    el.confirmMsg.textContent = message;
    el.confirmOk.textContent = okLabel;
    el.confirmDialog.returnValue = '';
    el.confirmDialog.addEventListener('close',
      () => resolve(el.confirmDialog.returnValue === 'ok'), { once: true });
    el.confirmDialog.showModal();
  });
}

const allCategoryNames = () => [...state.custom.map((c) => c.name), ...BUILT_IN_CATEGORIES];
const saveSettings = () => state.store.saveSettings(state.settings);

// ---------- Setup screen ----------

function renderSetup() {
  renderChosen();
  renderGrid();
  renderCustomList();
  renderTarget();
  renderLetterSettings();
}

function renderChosen() {
  const selected = state.settings.selected;
  el.chosenCount.textContent = `${selected.length} of ${REQUIRED} chosen`;
  el.chosenList.replaceChildren(...selected.map((name, i) =>
    h('li', {}, h('button', {
      type: 'button', class: 'chip selected', 'aria-label': `Remove ${name}`,
      onclick: () => toggleCategory(name),
    }, `${i + 1}. ${name}`, h('span', { class: 'chip-x', 'aria-hidden': 'true' }, '×')))));
  el.chosenList.hidden = !selected.length;
  el.clearBtn.disabled = !selected.length;
  el.startBtn.disabled = selected.length !== REQUIRED;
  el.startBtn.textContent = selected.length === REQUIRED
    ? 'Start game' : `Choose ${REQUIRED - selected.length} more`;
}

function renderGrid() {
  const query = state.filter.trim().toLowerCase();
  const customNames = state.custom.map((c) => c.name).sort(collate);
  const isCustom = new Set(customNames);
  const full = state.settings.selected.length >= REQUIRED;
  const names = [...customNames, ...[...BUILT_IN_CATEGORIES].sort(collate)]
    .filter((n) => !query || n.toLowerCase().includes(query));

  if (!names.length) {
    el.grid.replaceChildren(h('li', { class: 'empty' }, 'No categories match.'));
    return;
  }
  el.grid.replaceChildren(...names.map((name) => {
    const on = state.settings.selected.includes(name);
    const cls = ['chip', on && 'selected', isCustom.has(name) && 'custom', full && !on && 'dim']
      .filter(Boolean).join(' ');
    return h('li', {}, h('button', {
      type: 'button', class: cls, 'aria-pressed': String(on),
      onclick: () => toggleCategory(name),
    }, name));
  }));
}

function renderCustomList() {
  el.customCount.textContent = state.custom.length;
  if (!state.custom.length) {
    el.customList.replaceChildren(h('li', { class: 'empty' }, 'You have not added any categories yet.'));
    return;
  }
  el.customList.replaceChildren(...[...state.custom].sort((a, b) => collate(a.name, b.name)).map((cat) =>
    h('li', {}, h('span', {}, cat.name), h('button', {
      type: 'button', class: 'btn small danger', 'aria-label': `Delete ${cat.name}`,
      onclick: () => deleteCustom(cat),
    }, 'Delete'))));
}

function renderTarget() {
  const { target, targetIsCustom } = state.settings;
  for (const btn of el.targetOptions.querySelectorAll('button')) {
    const value = btn.dataset.target;
    const pressed = value === 'custom' ? targetIsCustom : !targetIsCustom && Number(value) === target;
    btn.setAttribute('aria-pressed', String(pressed));
  }
  el.customTargetWrap.hidden = !targetIsCustom;
  el.customTarget.value = target;
}

function renderLetterSettings() {
  el.excludeToggle.checked = state.settings.excludeDifficult;
  el.difficultInput.value = state.settings.difficultLetters;
  el.difficultInput.disabled = !state.settings.excludeDifficult;
}

function toggleCategory(name) {
  const selected = state.settings.selected;
  if (selected.includes(name)) {
    state.settings.selected = selected.filter((n) => n !== name);
  } else if (selected.length >= REQUIRED) {
    toast(`You have already chosen ${REQUIRED}. Remove one first.`);
    return;
  } else {
    state.settings.selected = [...selected, name];
  }
  saveSettings();
  renderChosen();
  renderGrid();
}

function randomise() {
  state.settings.selected = shuffle(allCategoryNames()).slice(0, REQUIRED);
  saveSettings();
  renderChosen();
  renderGrid();
}

async function addCustom(event) {
  event.preventDefault();
  const name = el.customInput.value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (allCategoryNames().some((n) => n.toLowerCase() === name.toLowerCase())) {
    toast('That category already exists.');
    return;
  }
  try {
    state.custom.push(await state.store.addCustomCategory(name));
    el.customInput.value = '';
    renderSetup();
    toast(`Added “${name}”`);
  } catch (err) {
    console.error(err);
    toast('Sorry, that category could not be saved.');
  }
}

async function deleteCustom(cat) {
  if (!await confirmDialog(`Delete “${cat.name}”?`, 'Delete')) return;
  try {
    await state.store.deleteCustomCategory(cat.id);
    state.custom = state.custom.filter((c) => c.id !== cat.id);
    state.settings.selected = state.settings.selected.filter((n) => n !== cat.name);
    saveSettings();
    renderSetup();
  } catch (err) {
    console.error(err);
    toast('Sorry, that category could not be deleted.');
  }
}

async function loadCustom() {
  try {
    state.custom = await state.store.listCustomCategories();
  } catch (err) {
    console.error(err);
    state.custom = [];
    toast('Could not load your categories.');
  }
  const names = new Set(allCategoryNames());
  state.settings.selected = state.settings.selected.filter((n) => names.has(n));
}

// ---------- Game screen ----------

function showScreen(name) {
  el.homeScreen.hidden = name !== 'home';
  el.playBtn.textContent = state.game ? 'Continue game' : 'Play now';
  el.setupScreen.hidden = name !== 'setup';
  el.gameScreen.hidden = name !== 'game';
  window.scrollTo(0, 0);
}

function excludedLetters() {
  return state.settings.excludeDifficult ? parseLetters(state.settings.difficultLetters) : [];
}

function startGame() {
  if (state.settings.selected.length !== REQUIRED) return;
  const excluded = excludedLetters();
  if (excluded.length >= ALPHABET.length) {
    toast('You have excluded every letter.');
    return;
  }
  state.game = new Game({
    categories: [...state.settings.selected],
    target: state.settings.target,
    excluded,
  });
  state.store.saveGame(state.game);
  showScreen('game');
  setStatus('Press “Draw letter” to begin');
  renderGame();
  el.drawBtn.focus();
}

function setStatus(text) {
  el.status.textContent = text;
}

function renderGame() {
  const g = state.game;
  el.targetDisplay.textContent = g.target;
  el.gameCats.replaceChildren(...g.categories.map((c) => h('li', {}, c)));

  // Hide the newest letter from the list until the animation has revealed it.
  const shown = state.animating ? g.history.slice(0, -1) : g.history;
  el.used.replaceChildren(...(shown.length
    ? shown.map(({ letter, discarded }, i) => h('li', {
        class: discarded ? 'discarded' : (i === g.history.length - 1 ? 'current' : ''),
        title: discarded ? `${letter} (redrawn)` : letter,
        'aria-label': discarded ? `${letter}, redrawn` : letter,
      }, letter))
    : [h('li', { class: 'none' }, 'None yet')]));

  const left = g.pool.length;
  const excludedNote = g.excluded.length ? ` (${g.excluded.join(', ')} excluded)` : '';
  el.remaining.textContent = `${left} letter${left === 1 ? '' : 's'} left${excludedNote}`;

  if (!state.animating) {
    el.letter.textContent = g.current ?? '?';
    el.letter.classList.toggle('is-empty', !g.current);
  }
  el.drawBtn.disabled = state.animating || !left;
  el.redrawBtn.disabled = state.animating || !g.current || !left;
}

function animateLetter(letter) {
  const node = el.letter;
  node.classList.remove('is-empty', 'pop');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = letter;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const frames = 14;
    let frame = 0;
    node.classList.add('spinning');
    const tick = () => {
      frame++;
      if (frame < frames) {
        node.textContent = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        setTimeout(tick, 30 + frame * 5); // gradually slows down
      } else {
        node.classList.remove('spinning');
        node.textContent = letter;
        void node.offsetWidth; // restart the CSS animation
        node.classList.add('pop');
        resolve();
      }
    };
    tick();
  });
}

async function draw(isRedraw = false) {
  const g = state.game;
  if (!g || state.animating) return;
  const previous = g.current;
  const letter = isRedraw ? g.redraw() : g.draw();
  if (!letter) {
    setStatus('No letters left. Press “Start again” for a new game.');
    renderGame();
    return;
  }
  state.store.saveGame(g);
  state.animating = true;
  setStatus('Drawing…');
  renderGame();
  await animateLetter(letter);
  state.animating = false;
  renderGame();
  setStatus(isRedraw
    ? `${previous} discarded. New letter: ${letter}`
    : `Every answer must begin with ${letter}`);
  if (!g.pool.length) setStatus(`${el.status.textContent}. That was the last letter!`);
}

async function restart() {
  if (!await confirmDialog('Start a new game with the same categories? Used letters will be cleared.', 'Start again')) return;
  state.game = new Game({
    categories: state.game.categories,
    target: state.game.target,
    excluded: excludedLetters(),
  });
  state.store.saveGame(state.game);
  el.letter.classList.remove('pop');
  setStatus('Press “Draw letter” to begin');
  renderGame();
}

async function endGame() {
  if (!await confirmDialog('End this game and return to the set-up screen?', 'End game')) return;
  await exitPresentation();
  state.game = null;
  state.store.clearGame();
  showScreen('setup');
}

// ---------- Presentation mode ----------

async function enterPresentation() {
  state.presenting = true;
  document.body.classList.add('presenting');
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    // Fullscreen refused (or unsupported, e.g. iPhone): the large layout still applies.
  }
  await requestWakeLock();
  el.drawBtn.focus();
}

async function exitPresentation() {
  if (!state.presenting) return;
  state.presenting = false;
  document.body.classList.remove('presenting');
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  await releaseWakeLock();
}

const togglePresentation = () => (state.presenting ? exitPresentation() : enterPresentation());

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && state.presenting) exitPresentation();
});

// Keyboard shortcuts on the game screen: D or Space = draw, R = redraw, P = presentation.
document.addEventListener('keydown', (e) => {
  if (el.gameScreen.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]') || e.target.matches('input, textarea')) return;
  const key = e.key.toLowerCase();
  if (key === 'd' || (key === ' ' && e.target === document.body)) {
    e.preventDefault();
    if (!el.drawBtn.disabled) draw();
  } else if (key === 'r') {
    if (!el.redrawBtn.disabled) draw(true);
  } else if (key === 'p') {
    togglePresentation();
  } else if (key === 'escape' && state.presenting) {
    exitPresentation();
  }
});

// ---------- Accounts (inactive until js/config.js is filled in) ----------

function openSignin() {
  el.signinStatus.textContent = '';
  el.signinDialog.showModal();
}

async function initAuth() {
  if (!auth.enabled) return;
  el.account.hidden = false;
  el.syncHint.hidden = false;
  el.signinBtn.addEventListener('click', openSignin);
  el.syncSigninBtn.addEventListener('click', openSignin);
  el.signinCancel.addEventListener('click', () => el.signinDialog.close());
  el.signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.signinStatus.textContent = 'Sending…';
    try {
      await auth.signInWithEmail(el.signinEmail.value.trim());
      el.signinStatus.textContent = 'Check your email for a sign-in link.';
    } catch (err) {
      el.signinStatus.textContent = err.message || 'Sorry, the link could not be sent.';
    }
  });
  el.signoutBtn.addEventListener('click', () => auth.signOut());
  try {
    await auth.onAuthChange(handleUser);
  } catch (err) {
    console.error(err); // e.g. offline and the Supabase library could not load
  }
}

async function handleUser(user) {
  if ((user?.id ?? null) === (state.user?.id ?? null)) return;
  state.user = user;
  el.signinBtn.hidden = Boolean(user);
  el.accountMenu.hidden = !user;
  el.accountEmail.textContent = user?.email ?? '';
  el.syncHint.hidden = Boolean(user);
  state.store = await createStore(user);
  if (user) {
    if (el.signinDialog.open) el.signinDialog.close();
    try {
      await state.store.importLocalCategories(await new LocalStore().listCustomCategories());
    } catch (err) {
      console.error(err);
    }
  }
  await loadCustom();
  renderSetup();
}

// ---------- Install prompt (Chrome, Edge, Android) ----------

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  el.installBtn.hidden = false;
});
el.installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  el.installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { el.installBtn.hidden = true; });

// ---------- Start-up ----------

function bindEvents() {
  el.playBtn.addEventListener('click', () => showScreen(state.game ? 'game' : 'setup'));
  el.homeLink.addEventListener('click', () => showScreen('home'));
  el.helpBtn.addEventListener('click', () => showScreen('home'));
  el.randomiseBtn.addEventListener('click', randomise);
  el.clearBtn.addEventListener('click', () => {
    state.settings.selected = [];
    saveSettings();
    renderChosen();
    renderGrid();
  });
  el.filter.addEventListener('input', () => {
    state.filter = el.filter.value;
    renderGrid();
  });
  el.customForm.addEventListener('submit', addCustom);

  el.targetOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.target === 'custom') {
      state.settings.targetIsCustom = true;
      renderTarget();
      el.customTarget.focus();
      el.customTarget.select();
    } else {
      state.settings.targetIsCustom = false;
      state.settings.target = Number(btn.dataset.target);
      renderTarget();
    }
    saveSettings();
  });
  el.customTarget.addEventListener('input', () => {
    const value = Math.round(Number(el.customTarget.value));
    if (value >= 1 && value <= 999) {
      state.settings.target = value;
      saveSettings();
    }
  });
  el.customTarget.addEventListener('change', renderTarget);

  el.excludeToggle.addEventListener('change', () => {
    state.settings.excludeDifficult = el.excludeToggle.checked;
    saveSettings();
    renderLetterSettings();
  });
  el.difficultInput.addEventListener('change', () => {
    state.settings.difficultLetters = parseLetters(el.difficultInput.value).join('');
    saveSettings();
    renderLetterSettings();
  });

  el.startBtn.addEventListener('click', startGame);
  el.drawBtn.addEventListener('click', () => draw());
  el.redrawBtn.addEventListener('click', () => draw(true));
  el.presentBtn.addEventListener('click', enterPresentation);
  el.exitPresentBtn.addEventListener('click', exitPresentation);
  el.restartBtn.addEventListener('click', restart);
  el.endBtn.addEventListener('click', endGame);
}

async function init() {
  state.settings = await state.store.getSettings();
  await loadCustom();
  bindEvents();
  renderSetup();

  // Resume a game left in progress (e.g. after a refresh).
  const saved = Game.fromJSON(state.store.loadGame());
  if (saved) {
    state.game = saved;
    setStatus(saved.current ? `Every answer must begin with ${saved.current}` : 'Press “Draw letter” to begin');
    renderGame();
  }

  showScreen('home');
  initAuth();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.error('Service worker:', err));
  }
}

init();
