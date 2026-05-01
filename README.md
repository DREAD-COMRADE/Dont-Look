# DON'T LOOK — Deployment Guide

## Deploy to Railway (free, online, shareable link)

### Step 1 — GitHub
1. Go to github.com and create a free account if you don't have one
2. Click the + button → New repository
3. Name it `dont-look`, set it to Public, click Create
4. Upload all these files to the repository (drag and drop works)

### Step 2 — Railway
1. Go to railway.app and sign up with your GitHub account
2. Click New Project → Deploy from GitHub repo
3. Select your `dont-look` repository
4. Railway auto-detects the config and starts building

### Step 3 — Set environment variable
1. In your Railway project, click your service → Variables tab
2. Add: `NODE_ENV` = `production`
3. Railway will redeploy automatically

### Step 4 — Get your link
1. Go to Settings → Networking → Generate Domain
2. You get a URL like `https://dont-look-production.up.railway.app`
3. Share that URL with anyone — they open it and play instantly

## Local development
```
npm install
npm run dev
```
Open http://localhost:3000

## Controls
- WASD — move
- Mouse — look (click window first)
- Shift — run
- E (hold) — ritual sacrifice
- F — flicker lights (Lost players only)
