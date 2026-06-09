# Watch Together

Friends ke saath videos real-time sync mein watch karo.

---

## Kya install karna hai (ek baar)

### 1. Node.js 18+
Download: [nodejs.org](https://nodejs.org)

Verify:
```bash
node -v
```

### 2. FFmpeg
Download: [ffmpeg.org/download](https://ffmpeg.org/download.html)

Windows pe download karo, extract karo, aur `bin` folder ko System PATH mein add karo.

Verify:
```bash
ffmpeg -version
```

### 3. cloudflared
```bash
winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
```

Verify:
```bash
cloudflared --version
```

---

## Pehli baar setup (sirf ek baar karna hai)

### Step 1 — Dependencies install karo

```bash
npm run install-all
```

### Step 2 — Server ka `.env.local` banao

```bash
cp server/.env.local.example server/.env.local
```

Phir `server/.env.local` open karo aur ye values fill karo:

| Variable | Kahan se milegi |
|----------|----------------|
| `SUPABASE_URL` | supabase.com → Project Settings → API |
| `SUPABASE_ANON_KEY` | supabase.com → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | supabase.com → Project Settings → API |
| `R2_ACCOUNT_ID` | dash.cloudflare.com → R2 |
| `R2_BUCKET_NAME` | dash.cloudflare.com → R2 → bucket name |
| `R2_ACCESS_KEY_ID` | dash.cloudflare.com → R2 → Manage API Tokens |
| `R2_SECRET_ACCESS_KEY` | dash.cloudflare.com → R2 → Manage API Tokens |
| `R2_ENDPOINT` | `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | R2 bucket → Settings → Public Access URL |
| `WS_ORIGIN` | Vercel URL + localhost, comma separated |

Example:
```
WS_ORIGIN=http://localhost:3000,https://your-app.vercel.app
```

### Step 3 — Vercel environment variables set karo

Vercel Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL = https://your-tunnel-domain.com
NEXT_PUBLIC_WS_URL  = https://your-tunnel-domain.com
```

> `your-tunnel-domain.com` = woh domain jo Cloudflare Tunnel mein configure kiya hai

### Step 4 — Cloudflare login karo

```bash
cloudflared tunnel login
```

Browser open hoga — login karo aur authorize karo.

### Step 5 — Tunnel banao

```bash
cloudflared tunnel create watch-together
```

### Step 6 — Tunnel config banao

File: `C:\Users\<YOUR_NAME>\.cloudflared\config.yml`

```yaml
tunnel: <tunnel-id>
credentials-file: C:\Users\<YOUR_NAME>\.cloudflared\<tunnel-id>.json

ingress:
  - service: http://localhost:3001
```

Tunnel ID pata karne ke liye:
```bash
cloudflared tunnel list
```

### Step 7 — Domain route karo

Cloudflare Dashboard → Zero Trust → Networks → Tunnels → apna tunnel → Public Hostnames:

- Subdomain: `watch-api`
- Domain: tumhara domain
- Service: `http://localhost:3001`

### Step 8 — Vercel mein Root Directory set karo

Vercel Dashboard → Project → Settings → General → Root Directory:

```
client
```

Save karo. Isse Vercel sirf `client/` folder build karega.

---

## Roz use karna (har baar)

**2 terminals kholna hai:**

**Terminal 1:**
```bash
npm run server
```

**Terminal 2:**
```bash
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run watch-together
```

Bas. Frontend Vercel pe already live hai — server aur tunnel chalne ke baad app fully working hoga.

---

## Videos add karne ke 2 tarike

**1. Browser se upload:**
App mein `/upload` page pe jao → file select karo → upload hoga R2 pe → FFmpeg process karega → Library mein aayega.

**2. Local folder se import:**
Video file ko `server/import/` folder mein daal do. Server automatically 30 seconds mein detect karega aur process karega.

---

## Troubleshooting

**Server start nahi ho raha**
- `server/.env.local` mein sab values fill hain?
- Port 3001 free hai? `netstat -ano | findstr :3001`

**Tunnel connect nahi ho raha**
```bash
# Credentials file check karo
dir "%USERPROFILE%\.cloudflared"
# Hona chahiye: <tunnel-id>.json aur cert.pem

# Agar JSON nahi hai to regenerate karo
cloudflared tunnel token --cred-file "%USERPROFILE%\.cloudflared\<tunnel-id>.json" watch-together
```

**Vercel deploy fail ho raha hai**
- Vercel → Settings → General → Root Directory = `client` set hai?

**Frontend server se connect nahi ho raha**
- Vercel mein `NEXT_PUBLIC_API_URL` aur `NEXT_PUBLIC_WS_URL` tunnel domain pe point kar rahe hain?
- `server/.env.local` mein `WS_ORIGIN` mein Vercel URL hai?
- Env vars change ke baad Vercel redeploy kiya?

**Video sync nahi ho raha**
- Browser DevTools → Console → `[SOCKET]` aur `[VIDEO SYNC]` logs dekho
- Dono users same room mein hain?

**FFmpeg kaam nahi kar raha**
- `ffmpeg -version` command chalao
- Agar "not recognized" aaye to FFmpeg PATH mein add nahi hai
