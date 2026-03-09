# GuideWireDevTrail
# 🛵 GigShield — AI-Powered Parametric Income Insurance for Food Delivery Partners

> **Guidewire DEVTrails 2026 | University Hackathon**
> Persona: Food Delivery Partners (Zomato / Swiggy)
> Platform: Web + Mobile (Progressive Web App)

---

## 📌 Problem Statement

India's food delivery partners (Zomato, Swiggy) are the last-mile backbone of urban food commerce. A delivery partner in a metro city typically earns ₹15,000–₹25,000/month — but **has zero protection** when external disruptions prevent them from working.

**Key pain points:**
- Heavy rain, floods, or extreme heat can wipe out 2–4 working days per month
- Sudden curfews or local bandhs shut down entire delivery zones without notice
- Severe air pollution (AQI > 300) forces gig workers off the road in cities like Delhi and Mumbai
- **No existing insurance product covers this income gap** — health and vehicle insurance don't apply here

> GigShield insures the **income lost** during verified external disruptions — not health, life, accidents, or vehicle damage.

---

## 👤 Persona: The Food Delivery Partner

**Name:** Ramesh (representative persona)
**Platform:** Zomato / Swiggy
**City:** Tier-1 metro (Delhi, Mumbai, Bengaluru, Hyderabad)
**Typical earnings:** ₹600–₹900/day (6–8 hours active)
**Weekly earnings:** ₹3,500–₹5,500
**Pain:** Loses 20–30% of monthly income during disruption events with no recourse

### Persona-Based Scenarios

| Scenario | Disruption | Income Impact | GigShield Response |
|---|---|---|---|
| Monsoon flooding in Mumbai | Rainfall > 50mm in 3hrs | Full day lost (~₹700) | Auto-trigger + payout within 2 hrs |
| Delhi smog emergency | AQI > 350 (Severe+) | 4–6 hrs lost (~₹450) | Partial day payout triggered |
| Local bandh in Bengaluru | Government-declared curfew | Full day lost (~₹700) | Social disruption trigger activated |
| Cyclone warning in Chennai | IMD Red Alert issued | 2-day loss (~₹1,400) | Multi-day parametric payout |
| Heatwave (temp > 45°C) | IMD extreme heat alert | Reduced hours (~₹350) | Partial payout for heat threshold breach |

---

## 🔄 Application Workflow

```
[Worker Onboarding] ──► [Risk Profiling & Premium Calculation] ──► [Weekly Policy Purchase]
        │                                                                      │
        ▼                                                                      ▼
[Active Coverage Week]  ◄──────────────────────────────────  [Real-Time Trigger Monitoring]
        │                                                                      │
        ▼                                                                      │
[Disruption Detected] ◄────────────────────────────────────────────────────────
        │
        ▼
[Fraud Validation Layer] ──► [PASS] ──► [Auto Claim Initiation] ──► [Instant Payout (UPI/Wallet)]
        │
        ▼ [FAIL]
[Flag for Review + Worker Notified]
```

### Detailed Flow

**1. Onboarding (< 3 minutes)**
- Worker signs up via mobile PWA or web
- Links their Zomato/Swiggy Partner ID (or manually enters details)
- Provides city, home zone/pincode, and average weekly earnings
- Aadhaar-based eKYC (or manual ID upload for MVP)
- AI assigns a Risk Profile Score (RPS)

**2. Weekly Policy Purchase**
- Worker selects coverage tier (Silver / Gold / Platinum) based on their weekly income
- Premium deducted weekly — aligns with gig payout cycles
- Policy activates from Monday 00:00 to Sunday 23:59

**3. Real-Time Trigger Monitoring**
- System continuously polls weather, pollution, and civic alert APIs for the worker's active zone
- When a parametric threshold is crossed (see triggers below), the system automatically initiates a claim — **no manual filing required**

**4. Fraud Detection**
- Cross-validates disruption claims against GPS activity data, platform order logs, and third-party weather data
- Anomaly scoring flags suspicious patterns (e.g., claiming during a "rain event" but GPS shows indoor movement all day)

**5. Payout**
- Verified claims are paid within 2–4 hours via UPI / Paytm / PhonePe (mock in MVP)
- Worker receives an in-app notification with payout breakdown

---

## 💰 Weekly Premium Model

### Design Philosophy
Food delivery workers are paid weekly (or bi-weekly) by platforms. A weekly insurance cycle mirrors this rhythm, making premiums feel like a natural deduction rather than a large annual commitment.

### Coverage Tiers

| Tier | Weekly Premium | Max Weekly Payout | Coverage Hours/Day | Best For |
|---|---|---|---|---|
| 🥈 Silver | ₹29/week | ₹1,400 | Up to 4 hrs/day | Part-time partners (<30 hrs/week) |
| 🥇 Gold | ₹49/week | ₹2,800 | Up to 8 hrs/day | Full-time partners (30–50 hrs/week) |
| 💎 Platinum | ₹79/week | ₹4,500 | Full day + surge protection | Top earners / high-risk zones |

> **Effective cost:** ₹4–11/day — less than a cup of chai ☕

### Dynamic Premium Adjustment (AI-Powered)
The base premium is adjusted each week using the worker's **Risk Profile Score (RPS)**, which factors in:
- Historical disruption frequency in their operating zone (last 90 days)
- Seasonal risk calendar (monsoon months = higher base)
- Worker's claims history and anomaly score
- City-level pollution and weather forecast for the upcoming week

**Example:** A Swiggy partner in Andheri West (Mumbai) during July monsoon season may see their Gold tier adjusted from ₹49 → ₹61/week due to elevated flood risk in their zone. Conversely, a partner in a historically low-disruption zone during winter may see a ₹5–8 discount.

---

## ⚡ Parametric Triggers

All triggers are **objective, third-party-verified, and auto-executed** — no human adjuster involved.

| # | Trigger Name | Data Source | Threshold | Payout Type |
|---|---|---|---|---|
| T1 | **Heavy Rain / Flood** | IMD API, OpenWeatherMap | Rainfall ≥ 35mm in 3 hrs OR IMD Orange/Red Alert | Full/partial day payout |
| T2 | **Extreme Heat** | IMD Heat Wave Alert | Temperature ≥ 43°C + IMD Heat Wave declaration | Partial day (4 hrs) |
| T3 | **Severe Air Pollution** | CPCB AQI API | AQI ≥ 301 (Severe) for ≥ 4 hrs in worker's zone | Partial day payout |
| T4 | **Civic Disruption / Bandh** | Govt. alert feeds, news NLP | Official curfew / bandh notice in worker's pincode zone | Full day payout |
| T5 | **Platform Outage** | Zomato/Swiggy status mock API | App downtime ≥ 2 hrs during peak hours (12–2pm, 7–9pm) | Proportional payout |

> Payout amount = (Worker's declared daily average earnings) × (disruption hours / standard working hours) × tier multiplier

---

## 🤖 AI/ML Integration Plan

### 1. Dynamic Premium Engine
- **Model:** Gradient Boosted Trees (XGBoost / LightGBM)
- **Inputs:** Zone-level historical weather data, seasonal patterns, worker profile, claims history, city-level risk index
- **Output:** Weekly premium multiplier per worker
- **Training data:** IMD historical rainfall/temperature (public), CPCB AQI archives (public), synthetic worker data for MVP

### 2. Risk Profile Scoring (RPS)
- **Model:** Logistic Regression + rule-based scoring
- **Inputs:** Operating zone flood/drought history, typical working hours, tenure on platform, zone congestion index
- **Output:** RPS score (0–100) → maps to risk band (Low / Medium / High / Very High)

### 3. Fraud Detection Engine
- **Model:** Isolation Forest (anomaly detection) + rule-based flags
- **Key signals:**
  - GPS location mismatch (claiming disruption but phone shows stationary indoor location)
  - Frequency anomaly (worker filing claims far more often than zone peers)
  - Weather data vs. claim timing mismatch
  - Duplicate claim attempts across time windows
  - Platform order data cross-check (active orders during "disruption" period)
- **Output:** Fraud Risk Score (0–1); scores > 0.75 flagged for manual review

### 4. Disruption NLP Classifier (for Civic Events)
- **Model:** Fine-tuned BERT / DistilBERT (or rule-based regex for MVP)
- **Input:** News headlines, Twitter/X feeds, government press release RSS feeds
- **Output:** Binary classification — civic disruption Yes/No + affected pincodes

---

## 🛠️ Tech Stack

### Frontend
| Layer | Technology | Rationale |
|---|---|---|
| Web | React.js + TailwindCSS | Fast, component-based, responsive |
| Mobile | React Native / PWA | Single codebase for iOS + Android; PWA for low-end devices |
| State Management | Redux Toolkit | Predictable state for policy/claims flow |
| Maps | Google Maps API / Leaflet.js | Zone visualization, GPS validation |

### Backend
| Layer | Technology | Rationale |
|---|---|---|
| API Server | Node.js + Express (or FastAPI) | Fast REST APIs; Python for ML model serving |
| Database | PostgreSQL | Structured policy/claims data |
| Cache | Redis | Real-time trigger state, session management |
| Auth | Firebase Auth / JWT | Simple OTP-based login for mobile workers |

### AI/ML
| Component | Technology |
|---|---|
| Premium Engine | Python + Scikit-learn / XGBoost |
| Fraud Detection | Python + Isolation Forest (Scikit-learn) |
| NLP Classifier | Hugging Face Transformers (DistilBERT) or rule-based for MVP |
| Model Serving | FastAPI microservice |

### Integrations (APIs)
| Integration | Source | Mode |
|---|---|---|
| Weather | OpenWeatherMap API (free tier) + IMD public data | Live |
| Air Quality | CPCB AQI API / OpenAQ | Live |
| Platform Activity | Zomato/Swiggy Partner API | Simulated/Mock |
| Payment | Razorpay Test Mode / UPI Simulator | Mock/Sandbox |
| Civic Alerts | RSS feeds + custom scraper | Simulated for MVP |

### Infrastructure
- **Hosting:** Vercel (frontend) + Railway / Render (backend) — free tiers for hackathon
- **CI/CD:** GitHub Actions
- **Containerization:** Docker (for ML service)

---

## 📅 Development Plan (6-Week Breakdown)

### Phase 1 — Weeks 1–2 (Mar 4–20): Ideation & Foundation ✅
- [x] Finalize persona, disruption triggers, and pricing model
- [x] Define system architecture
- [ ] Set up GitHub repo, project scaffolding
- [ ] Build basic onboarding UI (web + mobile)
- [ ] Integrate OpenWeatherMap API (live weather for worker's zone)
- [ ] Draft premium calculation logic (rule-based first, ML later)

### Phase 2 — Weeks 3–4 (Mar 21–Apr 4): Automation & Protection
- [ ] Complete registration + KYC flow
- [ ] Build policy management module (create, view, renew weekly policy)
- [ ] Implement dynamic premium calculation (ML model integration)
- [ ] Build 3–5 automated parametric triggers
- [ ] Basic fraud detection (rule-based anomaly flags)
- [ ] Claims management UI — zero-touch auto-claim flow
- [ ] Mock payout notification system

### Phase 3 — Weeks 5–6 (Apr 5–17): Scale & Optimise
- [ ] Advanced fraud detection (Isolation Forest + GPS validation)
- [ ] Instant payout integration (Razorpay test mode)
- [ ] Worker dashboard (earnings protected, active coverage, claims history)
- [ ] Admin/Insurer dashboard (loss ratios, predictive analytics)
- [ ] Disruption simulation tool (trigger fake rainstorm for demo)
- [ ] Performance optimization + UI polish
- [ ] Final 5-min demo video + pitch deck

---

## 🏗️ Repository Structure

```
gigshield/
├── frontend/               # React.js Web App
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Onboarding, Dashboard, Policy, Claims
│   │   └── store/          # Redux state
├── mobile/                 # React Native / PWA
├── backend/
│   ├── api/                # Express/FastAPI routes
│   ├── services/           # Trigger engine, payout, fraud
│   └── db/                 # PostgreSQL schemas
├── ml/
│   ├── premium_engine/     # XGBoost premium model
│   ├── fraud_detection/    # Isolation Forest
│   └── nlp_classifier/     # Civic disruption NLP
├── mock-apis/              # Simulated platform/payment APIs
├── data/                   # Sample datasets (weather, AQI)
└── README.md
```

---

## 🎯 Why GigShield Will Win

1. **Zero-touch experience** — the worker never needs to file a claim. The system detects and pays automatically.
2. **Hyper-local precision** — risk and triggers are scoped to the worker's actual operating pincode, not a city-wide average.
3. **Weekly micro-premiums** — ₹29–79/week is psychologically accessible and financially viable for gig workers.
4. **AI that actually matters** — dynamic pricing adjusts weekly based on real forecast data, not static actuarial tables.
5. **Trust through transparency** — every payout comes with a clear breakdown of what triggered it and how the amount was calculated.

---

## 📎 Submission Links
- **GitHub Repository:** _[to be added]_
- **Phase 1 Demo Video:** _[to be added — 2 min]_

---

> *GigShield — Because every delivery deserves a safety net.*
