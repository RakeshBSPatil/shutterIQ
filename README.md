<<<<<<< HEAD
# shutterIQ
AI-powered smart mobility &amp; shuttle route optimizer. Features capacity-constrained clustering, 2-opt stop ordering, weather &amp; traffic-aware departure scheduling, probabilistic lateness risk modeling, What-If disruption simulation, and a privacy-safe Google Gemini AI ops copilot. Built with React, Node.js, Supabase &amp; Leaflet.
=======
# ShuttleIQ — AI-Powered Smart Mobility Coordinator

ShuttleIQ replaces error-prone shuttle planning spreadsheets with a full-stack dispatch optimizer, probabilistic arrival-risk engine, interactive OpenStreetMap/OSRM routing workspace, and privacy-preserving Google Gemini AI copilot.

---

## Monorepo Layout

```text
shuttleIQ/
├── backend/                # Node 18+ ESM Express API, optimizer, risk predictor, Gemini layer
│   ├── sql/schema.sql      # Idempotent PostgreSQL / Supabase schema
│   ├── src/
│   │   ├── db/             # pg pool + schema init script
│   │   ├── middleware/     # JWT auth, Zod validate, asyncHandler, error handlers
│   │   ├── routes/         # auth, vehicles, riders, demo, plans
│   │   ├── schemas/        # Zod request schemas
│   │   ├── services/       # optimizer.js, predictor.js, gemini.js
│   │   ├── app.js          # Express app with helmet, cors allow-list, rate limits
│   │   └── server.js       # HTTP server + graceful shutdown
│   └── test/               # node:test unit tests for optimizer & predictor
├── frontend/               # React 18 + Vite + Tailwind CSS v3 + Leaflet v4 SPA
│   ├── public/_redirects   # SPA fallback for static hosts
│   ├── vercel.json         # Vercel SPA rewrite
│   └── src/                # Auth, Dashboard, Fleet & Riders, New Plan, Plan Detail
├── docs/
│   └── SUBMISSION.md       # Problem, solution, AI table, checklist, 4-min demo script
└── render.yaml             # Render backend deployment blueprint
```

---

## Local Setup

### Prerequisites
- Node.js `>= 18.0.0`
- A PostgreSQL database (Supabase recommended)
- Optional: a Google Gemini API key (`GEMINI_API_KEY`) — if omitted, every AI endpoint seamlessly uses deterministic rule-based fallbacks and reports `source: "fallback"`.

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit backend/.env with DATABASE_URL and JWT_SECRET (plus optional GEMINI_API_KEY)
npm install
npm run db:init
npm test
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
cp .env.example .env
# Ensure VITE_API_URL=http://localhost:4000/api
npm install
npm run dev
```

Open `http://localhost:5173`, create a coordinator account, and click **Load Demo Data** on the Dashboard to seed 4 vehicles (`14, 14, 8, 8` seats), 30 deterministic riders across 6 neighbourhoods, and an initial optimized morning plan.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | HTTP port for the Express server |
| `NODE_ENV` | No | `development` | Runtime mode (`development` or `production`) |
| `DATABASE_URL` | **Yes** | — | Supabase / PostgreSQL connection URI |
| `JWT_SECRET` | **Yes** | — | Secret key used to sign/verify Bearer JWT tokens |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allow-list of allowed frontend origins |
| `GEMINI_API_KEY` | No | `""` | Server-side Google Gemini API key (never exposed to browser) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model ID for JSON insights, What-If narratives, and chat |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | **Yes** | `http://localhost:4000/api` | Base URL of the deployed ShuttleIQ backend API |

---

## Backend API Endpoints

All `/api/vehicles`, `/api/riders`, `/api/demo`, and `/api/plans` routes require `Authorization: Bearer <token>`. JSON bodies are capped at `100kb` and validated with Zod.

| Method & Path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Health check returning `{ ok: true, ai: boolean }` |
| `POST /api/auth/register` | Public | Create user account (bcrypt password hash) and return JWT |
| `POST /api/auth/login` | Public | Authenticate user (uniform 401 message on invalid email/password) |
| `GET /api/auth/me` | Bearer JWT | Return current authenticated coordinator profile |
| `GET /api/vehicles` | Bearer JWT | List coordinator's shuttle vehicles |
| `POST /api/vehicles` | Bearer JWT | Add vehicle (`capacity` 1–60) |
| `PUT /api/vehicles/:id` | Bearer JWT | Update vehicle |
| `DELETE /api/vehicles/:id` | Bearer JWT | Delete vehicle |
| `GET /api/riders` | Bearer JWT | List coordinator's riders |
| `POST /api/riders` | Bearer JWT | Add rider stop (`lat`, `lng`, `address`) |
| `PUT /api/riders/:id` | Bearer JWT | Update rider |
| `DELETE /api/riders/:id` | Bearer JWT | Delete rider |
| `POST /api/demo/seed` | Bearer JWT | Transactional seed: 4 vehicles, 30 deterministic PRNG riders, starter plan |
| `GET /api/plans` | Bearer JWT | List saved dispatch plans for the user |
| `POST /api/plans` | Bearer JWT | Run optimizer on current fleet+riders and store snapshot + result |
| `GET /api/plans/:id` | Bearer JWT | Retrieve saved plan by ID |
| `DELETE /api/plans/:id` | Bearer JWT | Delete saved plan |
| `POST /api/plans/:id/insights` | Bearer JWT | Generate & persist Gemini JSON insights + rider alerts |
| `POST /api/plans/:id/whatif` | Bearer JWT | Non-destructive scenario re-optimization + metric delta + AI narrative |
| `POST /api/plans/:id/chat` | Bearer JWT | Grounded Q&A over plan data with conversation history |

---

## AI Integration Architecture

- **Server-Side Isolation:** The Gemini REST API (`generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`) is invoked exclusively from `backend/src/services/gemini.js` with a 12-second `AbortController` timeout and `x-goog-api-key` header. The key is never transmitted to the frontend or printed in logs.
- **Privacy Sanitization (`sanitizePlanForAI`):** Before any prompt leaves the backend, street addresses, last names, and GPS coordinates are stripped. Gemini only receives first names, stop ETAs, ride durations, route names, conditions, and aggregate summary metrics.
- **Prompt Injection & Hallucination Guardrails:** System instructions require Gemini to treat rider/destination/route names strictly as passive JSON data and never invent numbers outside the supplied plan.
- **Structured Validation & Fallbacks:** Insights use `responseMimeType: "application/json"` and are parsed through a strict Zod schema (`headline`, `risk_summary`, `recommendations`, `rider_messages`, `efficiency_notes`). Every AI method catches network/schema failures and falls back to a deterministic rule-based generator, returning `source: "gemini" | "fallback"`.

---

## Deployment Guide

### Backend on Render
1. Push this repository to GitHub.
2. Create a **New Web Service** on Render (or import `render.yaml`), pointing Root Directory to `backend`.
3. Set Build Command: `npm install` and Start Command: `npm start`.
4. Add environment variables (`DATABASE_URL` from Supabase, generated `JWT_SECRET`, `CORS_ORIGINS=https://your-app.vercel.app`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`).
5. Run `npm run db:init` once against your Supabase `DATABASE_URL` (or paste `backend/sql/schema.sql` into the Supabase SQL Editor).
6. Verify `https://<your-render-service>.onrender.com/api/health`.

### Frontend on Vercel
1. Create a **New Project** on Vercel pointing Root Directory to `frontend`.
2. Framework Preset: `Vite` (Build Command: `npm run build`, Output Directory: `dist`).
3. Set `VITE_API_URL=https://<your-render-service>.onrender.com/api`.
4. Deploy. `frontend/vercel.json` and `frontend/public/_redirects` ensure deep links (e.g. `/plans/:id`) rewrite cleanly to `/index.html`.
5. Update `CORS_ORIGINS` on Render to include your live Vercel URL.

---

## Honest Assumptions & Limitations

1. **Illustrative Congestion Data:** The 24-hour congestion multiplier curve in `predictor.js` uses static illustrative urban commute weights (peaking around `08:00` and `18:00`) rather than a live traffic telemetry feed.
2. **Straight-Line Distance Approximation:** Travel distances inside the backend optimizer are computed from Haversine great-circle distances multiplied by a fixed circuity factor (`1.35`) at `32 km/h` base speed with `1.5 min` per-stop dwell — not turn-by-turn road matrices (though the frontend map draws road polylines using the public OSRM demo server with dashed fallback).
3. **Naive Baseline:** Savings metrics compare the optimized routes against a **"sign-up-order roster"** baseline (filling vehicles sequentially in raw input order and visiting stops in that order). Real human dispatchers using spreadsheets may manually group nearby riders better than pure sign-up order, so reported savings represent gains over an unoptimized chronological list.
4. **Public Geocoding & Routing Rate Limits:** Frontend place search uses public OpenStreetMap Nominatim and route geometry uses the public OSRM server, both of which are rate-limited for heavy production traffic and gracefully degrade when unavailable.
>>>>>>> 9ebe26c (<Your_commit_message>)
