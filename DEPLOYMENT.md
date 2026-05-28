# Deployment Guide

## Local Development

No special setup needed! Just follow [QUICKSTART.md](./QUICKSTART.md)

## Deploy to Vercel (Frontend)

### Prerequisites
- Vercel account (free at vercel.com)
- GitHub account with repo

### Steps

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/watch-together.git
git push -u origin main
```

2. **Deploy Frontend to Vercel**
```bash
npm install -g vercel
vercel --prod
```

3. **Configure Environment Variables in Vercel**
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NEXT_PUBLIC_WS_URL=wss://your-backend-domain.com
```

## Deploy Backend

### Option 1: Heroku (Recommended for MVP)

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set PORT=3001 -a your-app-name
heroku config:set NODE_ENV=production -a your-app-name
heroku config:set WS_ORIGIN=https://your-frontend-domain.com -a your-app-name

# Deploy
git push heroku main
```

### Option 2: Cloudflare Workers (Future)

For MVP 2 with heavy processing:

```bash
# Install Wrangler
npm install -g @cloudflare/wrangler

# Create worker
wrangler init my-worker

# Deploy
wrangler publish
```

### Option 3: Railway (Simple)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

## Docker Deployment

### Build Images

```bash
# Frontend
docker build -t watch-together-client ./client

# Backend
docker build -t watch-together-server ./server

# Run together
docker-compose up -d
```

### Deploy to Cloud with Docker

1. **Google Cloud Run**
```bash
# Push to Google Container Registry
docker tag watch-together-server gcr.io/PROJECT_ID/watch-together-server
docker push gcr.io/PROJECT_ID/watch-together-server

# Deploy
gcloud run deploy watch-together-server \
  --image gcr.io/PROJECT_ID/watch-together-server \
  --platform managed \
  --region us-central1
```

2. **AWS Elastic Container Service**
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag watch-together-server 123456789.dkr.ecr.us-east-1.amazonaws.com/watch-together-server:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/watch-together-server:latest
```

## Cloudflare Tunnel (Free Backend Access)

For running backend on local laptop and exposing via Cloudflare:

### Setup

1. **Install Cloudflare Tunnel**
```bash
# Mac
brew install cloudflare/cloudflare/cloudflared

# Windows
# Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# Linux
# Use package manager or download
```

2. **Authenticate**
```bash
cloudflared tunnel login
```

3. **Create Tunnel**
```bash
cloudflared tunnel create watch-together
```

4. **Configure Tunnel**
Create `~/.cloudflared/config.yml`:
```yaml
tunnel: watch-together
credentials-file: /Users/USERNAME/.cloudflared/watch-together.json

ingress:
  - hostname: watch-together.example.com
    service: http://localhost:3001
  - hostname: "*.example.com"
    service: http_status:404
```

5. **Start Tunnel**
```bash
cloudflared tunnel run watch-together
```

6. **Route Traffic**
```bash
cloudflared tunnel route dns watch-together watch-together.example.com
```

## Environment Variables for Production

### Frontend (.env.production)
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_APP_NAME="Watch Together"
```

### Backend (.env.production)
```bash
PORT=3001
NODE_ENV=production
WS_ORIGIN=https://yourdomain.com
CLOUDFLARE_TUNNEL_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
ENABLE_LOCAL_WORKERS=true
WORKERS_QUEUE_TYPE=redis
```

## Monitoring

### Server Health Check
```bash
curl https://api.yourdomain.com/api/health
```

### Response
```json
{
  "status": "ok",
  "uptime": 3600,
  "rooms": 5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Database Upgrade (Future)

For persistent room state (MVP 2):

### PostgreSQL
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

### Redis
```bash
heroku addons:create heroku-redis:premium-0
```

## Scaling Considerations

### Current (MVP 1)
- Single server, in-memory storage
- Max ~50 concurrent rooms
- Max ~500 concurrent users

### Next Steps (MVP 2)
- Add Redis for distributed caching
- Use database for persistence
- Implement worker queue system
- Enable Cloudflare Workers

### Production Ready (MVP 3)
- Horizontal scaling with load balancer
- Distributed cache (Redis Cluster)
- Database replication
- Worker scaling with Cloudflare
- CDN for video delivery

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm run install-all
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel (Frontend)
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
      
      - name: Deploy to Heroku (Backend)
        run: git push https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/${{ secrets.HEROKU_APP_NAME }}.git main
```

---

For questions about architecture, see README.md
