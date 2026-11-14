# ShuttleIQ — Hackathon Submission Package

## Problem Statement
Schools, university campuses, and corporate offices that operate daily morning shuttles still rely heavily on manual spreadsheets. Riders are commonly assigned to vans in sign-up order, pickup stops are unsequenced, and departure times ignore hourly rush-hour congestion, rain, or road incidents. The outcome is predictable: circuitous routes, half-empty or overloaded shuttles, fatigued commuters enduring 60+ minute rides, and frequent late arrivals.

## Solution Description
**ShuttleIQ** gives transport coordinators an end-to-end operational workspace:
1. **Fleet & Spatial Roster Management:** Coordinators manage vehicle capacities (1–60 seats) and place riders using an interactive Leaflet + OpenStreetMap map or Nominatim geocoding search (or load a deterministic 4-vehicle / 30-rider demo dataset in one transaction).
2. **Pure-JS Capacity-Constrained Optimizer:** Sweeps feasible fleet sizes `k`, runs farthest-point seeding and capacity-constrained regret-based clustering with centroid refinement, sequences stops via farthest-start nearest-neighbour + 2-opt, and solves exact departure times via fixed-point iteration so arrivals hit `deadline - buffer`.
3. **Probabilistic Arrival-Risk Predictor:** Models route travel time variance from weather, traffic incidents, and time-of-day congestion to compute lateness probability `P(delay > buffer)`, 80th-percentile delay (`p80`), and recommended extra buffer minutes.
4. **What-If Disruption Simulator:** Non-destructively stress-tests storms, road closures, vehicle breakdowns, and rider absences side-by-side against the saved plan on both metrics and the live route map.
5. **Privacy-Preserving Gemini AI Copilot:** Produces structured JSON dispatch insights, copy-ready rider notifications, What-If narratives, and grounded Q&A — stripping all addresses and coordinates before calling Gemini, with deterministic rule-based fallbacks.

---

## AI Integration Table

| Feature | Endpoint | Gemini Mode | Privacy & Guardrails | Fallback Behavior |
| --- | --- | --- | --- | --- |
| **Dispatch Insights & Rider Alerts** | `POST /api/plans/:id/insights` | `generateJSON` (`application/json`) | Sends only first names, ETAs, ride mins & aggregate metrics; Zod-validated output | Deterministic headline, buffer advice & per-route rider templates (`source: "fallback"`) |
| **What-If Scenario Narrative** | `POST /api/plans/:id/whatif` | `generateText` | Compares sanitized base vs simulated metrics; instructed to cite only supplied JSON | Rule-based delta summary highlighting capacity shortfall & risk shift (`source: "fallback"`) |
| **Ask ShuttleIQ Chat** | `POST /api/plans/:id/chat` | `generateText` (multi-turn `history[]`) | Grounded solely in sanitized plan JSON; rider names treated as passive data | Pattern-matched operational Q&A over route schedules & risk scores (`source: "fallback"`) |

---

## Submission Checklist

- [x] Monorepo structured into `/backend`, `/frontend`, `/docs`
- [x] Idempotent PostgreSQL / Supabase schema (`backend/sql/schema.sql`) + `db:init` script
- [x] Every database query scoped by authenticated `user_id`
- [x] JWT authentication with bcrypt password hashing and uniform login error message
- [x] Pure-JS route optimizer + probabilistic risk predictor with 7 `node:test` unit tests passing
- [x] Server-side Google Gemini REST integration (`x-goog-api-key`, 12s timeout, Zod validation, privacy sanitizer, deterministic fallbacks)
- [x] React 18 + Vite + Tailwind CSS v3 + Leaflet v4 frontend with OSRM road polylines + dashed straight-line fallback
- [x] Vercel SPA configs (`frontend/vercel.json`, `frontend/public/_redirects`) and Render config (`render.yaml`)
- [x] `.env.example` templates committed with `.gitignore` protecting secrets
- [x] Comprehensive `README.md` with honest assumptions & limitations

---

## 4-Minute Demo Video Script

### 0:00 – 0:45 | The Spreadsheet Problem & Sign-In
- **Screen:** ShuttleIQ Split Auth Page (`/auth`).
- **Narration:** "Morning shuttles at schools and offices are still planned in spreadsheets—riders added in sign-up order, unoptimized stops, and fixed departure times that ignore rain or 8 AM traffic. ShuttleIQ fixes this in under a minute."
- **Action:** Sign up as a demo coordinator and land on the empty Dashboard.

### 0:45 – 1:30 | One-Click Demo Fleet & Map Roster
- **Screen:** Dashboard onboarding card -> Fleet & Riders (`/fleet`).
- **Narration:** "Clicking Load Demo Data triggers a single Postgres transaction seeding 4 shuttles (14, 14, 8, and 8 seats) and 30 deterministic riders spread across 6 neighbourhoods. Coordinators can also click directly on the OpenStreetMap canvas or search Nominatim to place custom stops."
- **Action:** Click **Load Demo Data**, briefly open **Fleet & Riders** to show vehicles and map pins.

### 1:30 – 2:30 | Route Optimization & Baseline Comparison
- **Screen:** Starter Plan Detail (`/plans/:id`).
- **Narration:** "Here is our optimized 08:30 morning plan with a 10-minute safety buffer. Our pure-JS optimizer evaluated fleet sizes, clustered riders by regret and capacity, ran 2-opt stop ordering, and back-solved departure times via fixed-point iteration. Compared honestly against a naive sign-up-order roster, ShuttleIQ slashes total fleet distance and cuts average rider commute time, while showing road geometry from OSRM on Leaflet."
- **Action:** Highlight the KPI row, expand Shuttle Alpha's route manifest to show per-stop ETAs, p80 delay, and risk factors.

### 2:30 – 3:20 | What-If Disruption Simulation
- **Screen:** Plan Detail -> **What-If Simulator** tab.
- **Narration:** "What happens if heavy rain hits and our 14-seat Shuttle Alpha breaks down? Let's simulate it without overwriting our saved plan."
- **Action:** Select `Heavy rain`, check `Shuttle Alpha` under Remove Vehicles, click **Run What-If Simulation**. Point out the comparison table, unassigned capacity alert, AI narrative, and click **Show Scenario on Map** to see the routes dynamically update.

### 3:20 – 4:00 | Privacy-Safe Gemini AI Insights & Chat
- **Screen:** Plan Detail -> **AI Insights** and **Ask ShuttleIQ** tabs.
- **Narration:** "Finally, coordinators can generate Gemini AI insights and one-click copyable rider notifications—while our backend strips all rider street addresses and GPS coordinates so only first names, ETAs, and aggregate metrics reach the model—and ask follow-up questions in Ask ShuttleIQ."
- **Action:** Click **Generate AI Insights**, click **Copy message** on a route alert, switch to **Ask ShuttleIQ**, click a suggested question, and wrap up.
