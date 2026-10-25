// Pure game logic: no DOM, no storage.
export const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

/** Turn free text such as "q, x z" into ['Q', 'X', 'Z']. */
export function parseLetters(text = '') {
  return [...new Set(String(text).toUpperCase().replace(/[^A-Z]/g, ''))];
}

function randomItem(list) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return list[buf[0] % list.length];
}

export class Game {
  /**
   * @param {{categories: string[], target: number, excluded?: string[],
   *          history?: {letter: string, discarded: boolean}[]}} options
   */
  constructor({ categories, target, excluded = [], history = [] }) {
    this.categories = categories;
    this.target = target;
    this.excluded = excluded;
    this.history = history; // every letter drawn this game, in order
  }

  get current() {
    return this.history.at(-1)?.letter ?? null;
  }

  /** Letters still available: never drawn (or redrawn) and not excluded. */
  get pool() {
    const used = new Set(this.history.map((h) => h.letter));
    return ALPHABET.filter((l) => !used.has(l) && !this.excluded.includes(l));
  }

  draw() {
    const pool = this.pool;
    if (!pool.length) return null;
    const letter = randomItem(pool);
    this.history.push({ letter, discarded: false });
    return letter;
  }

  /** Discard the current letter (it does not return to the pool) and draw another. */
  redraw() {
    const last = this.history.at(-1);
    if (!last || !this.pool.length) return null;
    last.discarded = true;
    return this.draw();
  }

  toJSON() {
    const { categories, target, excluded, history } = this;
    return { categories, target, excluded, history };
  }

  static fromJSON(data) {
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.history)) return null;
    return new Game(data);
  }
}
