// localStorage implementation of the data store.
// Every store exposes the same async interface so the UI never needs to know
// where data lives:
//   listCustomCategories() → [{ id, name, createdAt }]
//   addCustomCategory(name) → { id, name, createdAt }
//   deleteCustomCategory(id)
//   getSettings() / saveSettings(settings)
//   loadGame() / saveGame(game) / clearGame()   (always device-local)

export const KEYS = {
  categories: 'letterRush.customCategories',
  settings: 'letterRush.settings',
  game: 'letterRush.game',
};

export const DEFAULT_SETTINGS = {
  selected: [],
  target: 10,
  targetIsCustom: false,
  excludeDifficult: true,
  difficultLetters: 'QXZ',
};

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export class LocalStore {
  async listCustomCategories() {
    return read(KEYS.categories, []);
  }

  async addCustomCategory(name) {
    const list = read(KEYS.categories, []);
    const category = { id: newId(), name, createdAt: new Date().toISOString() };
    list.push(category);
    if (!write(KEYS.categories, list)) throw new Error('Storage is unavailable.');
    return category;
  }

  async deleteCustomCategory(id) {
    write(KEYS.categories, read(KEYS.categories, []).filter((c) => c.id !== id));
  }

  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
  }

  async saveSettings(settings) {
    write(KEYS.settings, settings);
  }

  loadGame() {
    return read(KEYS.game, null);
  }

  saveGame(game) {
    write(KEYS.game, game);
  }

  clearGame() {
    write(KEYS.game, null);
  }
}
