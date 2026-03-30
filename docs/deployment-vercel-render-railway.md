# CarVista Deployment Guide

This repository is split into:

- Backend API root: `backend/`
- Frontend root: `backend/cars-com-clone/`
- Database engine: MySQL

Target hosting:

- Frontend: Vercel
- Backend API: Render Web Service
- Database: Railway MySQL

## 1. Deployment order

1. Provision Railway MySQL
2. Deploy backend to Render
3. Deploy frontend to Vercel
4. Update social login redirect URIs
5. Run seed/bootstrap or ingestion jobs if needed

## 2. Railway database

Create a MySQL service in Railway and copy either:

- `DATABASE_URL`
- or the split variables Railway exposes such as `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`

The backend now supports both styles.

Recommended Render env:

- `DATABASE_URL=<railway-mysql-url>`

Optional DB env if you prefer split config:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`

## 3. Render backend

Use the root directory `backend/`.

Recommended service settings:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

The repo includes `render.yaml` with the expected service shape.

Minimum backend env vars:

- `NODE_ENV=production`
- `PORT=10000`
- `APP_PUBLIC_URL=https://<your-render-service>.onrender.com`
- `FRONTEND_URL=https://<your-vercel-app>.vercel.app`
- `DATABASE_URL=<railway-mysql-url>`
- `JWT_SECRET=<strong-secret>`
- `OTP_SECRET=<strong-secret>`
- `SOCIAL_STATE_SECRET=<strong-secret>`

Recommended auth/notification env vars:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://<your-render-service>.onrender.com/api/auth/social/google/callback`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URI=https://<your-render-service>.onrender.com/api/auth/social/facebook/callback`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `SMS_PROVIDER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

CORS env:

- `CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app`
- `CORS_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app`

Health verification after deploy:

- `GET https://<render-service>/health`
- `GET https://<render-service>/api/health`
- `GET https://<render-service>/api-docs`

## 4. Vercel frontend

Use the root directory `backend/cars-com-clone/`.

Recommended settings:

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build`

Frontend env vars:

- `NEXT_PUBLIC_APP_URL=https://<your-vercel-app>.vercel.app`
- `NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com/api`

The frontend now reads API/runtime URLs from:

- `cars-com-clone/src/lib/runtime-config.ts`
- `cars-com-clone/src/lib/api-client.ts`
- `cars-com-clone/src/lib/carvista-api.ts`

## 5. Social login callbacks

Backend initiates and completes provider auth.

Use these callback URLs in Google/Facebook consoles:

- Google: `https://<render-service>.onrender.com/api/auth/social/google/callback`
- Facebook: `https://<render-service>.onrender.com/api/auth/social/facebook/callback`

The backend redirects back to the frontend callback page:

- `https://<your-vercel-app>.vercel.app/auth/social/callback`

Make sure `FRONTEND_URL` matches the deployed Vercel app origin.

## 6. Bootstrap and data refresh

For local/dev bootstrap:

```bash
npm run data:seed
```

To refresh intelligence materializations:

```bash
npm run data:refresh
```

Optional ingestion jobs:

```bash
npm run data:ingest:facts
npm run data:ingest:market
npm run data:ingest:history
npm run data:ingest:fuel
npm run data:ingest:recalls
```

These jobs are not part of Render startup. Run them intentionally after the DB is provisioned.

## 7. Local env templates

Use:

- `backend/.env.example`
- `backend/cars-com-clone/.env.example`

Do not commit real secrets.

## 8. Production notes

- Backend now honors `PORT` and supports both `DATABASE_URL` and split MySQL env vars.
- Backend CORS is no longer fully open; it uses allowlisted origins/patterns.
- Root `/health` was added for Render health checks.
- OpenAPI server URL is now relative, so docs are usable across local, preview, and production.
- Frontend API calls no longer show a hardcoded localhost-only failure message.
