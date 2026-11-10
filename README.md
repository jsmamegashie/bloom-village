# Bloom Village
Joanita's village of AI agents, as an installable web app (PWA) on Vercel.
- `index.html` the village. `shim.js` connects it to Supabase (data, behind the village passcode) and to `/api/sample` (Claude, key kept on the server).
- `api/` serverless functions: Claude, file uploads (Vercel Blob), phone alerts (web push).
- Env vars on Vercel: ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN, VAPID_PUBLIC, VAPID_PRIVATE, NOTIFY_KEY.
