# Quick Start Guide

## 1️⃣ Installation (5 minutes)

```bash
# Navigate to project
cd "path/to/Watch Together"

# Install dependencies
npm run install-all
```

## 2️⃣ Environment Setup (2 minutes)

```bash
# Copy example env files
cp client/.env.local.example client/.env.local
cp server/.env.local.example server/.env.local

# No changes needed for local development - defaults are fine!
```

## 3️⃣ Start Development Servers (1 minute)

### Option A: Two Terminals (Recommended for development)

```bash
# Terminal 1 - Frontend
npm run client
# Runs on http://localhost:3000

# Terminal 2 - Backend  
npm run server
# Runs on http://localhost:3001
```

### Option B: Single Terminal

```bash
npm run dev
# Runs both frontend and backend
```

### Option C: Using Docker

```bash
docker-compose up
# Requires Docker to be installed
```

## 4️⃣ Open in Browser

Navigate to **http://localhost:3000**

You should see the Watch Together home page! 🎉

## 5️⃣ Try It Out

### Create a Room
1. Click **"🎬 Create Room"**
2. You'll see a room code (e.g., "ABC123") and unique link
3. Copy the link to your clipboard

### Test with Multiple Clients
1. **Open 2 browser tabs** with the same room link
   - Tab 1: http://localhost:3000/room/[id]?code=ABC123
   - Tab 2: http://localhost:3000/room/[id]?code=ABC123

2. **Test video sync:**
   - Click play in Tab 1 → should play in Tab 2
   - Click pause in Tab 2 → should pause in Tab 1
   - Seek in Tab 1 → should seek in Tab 2

3. **Observe the user count** - should show 2 users connected

## 🎯 What's Working (MVP 1)

✅ Room creation with unique codes
✅ Real-time user list updates
✅ Play/Pause sync across users
✅ Seek sync across users
✅ Auto-resync if time drifts >500ms
✅ Responsive mobile UI
✅ Copy room link button
✅ Connection status indicators

## 🔍 Troubleshooting

### "Failed to connect to server"
- Check both terminals are running
- Verify ports 3000 and 3001 aren't in use
- Check firewall isn't blocking connections

### "Video doesn't sync"
- Open browser DevTools (F12)
- Check Console for errors
- Make sure both clients are in same room
- Try force refresh (Ctrl+Shift+R)

### Port Already in Use
```bash
# Find process using port
# Windows
netstat -ano | findstr :3001

# Mac/Linux
lsof -i :3001

# Kill process
# Windows
taskkill /PID [PID] /F

# Mac/Linux
kill -9 [PID]
```

## 📚 Next Steps

1. **Explore the code:**
   - `client/src/app/room/[id]/page.tsx` - Main watching page
   - `server/src/socket/playback.ts` - Sync logic
   - `client/src/hooks/useVideoSync.ts` - Client-side sync

2. **Change video URL:**
   - On room page, click "+ Add/Change Video URL"
   - Paste any MP4, WebM, or HLS stream URL
   - Click Load

3. **Test with different network:**
   - Get your local IP: `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows)
   - Share URL with IP: `http://[YOUR_IP]:3000`
   - Works on mobile too!

4. **Read the architecture:**
   - See [README.md](./README.md) for full documentation
   - See [workers/README.md](./workers/README.md) for worker system

## 🚀 Running Commands

```bash
# Frontend
npm run client              # Start dev server
npm run build             # Build for production
npm start                 # Start production build

# Backend
npm run server            # Start with nodemon (auto-reload)
npm run build             # Compile TypeScript
npm start                 # Run compiled version

# Both
npm run dev               # Start both (dev mode)
npm run build             # Build both
npm run format            # Format code (Prettier)
npm run lint              # Lint code (ESLint)
```

## 💡 Pro Tips

1. **Use DevTools for debugging:**
   ```javascript
   // In browser console
   socketClient.getId()  // Get your socket ID
   ```

2. **Monitor sync in real-time:**
   - Open DevTools
   - Look for `[VIDEO SYNC]` and `[SOCKET]` logs
   - Logs show every sync operation

3. **Test with 3+ users:**
   - Open multiple tabs/windows
   - See all actions broadcast to all clients
   - Perfect for testing real-time features

4. **Monitor sync metrics:**
   - Server logs show drift detection
   - Check `[SYNC]` logs for force-sync triggers
   - Useful for tuning `FORCE_SYNC_THRESHOLD`

## 🔗 Useful Links

- [Next.js Docs](https://nextjs.org/docs)
- [Socket.IO Docs](https://socket.io/docs)
- [Express Docs](https://expressjs.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## ✨ What's Next?

Once MVP 1 is working, check the roadmap in README.md for MVP 2 features:
- FFmpeg video processing
- HLS streaming
- Cloudflare integration
- Background workers on your laptop

---

**Enjoy watching together! 🎬👥**
