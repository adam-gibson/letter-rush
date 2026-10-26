# Letter Rush

A party word game in the style of Scattergories. Choose six categories, draw a letter, and everyone writes an answer beginning with that letter for each category. Scores are kept on paper.

Plain HTML, CSS and JavaScript (ES modules). No build step.

## Run locally

Service workers and modules need a web server, not `file://`:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (files at the root).
2. **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. The app will be at `https://<username>.github.io/<repo>/`. All paths are relative, so it works in a sub-folder.

When you deploy changes, bump `CACHE_VERSION` in `sw.js` so installed copies update.

## Keyboard shortcuts (game screen)

| Key | Action |
| --- | --- |
| D or Space | Draw letter |
| R | Redraw |
| P | Presentation mode on/off |
| Esc | Exit presentation mode |

## Structure

```
index.html              Markup for the set-up and game screens, dialogs
css/styles.css          Mobile-first light theme, presentation-mode layout
js/app.js               UI controller (rendering, events, presentation mode)
js/game.js              Pure game logic: letter pool, draw, redraw, no repeats
js/categories.js        Built-in categories
js/wake-lock.js         Screen Wake Lock API wrapper
js/config.js            Supabase URL and anon key (blank = offline only)
js/auth.js              Supabase email sign-in wrapper (inactive until configured)
js/data/store.js        Picks LocalStore or SupabaseStore
js/data/local-store.js  localStorage implementation
js/data/supabase-store.js  Supabase implementation (custom categories)
supabase/schema.sql     Table and row-level security policies
sw.js                   Offline cache
manifest.json, icons/   PWA metadata and icons
```

The UI only talks to a *store* object with one async interface (`listCustomCategories`, `addCustomCategory`, `deleteCustomCategory`, `getSettings`, `saveSettings`, plus device-local `loadGame`/`saveGame`/`clearGame`). Signed out it is `LocalStore`; signed in it is `SupabaseStore`, which overrides only the category methods.

## Adding Supabase accounts

The code is already written; it switches on when configured.

1. Supabase dashboard → **SQL Editor**: run `supabase/schema.sql`.
2. **Authentication → Sign In / Providers**: make sure *Email* is enabled.
3. **Authentication → URL Configuration**: set *Site URL* to your GitHub Pages URL and add it (and `http://localhost:8000/` for testing) to *Redirect URLs*.
4. **Project Settings → API**: copy the *Project URL* and *publishable (or legacy anon)* key into `js/config.js`.
5. Bump `CACHE_VERSION` in `sw.js` and deploy.

A **Sign in** button then appears in the header. Players receive a magic link by email. On first sign-in on a device, any categories saved locally are copied to their account. Settings and the game in progress remain on the device. Signed-in categories are cached so they still show offline.

To sync other data later (for example settings), add a table with the same RLS pattern and override `getSettings`/`saveSettings` in `SupabaseStore`.
