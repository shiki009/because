# Because

**The only bookmark that asks you why.**

## Run

```bash
python3 -m http.server 8765
# Open http://localhost:8765
```

*Must use a local server—ES modules don't work from `file://`.*

## Features

- **Capture** — Save anything + one sentence: *Because...*
- **Search** — By content or reasoning
- **Export** — Download all data as JSON
- **Import** — Restore from backup or merge from another device
- **Storage** — IndexedDB with localStorage fallback
- **Privacy** — Data stays in your browser. No account. No tracking.
- **Accessible** — Skip link, ARIA labels, keyboard navigation

## Data

- Stored in IndexedDB (larger capacity, async)
- Automatically migrates from legacy localStorage
- Falls back to localStorage if IndexedDB unavailable (e.g. private mode)
- Export/import for backup and portability

---

*Remember why.*
