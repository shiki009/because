# Because — Pick from tabs

Chrome extension that adds a tab picker button next to the content input. Lets you choose from your open browser tabs when saving a bookmark.

## Install (unpacked)

1. Open Chrome → Extensions → Manage extensions
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension` folder

## Production URL

By default the extension injects only on `localhost`, `127.0.0.1`, and `file://`. To use it on your deployed Because app, add your URL to `manifest.json`:

```json
"matches": [
  "http://localhost/*",
  "http://127.0.0.1/*",
  "file:///*",
  "https://your-app.vercel.app/*"
]
```

Replace `your-app.vercel.app` with your actual domain.
