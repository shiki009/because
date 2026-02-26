# Because -- Project Instructions

> The only bookmark that asks you why. Save links, quotes, and ideas -- and the reason they matter. Vanilla JS + Vercel Functions, all data stored client-side in IndexedDB.

## Tech Stack

- **Language**: Vanilla JavaScript (ES modules, no framework)
- **Runtime**: Browser-native + Vercel Serverless Functions (Node.js)
- **Storage**: IndexedDB (primary), localStorage (fallback/legacy migration)
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/groq`) on server; direct REST calls to Groq/OpenAI/Gemini from browser with user-provided keys
- **Styling**: Plain CSS with CSS custom properties (design tokens), no preprocessor
- **Fonts**: DM Serif Display (headings), IBM Plex Sans (body) via Google Fonts
- **Deployment**: Vercel (static files + `/api/` serverless functions)
- **Extension**: Chrome Manifest V3 (tab picker)

## Project Structure

```
/                           -- project root (static site)
  index.html                -- main app page
  extension-install.html    -- extension installation guide
  app.js                    -- main application logic (ES module)
  storage.js                -- IndexedDB/localStorage abstraction
  ai.js                     -- browser-side AI classification (user keys)
  chart.js                  -- SVG radar chart rendering
  theme.js                  -- light/dark theme initializer (IIFE, non-module)
  styles.css                -- all styles, CSS custom properties
  favicon.svg               -- app icon
  og-image.png              -- Open Graph image
  vercel.json               -- Vercel config (headers, CSP)
  package.json              -- dependencies (ai SDK only)
  api/
    segment.js              -- Vercel Function: AI topic classification
  extension/
    manifest.json           -- Chrome extension manifest (V3)
    background.js           -- service worker (tab listing)
    content.js              -- content script (tab picker UI injection)
    content.css             -- content script styles
    README.md               -- extension docs
```

## Naming Conventions

- **Files**: `kebab-case.js`, `kebab-case.css`, `kebab-case.html`
- **Functions**: `camelCase` -- `loadItems`, `saveItems`, `classifyWithUserKey`
- **Constants**: `UPPER_SNAKE_CASE` -- `DB_NAME`, `STORE_NAME`, `ALLOWED_TOPICS`, `PAGE_SIZE`
- **CSS properties**: `--kebab-case` -- `--bg`, `--surface`, `--accent`, `--text-muted`
- **CSS classes**: `kebab-case` -- `.item-content`, `.search-bar`, `.ai-settings-overlay`
- **DOM IDs**: `kebab-case` -- `#content`, `#because`, `#ai-settings-btn`
- **Data attributes**: `data-kebab` -- `data-id`, `data-topic`, `data-url`

## Module Architecture

The app uses ES modules loaded via `<script type="module">`:

```
app.js (entry point)
  imports from storage.js   -- loadItems(), saveItems()
  imports from chart.js     -- computeRadarData(), renderRadarChart()
  imports from ai.js        -- classifyWithUserKey(), getUserAIConfig(), saveUserAIConfig(), clearUserAIConfig()

theme.js                    -- standalone IIFE, loaded via <script> (non-module, runs before DOM)
```

### Key Exports

**storage.js**:
- `loadItems()` -- async, returns item array from IndexedDB (falls back to localStorage)
- `saveItems(items)` -- async, writes full item array to IndexedDB

**ai.js**:
- `classifyWithUserKey(content, because, provider, apiKey)` -- calls AI provider REST API
- `getUserAIConfig()` -- returns `{ provider, apiKey }` from localStorage
- `saveUserAIConfig(provider, apiKey)` -- persists to localStorage
- `clearUserAIConfig()` -- removes from localStorage

**chart.js**:
- `computeRadarData(items)` -- returns `{ labels, values, counts }`
- `renderRadarChart(container, data, onTopicSelect)` -- renders SVG into container

## Data Model

All data is stored client-side. There is no server-side database.

### Item Object

```javascript
{
  id: string,           // crypto.randomUUID() or fallback
  content: string,      // the bookmark (URL, quote, idea)
  because: string,      // why it matters
  createdAt: string,    // ISO 8601 timestamp
  topics: string[]      // AI-assigned topics, e.g. ["Learning", "Reference"]
}
```

### Allowed Topics

```javascript
const ALLOWED_TOPICS = ['Learning', 'Ideas', 'Reference', 'Work', 'Inspiration', 'Personal', 'Other'];
```

### IndexedDB Schema

- **Database**: `because_db` (version 1)
- **Object store**: `items` (keyPath: `id`)
- No indexes beyond the keyPath
- Migration: auto-migrates from `localStorage` key `because_items` on first load

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `because_items` | Legacy item storage (migrated to IndexedDB) |
| `because-theme` | Theme preference (`light` or `dark`) |
| `because-ai-provider` | AI provider name (`groq`, `openai`, `gemini`) |
| `because-ai-key` | User's AI API key |
| `because-nudge-backup` | Flag: first-save backup nudge shown |
| `because-nudge-ai` | Flag: third-save AI nudge shown |

## Vercel Function Pattern

Serverless functions live in `api/` and use the default Vercel Node.js runtime:

```javascript
// api/{name}.js
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const ALLOWED_ORIGINS = [
  'https://because-five.vercel.app',
  'http://localhost:8765',
  'http://localhost:3000',
  'http://127.0.0.1:8765',
  'http://127.0.0.1:3000',
];

export default async function handler(req, res) {
  // 1. CORS headers
  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  // 2. Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 3. Method check
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 4. Read env
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Not configured' });

  // 5. Parse + validate input
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  // ...validate fields

  // 6. Business logic
  // ...

  // 7. Return JSON
  return res.status(200).json({ /* result */ });
}
```

**Key rules**:
- Always handle CORS with explicit origin allowlist
- Always handle OPTIONS preflight
- Always check HTTP method
- Read secrets from `process.env`, never hardcode
- Sanitize all user input (strip newlines, limit length)
- Return JSON on success and error
- Graceful fallback on AI errors (return `['Other']`, not 500)

## CSS Architecture

### Design Tokens (CSS Custom Properties)

```css
:root, [data-theme="dark"] {
  --bg: #0d0d0d;
  --surface: #161616;
  --border: #2a2a2a;
  --text: #e8e8e8;
  --text-muted: #8a8a8a;
  --accent: #d4a853;
  --accent-dim: #b8923f;
  --danger: #e07c7c;
  --radius: 12px;
  --font-display: 'DM Serif Display', Georgia, serif;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
}

[data-theme="light"] {
  --bg: #f5f5f0;
  --surface: #ffffff;
  --border: #e0e0d8;
  --text: #1a1a1a;
  --text-muted: #6b6b6b;
  --accent: #b8860b;
  --accent-dim: #9a7209;
  --danger: #c45252;
}
```

### Style Rules

- All colors via CSS custom properties -- never hardcode hex in rules
- Theme switching via `data-theme` attribute on `<html>`
- Responsive: mobile breakpoint at `480px`
- Transitions: `0.2s` for interactive elements
- Modals/overlays: fixed position, `z-index: 1000`, toggle via `.is-open` class
- Toasts: fixed bottom-center, `z-index: 1000`, animate via `.visible` class
- Item cards: `.item` class with border, radius, surface background

## UI Patterns

### Toast Notifications

```javascript
function showToast(message, type = 'info') {
  // Creates #toast div, adds .toast and .toast-{type} classes
  // Auto-removes after 3000ms with fade transition
}
```

Types: `success`, `error`, `info`. Undo toasts use `.toast-undo` with action button.

### Modal Pattern

Modals use overlay + `.is-open` class toggle:

```javascript
function openModal() {
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}
// Close on Escape, click outside, close button
```

### Pagination

```javascript
const PAGE_SIZE = 15;
let visibleCount = PAGE_SIZE;
// "Load more" button increments visibleCount by PAGE_SIZE
```

### Input Validation (Because Field)

```javascript
const VAGUE = ['interesting', 'cool', 'good', 'nice', 'useful', 'great', 'awesome', 'ok', 'okay', 'fine', 'neat'];
// Rejects vague or too-short "because" entries with inline hint
```

### Item Lifecycle

1. User fills content + because fields
2. Validation (non-empty, non-vague)
3. `createItem()` generates UUID + timestamp
4. `saveItems()` persists to IndexedDB
5. Background AI classification via `classifyItem()`
6. Topics saved, list re-rendered

## Extension Architecture

Chrome Manifest V3 extension with three files:

- **background.js**: Service worker, handles `GET_TABS` message, returns filtered tab list
- **content.js**: Injects tab picker button + dropdown next to `#content` input
- **content.css**: Styles for injected picker UI

Communication: `chrome.runtime.sendMessage({ type: 'GET_TABS' })` from content script to background.

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GROQ_API_KEY` | Vercel env / `.env.local` | Server-side AI classification |

## Development

```bash
npm run dev          # Start Vercel dev server (includes API functions)
# or
python3 -m http.server 8765   # Static files only (no API)
```

## Security Rules

- Never send user API keys to the server -- browser-side classification uses direct provider calls
- CSP headers restrict script/connect sources (defined in `vercel.json`)
- CORS allowlist on API endpoints -- only known origins accepted
- Sanitize all AI inputs: strip `\r\n\t`, replace `"` with `'`, limit length
- No eval, no innerHTML with user content (use `textContent` or `escapeHtml()`)

## Feature Domains

- **Capture**: Save content + because reason
- **Timeline**: Chronological item list with pagination
- **Search**: Filter by content or because text
- **Topics**: AI-assigned topic labels, manual edit, topic filtering
- **Chart**: SVG radar chart of topic distribution
- **Data management**: JSON export/import, browser bookmark import
- **Bulk operations**: Multi-select, bulk delete
- **AI settings**: BYOK (bring your own key) for Groq/OpenAI/Gemini
- **Theme**: Light/dark mode with system preference detection
- **Extension**: Chrome tab picker

## Agent Pipelines

4 pipelines, 13 agent files. Full documentation in `.claude/agents/README.md`.

### Quick Reference

| Pipeline | Command | When | Stages |
|----------|---------|------|--------|
| **Feature** | `@bc-orchestrator` | New feature (3+ files) | planner -> architect -> implementor -> tester -> reviewer |
| **Bugfix** | `@bc-bug-orchestrator` | Bug, unknown root cause | triager -> fixer -> tester -> reviewer |
| **Hotfix** | `@bc-hotfix-orchestrator` | Bug, known root cause | fixer -> reviewer |
| **Refactor** | `@bc-refactor-orchestrator` | Restructure code | analyzer -> executor -> tester -> reviewer |

### Choosing the Right Pipeline

```
"I need a new feature"                    -> @bc-orchestrator
"Something is broken, not sure why"       -> @bc-bug-orchestrator
"Something is broken, I know the cause"   -> @bc-hotfix-orchestrator
"I want to restructure this code"         -> @bc-refactor-orchestrator
"Single-file fix, trivial change"         -> just do it directly
```

### Artifact Directories

Each pipeline writes to its own directory under `.planning/` (gitignored):

```
.planning/
  features/{slug}/      -- feature pipeline
  bugs/{slug}/          -- bugfix pipeline
  hotfixes/{slug}/      -- hotfix pipeline
  refactors/{slug}/     -- refactor pipeline
```

### Running Individual Agents

Any agent can run standalone without a pipeline:

```
@bc-bug-triager Investigate why exported JSON is missing topics
@bc-reviewer Review api/segment.js against conventions
@bc-refactor-analyzer Map all dependencies of storage.js
@bc-implementor Add a new API endpoint for batch classification
```
