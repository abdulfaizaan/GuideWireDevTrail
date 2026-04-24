<p align="center">
  <img src="https://img.shields.io/badge/GigShield-AI%20Parametric%20Insurance-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyTDMgN3Y2YzAgNS41IDMuOSAxMC43NCA5IDEyIDUuMS0xLjI2IDktNi41IDktMTJWN2wtOS01eiIvPjwvc3ZnPg==&logoColor=white" alt="GigShield Badge"/>
</p>

<h1 align="center">🛡️ GigShield — AI-Powered Parametric Insurance for Gig Workers</h1>

<p align="center">
  <em>A next-generation fintech platform providing automated, weather-triggered insurance payouts for gig economy workers, powered by XGBoost ML fraud detection and dynamic premium algorithms.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js%2016-000?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/Backend-Express%205-000?style=flat-square&logo=express" />
  <img src="https://img.shields.io/badge/AI%20Service-FastAPI-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/ML-XGBoost%20%2B%20IsolationForest-FF6F00?style=flat-square" />
  <img src="https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb" />
  <img src="https://img.shields.io/badge/Payments-Razorpay-0C2451?style=flat-square" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Python-3.10-3776AB?style=flat-square&logo=python" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Feature Breakdown](#-feature-breakdown)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [ML Models & AI Pipeline](#-ml-models--ai-pipeline)
- [Dynamic Premium Algorithm (DPA)](#-dynamic-premium-algorithm-dpa)
- [Strengths](#-strengths)
- [Weaknesses & Known Issues](#-weaknesses--known-issues)
- [Roadmap](#-roadmap)

---

## 🎯 Overview

**GigShield** is an AI-powered parametric insurance platform designed specifically for gig economy workers (delivery riders, drivers, etc.). Unlike traditional insurance that requires lengthy claims processes, GigShield uses **parametric triggers** — real-world events like heavy rain, extreme heat, poor air quality, platform outages, and civil disruptions — to automatically process and disburse payouts.

### How It Works

1. **Worker registers** → identity verification, platform linkage, geolocation-based risk assessment
2. **AI calculates risk** → XGBoost model determines risk score and suggests insurance plans
3. **Worker pays premium** → via Razorpay integration, dynamic pricing adjusts weekly
4. **Trigger event occurs** → (rain, heat, AQI spike, outage, bandh)
5. **ML fraud detection** → XGBoost classifier + Isolation Forest anomaly detection evaluates the claim
6. **Auto-payout or rejection** → with explainable AI reasoning for every decision

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│         Next.js 16 + React 19 + Framer Motion + TailwindCSS    │
└────────────────────────┬──────────────────┬─────────────────────┘
                         │ REST API         │ REST API
                         ▼                  ▼
┌──────────────────────────────┐  ┌─────────────────────────────┐
│     BACKEND (Express 5)      │  │    AI SERVICE (FastAPI)      │
│   ─────────────────────────  │  │   ─────────────────────────  │
│   • Claims CRUD              │  │   • XGBoost Premium Model    │
│   • Payment (Razorpay)       │  │   • XGBoost Fraud Classifier │
│   • Policy API               │  │   • Isolation Forest Anomaly │
│   • ML Service Proxy         │  │   • Explainable AI (XAI)     │
│   • Rate Limiting            │  │                              │
│   • In-memory fallback       │  │   Python 3.10 + NumPy        │
│                              │  │   scikit-learn + XGBoost     │
│   Port: 3001                 │  │   Port: 8000                 │
└──────────────┬───────────────┘  └─────────────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │    MongoDB Atlas     │
    │  (or local fallback) │
    │  • Claims collection │
    │  • Payouts collection│
    └─────────────────────┘
```

### Services

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript | `3000` | User-facing SPA with glassmorphism UI |
| **Backend** | Express 5, TypeScript, Mongoose | `3001` | REST API, payments, data persistence |
| **AI Service** | FastAPI, XGBoost, scikit-learn | `8000` | ML inference for pricing and fraud detection |

---

## 🧰 Tech Stack

### Frontend
| Technology | Version | Usage |
|------------|---------|-------|
| Next.js | 16.2.2 | App Router, SSR/CSR framework |
| React | 19.2.4 | UI component library |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 4.x | Utility-first CSS framework |
| Framer Motion | 12.38.x | Animations & transitions |
| Axios | 1.14.x | HTTP client |
| Lucide React | 1.7.x | Icon library |
| Three.js | 0.183.x | 3D graphics (imported, not yet utilized) |

### Backend
| Technology | Version | Usage |
|------------|---------|-------|
| Express | 5.2.1 | HTTP server framework |
| TypeScript | 6.0.2 | Type safety |
| Mongoose | 9.4.1 | MongoDB ODM |
| Razorpay SDK | 2.9.6 | Payment processing |
| express-rate-limit | 8.3.2 | API rate limiting |
| dotenv | 17.4.0 | Environment configuration |

### AI Service
| Technology | Version | Usage |
|------------|---------|-------|
| FastAPI | 0.111.0 | High-performance API framework |
| XGBoost | 2.0.3 | Gradient boosted tree models |
| scikit-learn | 1.4.2 | Isolation Forest anomaly detection |
| NumPy | 1.26.4 | Numerical computing |
| Pandas | 2.1.4 | Data manipulation |
| Pydantic | 2.7.1 | Data validation |
| Uvicorn | 0.29.0 | ASGI server |

### Infrastructure
| Technology | Usage |
|------------|-------|
| MongoDB | Primary database (with in-memory fallback) |
| Razorpay | Payment gateway (test mode) |
| Google Maps Embed | Geolocation visualization |
| Google Fonts (Inter) | Typography |

---

## 🚀 Feature Breakdown

### 1. Landing Page (`/`)
- Premium dark-mode glassmorphism design
- Animated hero section with gradient text
- Feature cards (Instant Payouts, AI Integration, Complete Coverage)
- Navigation to Register, Dashboard, and Admin Portal
- Framer Motion entrance animations

### 2. Registration Flow (`/register`) — 5-Step Wizard
| Step | Name | Features |
|------|------|----------|
| 1 | **Identity Verification** | Phone number input (10-digit validation), OTP generation & verification (4-digit, simulated) |
| 2 | **Regulatory Compliance** | Aadhaar number input (12-digit validation) |
| 3 | **Partner Integration** | Platform selection (Swiggy / Zomato), Gig Worker ID input |
| 4 | **Geographical Data** | Pincode input, Google Maps embed, location auto-detect |
| 5 | **Profile Assessment** | AI risk score calculation (animated SVG ring), weighted multi-factor breakdown (Zone 30%, Weather 25%, AQI 15%, Platform 20%, Activity 10%), plan recommendation (Basic/Standard/Premium), **Razorpay real payment integration** |

### 3. Dashboard (`/dashboard`)
- **Coverage Overview** — plan details, disbursed amount, event count
- **Dynamic Premium Widget** — DPA-powered, bar chart history, flexibility badge
- **XGBoost Risk Monitor** — live fluctuating risk score with 7-day forecast visualization
- **Parametric Triggers** — 5 interactive trigger buttons (Rain, Heat, AQI, Outage, Bandh)
- **Real-time Execution Pipeline** — animated 4-step claim processing timeline
- **Resolutions List** — recent claims with fraud index, status badges

### 4. Policy Management (`/policy`)
- **Active Policy Card** — plan tier, coverage ceiling, effective premium, cycle expiration bar
- **Pricing Intelligence Panel** — XGBoost pricing factor breakdown with animated progress bars
- **Covered Events Matrix** — all 5 trigger types with adjusted payout amounts
- **Dynamic Premium Adjustment (DPA) Engine**:
  - Contribution history chart (12-week view, color-coded bars)
  - Interactive slider (₹20 – ₹300 range)
  - Live preview grid (effective premium, coverage, flex score, payout factor)
  - Reliability score progress bar
  - Warning system (info/warning/success alerts)
  - Projected trigger payouts at current contribution
  - **Razorpay payment integration** for locking in weekly contributions
  - Educational explainer section

### 5. Claims Ledger (`/claims`)
- **Stats Dashboard** — claim volume, total liquidity deployed, AI audit ratio
- **Historical Resolutions** — expandable claim cards with:
  - XAI explanation (reason for approval/rejection)
  - Execution pathway timeline
  - Contract data display (policy hash, oracle feed status)
- Backend-synced with fallback to local data
- Loading state with animated spinner

### 6. Admin Portal (`/admin`)
- **Login Gate** — email/password authentication (localStorage-based)
  - Credentials: `admin@gigshield.com` / `admin123`
- **Stats Grid** — active policies (24,892), loss ratio, automated payouts, fraud intercepted
- **Live Claims & ML Adjudication Feed** — real-time polling (5s interval), XAI explanations
- **Prophet Model Forecast** — 7-day claim volume bar chart with liquidity threshold
- **Zone Disruption Heatmap** — animated radial gradient visualization with ping indicators
- **Session Summary** — approval rate, approved/rejected counts, progress bar

### 7. Dynamic Premium Algorithm (DPA) — `lib/dpa.ts`
A sophisticated client-side pricing engine:
- **Weighted Moving Average** — exponential decay (λ = 0.75) gives recent weeks higher influence
- **Flexibility Scoring** — coefficient of variation + significant drop detection
  - Stable (CV < 0.15, ≤1 drops) → 1.0× payout multiplier
  - Fluctuating (CV < 0.30, ≤3 drops) → 0.92× payout multiplier
  - Risky (otherwise) → 0.82× payout multiplier
- **Coverage Scaling** — 30%–150% of base coverage, proportional to effective premium
- **Payout Calculation** — `basePayout × premiumRatio × riskFactor × consistencyFactor`
- **Warning System** — contextual alerts for contribution changes

### 8. DPA Persistence — `lib/dpa-store.ts`
- localStorage-based history (max 52 weeks)
- Seeded history generation with realistic variation
- ISO week calculation
- Idempotent weekly contribution updates

---

## 📁 Project Structure

```
GigShield/
├── frontend/                         # Next.js 16 application
│   ├── app/
│   │   ├── page.tsx                  # Landing page (3.9 KB)
│   │   ├── layout.tsx                # Root layout with Razorpay script
│   │   ├── globals.css               # Design system (glassmorphism, buttons, inputs)
│   │   ├── register/page.tsx         # 5-step registration wizard (27.7 KB)
│   │   ├── dashboard/page.tsx        # Main user dashboard (20.8 KB)
│   │   ├── policy/page.tsx           # Policy management + DPA engine (38.1 KB)
│   │   ├── claims/page.tsx           # Claims ledger (12.6 KB)
│   │   ├── admin/page.tsx            # Insurer admin portal (19.2 KB)
│   │   └── lib/
│   │       ├── dpa.ts                # Dynamic Premium Algorithm (6.6 KB)
│   │       └── dpa-store.ts          # DPA localStorage persistence (2.5 KB)
│   ├── .env.local                    # Frontend env (API URLs, Razorpay key)
│   ├── next.config.ts                # Next.js + Turbopack config
│   ├── package.json                  # Dependencies
│   └── tsconfig.json                 # TypeScript config
│
├── backend/                          # Express 5 API server
│   ├── src/
│   │   └── index.ts                  # Single-file server (6.3 KB)
│   ├── .env                          # Backend env (ports, DB, secrets)
│   ├── package.json                  # Dependencies
│   └── tsconfig.json                 # TypeScript config
│
├── ai-service/                       # FastAPI ML service
│   ├── main.py                       # ML models + API endpoints (5.5 KB)
│   ├── requirements.txt              # Python dependencies
│   ├── Procfile                      # Heroku deployment config
│   └── runtime.txt                   # Python version (3.10.13)
│
├── .gitignore
├── package.json                      # Root-level dev dependencies
└── README.md                         # This file
```

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **Python** 3.10+
- **MongoDB** (local or Atlas) — *optional, app falls back to in-memory storage*

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/GigShield.git
cd GigShield
```

### 2. Start the AI Service (Python)

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the Backend (Node.js)

```bash
cd backend
npm install
npm run dev
```

### 4. Start the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### 5. Open the App

Navigate to **http://localhost:3000** in your browser.

---

## 🔐 Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API base URL |
| `NEXT_PUBLIC_AI_SERVICE_URL` | `http://localhost:8000` | AI service base URL |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_*` | Razorpay publishable key (test mode) |

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `RAZORPAY_KEY_ID` | `rzp_test_*` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | `lhXc...` | Razorpay secret key |
| `MONGO_URI` | `mongodb://localhost:27017/gigshield` | MongoDB connection string |
| `ML_SERVICE_URL` | `http://localhost:8000` | AI service URL |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins |

---

## 📡 API Reference

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health check (includes Mongo + ML service status) |

### Claims

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/claims` | Get recent claims (sorted by date, limit 20) |
| `POST` | `/api/claims/submit` | Submit a new claim (triggers ML fraud detection) |

### Payments (Razorpay)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/payment/order` | Create a Razorpay order |
| `POST` | `/api/payment/verify` | Verify payment signature |

### Policy

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/policy/:userId` | Get policy details for a user (currently returns static data) |

### AI Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | AI service health check |
| `POST` | `/predict` | Premium prediction (XGBoost regression) |
| `POST` | `/api/ml/predict-fraud` | Fraud detection (XGBoost + Isolation Forest) |

---

## 🤖 ML Models & AI Pipeline

### 1. Premium Prediction Model

**Type:** XGBoost Regressor  
**Training Data:** 500 synthetic samples  
**Features:**
| Feature | Range | Weight |
|---------|-------|--------|
| Zone Risk | 0.1–0.9 | 50% |
| Seasonal Risk | 0.1–0.8 | 40% |
| Risk Score | 20–90 | 30% |
| Weeks Active | 1–52 | 30% |
| Base Premium | Fixed at 49 | — |

**Output:** Multiplier (1.0–2.5×) applied to base premium.

### 2. Fraud Detection Pipeline (Dual-Model)

#### a) XGBoost Classifier
- **Training Data:** 1,000 synthetic samples
- **Fraud Logic:** `weather_diff > 30 OR gps_speed > 80 OR (trust_score < 40 AND blacklisted_zone)`
- **Threshold:** Fraud probability > 0.75 → flagged

#### b) Isolation Forest (Anomaly Detection)
- **Estimators:** 100
- **Contamination:** 10%
- **Purpose:** Catches outlier patterns that the classifier might miss

#### c) Explainable AI (XAI)
Rule-based explanations generated for every decision:
- Weather discrepancy analysis
- GPS speed spoofing detection
- Behavioral anomaly flags
- Trust score evaluation

---

## 📊 Dynamic Premium Algorithm (DPA)

The DPA is a client-side actuarial engine that creates a fair, history-aware pricing model:

```
Effective Premium = Σ(contribution_i × λ^(n-1-i)) / Σ(λ^(n-1-i))
                    where λ = 0.75 (decay factor)

Coverage = baseCoverage × clamp(effectivePremium / basePremium, 0.30, 1.50)

Payout = basePayout × premiumRatio × riskFactor × consistencyFactor
```

### Key Properties
- **Recency bias** — last week weighs ~4× more than 5 weeks ago
- **Anti-gaming** — sudden spikes before claims don't unlock full payouts
- **Transparency** — every factor is visible to the user in real-time
- **3 Stability Tiers** — Stable (1.0×), Fluctuating (0.92×), Risky (0.82×)

---

## 💪 Strengths

### Design & UX
- ✅ **Premium dark-mode glassmorphism UI** — one of the most polished insurance prototypes, feels like a production SaaS app
- ✅ **Rich animations** — Framer Motion used throughout for smooth transitions, animated timelines, and micro-interactions
- ✅ **Custom design system** — comprehensive `globals.css` with reusable glass cards, buttons, inputs, badges, and triggers
- ✅ **Responsive layout** — works across desktop and mobile breakpoints
- ✅ **Typography** — Inter font from Google Fonts, well-tuned font weights and tracking

### Architecture & Engineering
- ✅ **Full-stack architecture** — clean 3-tier separation (frontend / backend / AI service)
- ✅ **Graceful degradation** — every service has fallback behavior:
  - Backend offline → frontend uses optimistic local data
  - MongoDB offline → in-memory arrays as fallback
  - AI service offline → rule-based fallback logic in backend
- ✅ **Real Razorpay integration** — actual payment gateway with order creation and signature verification, not just a mock
- ✅ **Rate limiting** — `express-rate-limit` protects API from abuse (100 req/15 min)
- ✅ **TypeScript throughout** — both frontend and backend for compile-time safety

### AI & Machine Learning
- ✅ **Dual-model fraud detection** — XGBoost classifier + Isolation Forest anomaly detector provide complementary coverage
- ✅ **Explainable AI** — every claim decision includes human-readable explanations
- ✅ **Dynamic premium pricing** — sophisticated DPA algorithm with exponential decay, consistency factors, and coverage scaling
- ✅ **Live risk monitoring** — fluctuating risk score with visual feedback

### Product & Business Logic
- ✅ **5 parametric triggers** — comprehensive coverage (rain, heat, AQI, outage, bandh)
- ✅ **3 plan tiers** — Basic (₹49/wk, ₹5K coverage), Standard (₹89/wk, ₹10K), Premium (₹149/wk, ₹20K)
- ✅ **Admin portal** — separate insurer view with live claims feed, forecast charts, and session analytics
- ✅ **End-to-end user journey** — complete flow from registration through claims and payouts
- ✅ **Anti-gaming mechanisms** — consistency-based payout multipliers discourage insurance abuse

---

## ⚠️ Weaknesses & Known Issues

### Security 🔴 Critical
| Issue | Impact | Location |
|-------|--------|----------|
| **Hardcoded Razorpay secrets** | API keys and secrets are committed in source code (`.env` and fallback strings) | `backend/src/index.ts:63-64`, `backend/.env` |
| **No real authentication** | Admin login is client-side comparison (`admin@gigshield.com` / `admin123`) stored in localStorage — trivially bypassable | `frontend/app/admin/page.tsx:89` |
| **No JWT/session management** | User state is stored entirely in localStorage with no server-side session validation | Dashboard, policy pages |
| **CORS set to `*`** | AI service allows all origins, backend defaults to `*` if env not set | `ai-service/main.py:13`, `backend/src/index.ts:13` |
| **No input sanitization** | Backend directly uses user-provided data without sanitization | `backend/src/index.ts:115` |

### Data & Backend 🟡 Significant
| Issue | Impact | Location |
|-------|--------|----------|
| **Synthetic ML training data** | Models trained on 500–1000 random samples, not real-world data — will not perform accurately in production | `ai-service/main.py:29-74` |
| **Models train on every cold start** | No serialized model files; ML models retrain from scratch each time the service restarts (adds startup latency) | `ai-service/main.py:51,78` |
| **No user registration persistence** | User data is only stored in browser localStorage — lost on clear/new device | Registration flow |
| **Policy endpoint returns static data** | `/api/policy/:userId` ignores the user ID and always returns the same hardcoded response | `backend/src/index.ts:205-214` |
| **No real weather/AQI data** | Trigger events are simulated — no integration with real weather APIs, CPCB, or partner APIs | Dashboard trigger flow |
| **Single-file backend** | Entire API server is in one 219-line file with no route/model separation | `backend/src/index.ts` |

### Frontend 🟡 Significant
| Issue | Impact | Location |
|-------|--------|----------|
| **Navbar component duplicated 3 times** | Same Navbar component is copy-pasted across dashboard, claims, and policy pages instead of being a shared component | Multiple files |
| **No error boundary** | Unhandled runtime errors will crash the entire React tree | All pages |
| **Three.js imported but unused** | `three` and `@types/three` are in dependencies but not used anywhere — adds ~500KB to the bundle | `frontend/package.json` |
| **OTP verification is simulated** | Any 4-digit OTP is accepted — no actual SMS verification | `frontend/app/register/page.tsx:130-137` |
| **No loading states for payment** | Razorpay modal can fail silently without proper error UX on the policy page | Policy page |
| **Very large page files** | Policy page is 908 lines, Register is 635 lines — should be broken into smaller components | All major pages |
| **Hardcoded dummy data in admin** | `DUMMY_FRAUD_EVENTS` array with 8 hardcoded events is always shown | `frontend/app/admin/page.tsx:56-65` |

### DevOps & Infrastructure 🟠 Moderate
| Issue | Impact |
|-------|--------|
| **No testing** | Zero unit tests, integration tests, or E2E tests across all three services |
| **No CI/CD pipeline** | No GitHub Actions, deployment scripts, or automated quality gates |
| **No Docker configuration** | No Dockerfile or docker-compose for consistent development environments |
| **No API documentation** | No Swagger/OpenAPI spec beyond FastAPI's auto-generated `/docs` |
| **No logging framework** | Only `console.log` statements — no structured logging (Winston, Pino, etc.) |
| **No monitoring/observability** | No health dashboards, error tracking (Sentry), or metrics collection |
| **`strict: false` in backend tsconfig** | TypeScript strict mode disabled, reducing type safety benefits | 

### Code Quality 🟠 Moderate
| Issue | Impact |
|-------|--------|
| **`any` types scattered** | Used for Razorpay handlers and responses — defeats TypeScript's purpose |
| **No shared types package** | Frontend and backend define their own claim/payout interfaces independently |
| **Magic numbers** | Values like `0.75`, `0.82`, `0.92`, `0.15`, `0.30` are hardcoded in the DPA algorithm without named constants |
| **Race condition in admin polling** | `/api/claims` is polled every 5 seconds but has no deduplication logic |
| **Inconsistent status values** | Claims use "Transferred", "Settled", "APPROVED", "REJECTED" — no unified enum |

---

## 🗺️ Roadmap

| Priority | Feature |
|----------|---------|
| 🔴 P0 | Move secrets to secure vault / env manager; remove from source code |
| 🔴 P0 | Implement proper JWT authentication for both user and admin flows |
| 🟡 P1 | Integrate real weather APIs (OpenWeatherMap, IMD) and AQI data (CPCB) |
| 🟡 P1 | Serialize ML models to disk (joblib/pickle) to avoid retraining on startup |
| 🟡 P1 | Add user registration persistence to MongoDB |
| 🟡 P1 | Add comprehensive test suite (Jest + Supertest + Pytest) |
| 🟠 P2 | Refactor frontend — extract shared Navbar, create component library |
| 🟠 P2 | Break backend into routes, controllers, and models |
| 🟠 P2 | Add Docker + docker-compose for one-command setup |
| 🟢 P3 | Add WebSocket for real-time claim feed (replace polling) |
| 🟢 P3 | Implement notification system (email/SMS for claim status updates) |
| 🟢 P3 | Add i18n support for Hindi and regional languages |
| 🟢 P3 | Train ML models on real insurance fraud datasets |
| 🟢 P3 | Remove Three.js dependency if not being used |

---

## 📄 License

This project is currently unlicensed. Please add a license before distributing.

---

<p align="center">
  <strong>Built with 🤖 AI-powered insurance logic and ✨ premium design aesthetics</strong>
  <br/>
  <sub>GigShield — Protecting gig workers when the world won't.</sub>
</p>
