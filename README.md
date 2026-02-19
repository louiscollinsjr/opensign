# Opensign monorepo
Backend on Fly.io (Node/Express, MongoDB Atlas) and frontend on Vercel (Next.js).

## Backend (Fly.io)
- Path: `backend/`
- Commands: `npm install`, `npm run dev`, `npm start`
- Env: copy `.env.example` to `.env` with `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `TWILIO_*`, `VERCEL_BLOB_READ_WRITE_TOKEN`.
- Deploy: `fly launch --no-deploy` (first time) then `fly deploy`.
- Health: `GET /health` on port 3000.

## Frontend (Vercel)
- Path: `frontend/`
- Commands: `npm install`, `npm run dev`, `npm run build`
- Env: set `NEXT_PUBLIC_API_URL` in Vercel (and locally if needed).
- Deploy: Vercel auto-builds using `vercel.json` (`frontend/package.json` with @vercel/next).

## DNS
- Backend: `api.opensign.atem.gdn` → Fly app.
- Frontend: `opensign.atem.gdn` (or `app.`) → Vercel project.

## Storage / Email / SMS
- File storage: Vercel Blob.
- Email: Resend.
- SMS: Twilio or Vonage via API keys.
