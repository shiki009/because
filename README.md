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

## Tab picker (Chrome extension)

Install the `extension` folder as an unpacked Chrome extension to add a **Pick from tabs** button next to the content input. Lets you select from your open browser tabs instead of pasting. See `extension/README.md` for setup and how to add your production URL.

## AI segmentation (optional)

When deployed on Vercel with `GROQ_API_KEY` set, new bookmarks get AI-assigned topics (Learning, Ideas, Reference, etc.). Chart uses these. Without the API key or offline, chart falls back to keyword matching.

**Local testing:** Replace `your_groq_api_key_here` in `.env.local` with your key from [console.groq.com](https://console.groq.com), then run `npm run dev`.

## Data

- Stored in IndexedDB (larger capacity, async)
- Automatically migrates from legacy localStorage
- Falls back to localStorage if IndexedDB unavailable (e.g. private mode)
- Export/import for backup and portability

---

*Remember why.*
