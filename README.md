# Watch Together

Real-time video sync app — watch videos in perfect sync with friends.

## How It Works

- Frontend is deployed on **Vercel**
- Backend (server + workers) runs **locally on your machine**
- **Cloudflare Tunnel** exposes your local server to the internet so Vercel can reach it

```
Vercel (Frontend)  ──→  Cloudflare Tunnel  ──→  localhost:3001 (Your Machine)
```

---

## Prerequisites

- Node.js 18+
- FFmpeg installed and in PATH → [ffmpeg.org/download](https://ffmpeg.org/download.html)
- cloudflared installed → see below

---

## First-Time Setup

### 1. Install Dependencies

```bash
npm run install-all
```

### 2. Configure Environment Variables

**Server** — copy the example and fill in your values:

```bash
cp server/.env.local.example server/.env.local
```

Open `server/.env.local` and set:

| Variable | Where to get it |
|----------|----------------|
| `SUPABASE_URL` | supabase.com → Project Settings → API |
| `SUPABASE_ANON_KEY` | supabase.com → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | supabase.com → Project Settings → API |
| `R2_ACCOUNT_ID` | dash.cloudflare.com → R2 |
| `R2_BUCKET_NAME` | dash.cloudflare.com → R2 → your bucket name |
| `R2_ACCESS_KEY_ID` | dash.cloudflare.com → R2 → Manage API Tokens |
| `R2_SECRET_ACCESS_KEY` | dash.cloudflare.com → R2 → Manage API Tokens |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | R2 bucket → Settings → Public Access URL |
| `WS_ORIGIN` | comma-separated list of allowed origins (your Vercel URL + localhost) |

**Client** — set these in Vercel dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL = https://your-tunnel-domain.com
NEXT_PUBLIC_WS_URL  = https://your-tunnel-domain.com
```

> After updating Vercel env vars, redeploy for changes to take effect.

### 3. Install cloudflared (Windows)

```bash
winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
```

### 4. Login to Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window — log in and authorize your domain.

### 5. Create a Tunnel (only needed once)

```bash
cloudflared tunnel create watch-together
```

### 6. Configure the Tunnel

Create or update `C:\Users\<YOU>\.cloudflared\config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: C:\Users\<YOU>\.cloudflared\<your-tunnel-id>.json

ingress:
  - service: http://localhost:3001
```

Get your tunnel ID with:

```bash
cloudflared tunnel list
```

### 7. Route Your Domain to the Tunnel

In Cloudflare dashboard → Zero Trust → Networks → Tunnels → your tunnel → Public Hostnames, add:

- Subdomain: `watch-api` (or whatever you prefer)
- Domain: your domain
- Service: `http://localhost:3001`

---

## Running the App (Daily Use)

Open **two terminals**:

**Terminal 1 — Backend server:**

```bash
npm run server
```

**Terminal 2 — Cloudflare Tunnel:**

```bash
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run watch-together
```

Once both are running, your Vercel frontend can connect to your local server via the tunnel.

---

## Local Development (Frontend too)

If you want to run the frontend locally as well:

```bash
# Terminal 1
npm run server

# Terminal 2
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run watch-together

# Terminal 3
npm run client
# Opens at http://localhost:3000
```

Update `client/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## Project Structure

```
watch-together/
├── client/               # Next.js frontend (deployed on Vercel)
│   ├── src/app/          # Pages (home, room, upload, library)
│   ├── src/components/   # UI components
│   ├── src/hooks/        # useRoom, useVideoSync, useWebRTC, useChat
│   └── src/lib/          # Socket.IO client
│
├── server/               # Express + Socket.IO backend (runs locally)
│   ├── src/index.ts      # Entry point
│   ├── src/socket/       # Room, playback, sync, WebRTC, chat handlers
│   ├── src/routes/       # REST API (upload, stream, videos, import)
│   ├── src/workers/      # Local job queue + folder watcher
│   ├── src/ffmpeg/       # FFmpeg processing (transcode + thumbnail)
│   ├── src/lib/          # Supabase + R2 clients
│   └── import/           # Drop video files here for auto-import
│
└── shared/               # Types and constants shared between client/server
    ├── types.ts
    └── constants.ts
```

---

## Key Concepts

### Video Sync

All play/pause/seek events go through the server. The server holds the source of truth for room state and broadcasts to all connected clients. If a client drifts more than 500ms from the room state, it gets force-synced.

### Video Upload

Two ways to add videos:

1. **Browser upload** — client gets a presigned URL from the server, uploads directly to Cloudflare R2, then notifies the server to start processing.
2. **Local import** — drop video files into `server/import/`. The folder watcher detects them every 30 seconds and queues them for processing automatically.

### FFmpeg Processing

When a video is queued, the server runs FFmpeg locally to:
- Transcode to HLS (multiple quality levels: 360p, 480p, 720p, 1080p)
- Generate a thumbnail

Processed files are uploaded to R2 and the video status in Supabase is updated to `ready`.

---

## Supabase Tables

You need these tables in your Supabase project:

**`videos`**
```sql
id            uuid primary key
filename      text
original_name text
file_size     bigint
mime_type     text
status        text   -- uploading | processing | ready | failed
stream_path   text
thumbnail_path text
created_at    timestamptz default now()
updated_at    timestamptz
```

**`rooms`**, **`room_users`**, **`room_sessions`** — used for persistent room state (optional for MVP, server uses in-memory fallback).

---

## Troubleshooting

**Server won't start**
- Check `server/.env.local` has all required values
- Make sure port 3001 is free: `netstat -ano | findstr :3001`

**Tunnel credentials missing**

```bash
# Regenerate credentials file
cloudflared tunnel token --cred-file "%USERPROFILE%\.cloudflared\<tunnel-id>.json" watch-together
```

**Tunnel connected but getting 503**
- Make sure `server` is running on port 3001 before the tunnel receives requests
- Check `config.yml` has `service: http://localhost:3001`

**Vercel frontend can't connect**
- Verify `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` in Vercel point to your tunnel domain
- Redeploy Vercel after changing env vars
- Check `WS_ORIGIN` in `server/.env.local` includes your Vercel URL

**Video not syncing**
- Open browser DevTools → Console
- Look for `[SOCKET]` and `[VIDEO SYNC]` logs
- Both users must be in the same room

**FFmpeg errors**
- Verify FFmpeg is installed: `ffmpeg -version`
- Add FFmpeg to system PATH if command not found

---

## Health Check

```bash
curl http://localhost:3001/api/health
```

```json
{
  "status": "ok",
  "uptime": 3600,
  "rooms": 2,
  "queue": { "pending": 0, "processing": 0, "completed": 5, "failed": 0 }
}
```
