# 🛵 GigShield — Income Protection for Food Delivery Partners

> **Guidewire DEVTrails 2026**
> Persona: Food Delivery Partners (Zomato / Swiggy)
> Platform: Web + Mobile (Progressive Web App)

---

## The Person Behind Every Doorbell Ring

Meet **Ramesh**.

He's 27, lives in a rented room in Govandi, Mumbai, and has been delivering food on Swiggy for two years. On a good day — clear skies, lots of orders, no traffic — he makes around ₹750. That's enough to cover rent, send some money home to his family in UP, and maybe save a little.

But then July arrives.

The skies open up. Water fills the streets. His phone buzzes with cancelled orders. He sits under a chai stall watching the rain, doing the math in his head. Every hour he's not riding is money he doesn't have. By the end of the week, he's down ₹3,200 — nearly 60% of what he was counting on.

There's no insurance that covers this. No form to fill. No one to call. **He just absorbs it.**

That's the problem GigShield exists to solve.

---

## What We're Building

GigShield is a **parametric income insurance platform** built specifically for food delivery partners on Zomato and Swiggy. When a verified external disruption — a flood, a heatwave, a declared bandh — prevents Ramesh from working, **GigShield automatically detects it and pays him within hours.** No claims to file. No proof to submit. No adjuster to convince.

He opens the app and sees: *"Mumbai flood alert detected in your zone. ₹680 has been credited to your UPI."*

That's it. That's the whole experience.

> We insure the **income lost** during disruptions — not his bike, not his health, not his life. Just the wages stolen by events he had no control over.

---

## The Disruptions We Cover

We focused on what actually stops a Zomato/Swiggy partner from working in an Indian metro city. Here are the five triggers we're building around:

| # | What Happens | How We Know | What Ramesh Gets |
|---|---|---|---|
| 🌧️ Heavy Rain / Flood | Rainfall ≥ 35mm in 3 hrs, or IMD Orange/Red Alert | IMD + OpenWeatherMap API | Full or partial day payout |
| 🌡️ Extreme Heat | Temp ≥ 43°C + official IMD Heat Wave declaration | IMD Heat Wave alerts | Partial day payout (4 hrs) |
| 😷 Severe Air Pollution | AQI ≥ 301 (Severe) for 4+ hrs in his zone | CPCB AQI API | Partial day payout |
| 🚫 Bandh / Curfew | Official government curfew or civic strike in his pincode | Govt. feeds + news NLP | Full day payout |
| 📵 Platform Outage | Zomato/Swiggy app down 2+ hrs during peak meal times | Platform status mock API | Proportional payout |

These aren't hypotheticals. Mumbai floods every monsoon. Delhi chokes every winter. Bandhs happen without warning. **These are real weeks out of real paychecks.**

---

## How It Works — The Full Journey

### Step 1: Onboarding (under 3 minutes)
Ramesh downloads the app or opens it in his browser. He enters his Swiggy Partner ID, his city, the pincodes he usually works in, and his average weekly earnings. A quick Aadhaar eKYC (or manual ID upload for the MVP) and he's in. The whole thing takes less time than waiting for a traffic light.

### Step 2: Picking a Plan
He sees three options, priced weekly — because like him, GigShield thinks in weeks, not years.

| Plan | Weekly Cost | Max Payout/Week | Who It's For |
|---|---|---|---|
| 🥈 Silver | ₹29 | ₹1,400 | Part-timers, students doing weekend deliveries |
| 🥇 Gold | ₹49 | ₹2,800 | Full-time partners, 6 days a week |
| 💎 Platinum | ₹79 | ₹4,500 | Top earners, high-risk monsoon zones |

₹49 a week is ₹7 a day. Less than a cutting chai. For full income protection against the Indian sky.

His premium isn't static either. Our AI looks at his zone's historical flood/pollution data, the coming week's weather forecast, and his own claims history — and adjusts his premium accordingly. If he works in a zone that rarely floods, he pays less. If monsoon forecasts look bad in his area next week, the system flags it and may offer him additional coverage proactively.

### Step 3: The Week Begins
His policy runs Monday to Sunday. He works normally. The system quietly watches — polling weather stations, AQI monitors, and civic alert feeds for his zone every 15 minutes.

### Step 4: Something Goes Wrong
A Red Alert drops for his area. Rainfall crosses the threshold. The system doesn't wait for Ramesh to notice or react.

Within minutes:
- The trigger is confirmed against a second data source
- His GPS activity (or lack of it) is cross-checked
- His platform order data is validated
- The fraud engine clears the claim
- A payout is initiated to his UPI

He gets a notification: *"Heavy rain detected in Andheri East. We've initiated a ₹680 payout to your account. Stay safe."*

### Step 5: The Dashboard
Ramesh can open his app any time and see:
- How much income he's been protected this month
- His active policy and what it covers
- His claims history with payout breakdowns
- A simple risk calendar showing disruption-prone days ahead

---

## How We Catch Fraud (Without Punishing Honest Workers)

Fraud detection in parametric insurance is tricky — you can't make honest workers feel like suspects. Our approach is quiet and data-driven.

We cross-reference three things before every payout:

1. **Did the disruption actually happen?** Weather/AQI data from two independent sources must agree.
2. **Was Ramesh in the affected zone?** GPS pings (with consent) confirm he was operating in the declared disruption area.
3. **Does his behaviour match?** If there's an active rain alert but his order history shows 12 completed deliveries that afternoon, something doesn't add up.

We use an **Isolation Forest anomaly model** that learns the difference between a real disruption pattern and an outlier. Workers who score above a fraud threshold aren't auto-rejected — their claims are flagged for a fast human review. No one gets punished without a second look.

---

## 🛡️ Adversarial Defense & Anti-Spoofing Strategy

> **Threat Context:** A coordinated syndicate of 500+ delivery workers organized via Telegram
> is using GPS-spoofing apps to fake their location inside active weather alert zones — triggering
> mass false parametric payouts while physically sitting at home.
>
> GigShield's response: Simple GPS verification was never our only defense. Here's why this
> attack fails against our architecture.

### 1. The Differentiation — Real Worker vs. GPS Spoofer

The core insight is this: **a GPS coordinate is a single number. Human behavior is a multi-dimensional pattern.** A spoofer can fake one signal. They cannot simultaneously fake every signal that a genuinely stranded worker produces.

GigShield's **Behavioral Coherence Engine** cross-validates a minimum of 5 independent signals before any payout is approved. A legitimate claim will naturally pass most checks. A spoofer sitting at home will fail at least 2–3.

| Signal | Genuine Stranded Worker | GPS Spoofer at Home |
|--------|------------------------|---------------------|
| **GPS coordinates** | Inside alert zone | Faked inside alert zone ✓ |
| **Device accelerometer** | Minimal movement (stationary/sheltering) | Minimal movement ✓ |
| **Network cell tower ID** | Tower inside alert zone | Home cell tower — MISMATCH ❌ |
| **App-reported order activity** | Zero orders attempted (platform confirms halt) | Possibly normal order attempts ❌ |
| **Battery drain pattern** | Higher drain (screen on, monitoring alerts) | Normal home usage pattern ❌ |
| **Historical zone presence** | Worker's last 30-day GPS history confirms this zone | No prior zone presence ❌ |
| **Platform login IP** | IP geo-locates to claimed zone or nearby | Home ISP IP — MISMATCH ❌ |

**Decision Logic:**
```
coherence_score >= 4/7 signals  →  AUTO-APPROVE payout
coherence_score = 2–3/7 signals →  FLAG for fast human review (< 2 hours)
coherence_score <= 1/7 signals  →  AUTO-HOLD + fraud investigation triggered
```

> **Why cell tower ID is the key signal:** GPS coordinates can be spoofed entirely in software. Cell tower association is determined by the mobile network operator — it cannot be faked by an app running on the device. A worker in Andheri East will connect to Andheri East towers. A worker faking that location from Thane will not.

---

### 2. The Data — Detecting a Coordinated Fraud Ring

Individual spoofing is hard to catch. Coordinated syndicate spoofing is paradoxically **easier** to detect — because coordination introduces statistical patterns that don't exist in organic behavior.

#### 2a. Surge Anomaly Detection (Isolation Forest — Population Layer)

Our Isolation Forest model operates at **two levels simultaneously:**

- **Individual level:** Is this worker's claim pattern anomalous vs. their own history?
- **Population level:** Is the *rate* of claims from a zone anomalous vs. historical zone baselines?

A genuine monsoon event produces claim surges that follow a predictable spatial distribution (epicenter-heavy, tapering outward) and temporal distribution (claims arrive over 2–4 hours as the event unfolds).

A syndicate attack produces a **different signature:**
- Claims spike within a **narrow 15–30 minute window** (Telegram coordination lag)
- Claims are **spatially uniform** across the zone rather than epicenter-concentrated
- A disproportionate share of claimants have **account ages < 60 days**
- Claimants show **no prior claim history** despite operating in historically high-risk zones

```python
# Simplified syndicate detection logic
def is_coordinated_attack(zone_id, claim_window_minutes=30):
    recent_claims = get_claims(zone_id, last_minutes=claim_window_minutes)

    surge_ratio        = len(recent_claims) / zone_baseline_rate(zone_id)
    new_account_ratio  = sum(1 for c in recent_claims if c.account_age_days < 60) / len(recent_claims)
    spatial_uniformity = compute_spatial_gini(recent_claims)  # Low Gini = suspiciously uniform

    risk_score = (surge_ratio * 0.4) + (new_account_ratio * 0.4) + ((1 - spatial_uniformity) * 0.2)

    if risk_score > SYNDICATE_THRESHOLD:
        trigger_zone_lockdown(zone_id)    # Pause auto-approvals in zone
        alert_human_review_team(zone_id)  # Escalate immediately
```

#### 2b. Specific Data Points Analyzed Beyond GPS

| Data Point | Source | What It Detects |
|------------|--------|-----------------|
| **Cell tower ID + MCC/MNC** | Device network API (with consent) | Location faking via GPS spoof apps |
| **Device mock location flag** | Android `Location.isFromMockProvider()` | Direct detection of GPS mock apps |
| **IP geolocation** | Server-side on API call | Home ISP vs. claimed field location |
| **Platform order attempt logs** | Mock Zomato/Swiggy API | Workers actively taking orders during "disruption" |
| **Account creation timestamp** | GigShield DB | Newly created accounts in fraud rings |
| **Claim timing distribution** | GigShield DB | Synchronized claim bursts = coordination signal |
| **Historical zone affinity** | Worker's 30-day GPS history | Workers who never operated in claimed zone |
| **Peer network graph** | Referral/onboarding relationships | Clustered account creation by same referrer |

#### 2c. The `isFromMockProvider()` Hard Check

Android exposes a native API flag that is set to `true` whenever a GPS-spoofing app is active on the device. GigShield's mobile client reads this flag and transmits it with every location ping. **If `mockProvider = true`, the claim is automatically held** — regardless of all other signals. This single check neutralizes the majority of consumer GPS-spoofing applications on the Play Store.

> Workers with genuine location issues (e.g., weak GPS signal in heavy rain) will have `mockProvider = false` — they are completely unaffected by this check.

---

### 3. The UX Balance — Protecting Honest Workers from False Positives

The hardest design problem is not catching fraudsters — it is **not punishing honest workers** who get flagged because of genuine network issues in bad weather. GigShield's approach is built on one principle: **innocent until the data proves otherwise, with a fast human fallback.**

#### 3a. The Flagged Claim Workflow

```
Claim Flagged by System
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  STEP 1: Soft-flag (invisible to worker)             │
│  System continues collecting signals for 30 mins.   │
│  If coherence score improves → AUTO-APPROVE.         │
│  Handles: temporary GPS drop, weak cell signal.      │
└──────────────────────────────────────────────────────┘
         │ Score doesn't improve
         ▼
┌──────────────────────────────────────────────────────┐
│  STEP 2: Worker Notification (friendly, not          │
│  accusatory)                                         │
│  "We're verifying your claim — this is automatic     │
│  in high-activity zones. You'll hear back within     │
│  2 hours."                                           │
│  Worker may optionally submit ONE supporting photo.  │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  STEP 3: Fast Human Review (< 2 hour SLA)            │
│  Reviewer sees coherence score breakdown, zone       │
│  claim map, and worker's full history.               │
│  Decision: Approve / Escalate / Reject               │
│  Worker notified immediately either way.             │
└──────────────────────────────────────────────────────┘
```

#### 3b. The "Benefit of the Doubt" Protocol

Three scenarios where GigShield **automatically overrides** a low coherence score and approves the claim:

| Scenario | Why We Override |
|----------|----------------|
| Worker has **12+ months** on platform with **zero prior flags** | Long-term behavioral trust outweighs a one-time signal anomaly |
| Cell tower mismatch BUT tower is **< 3km from claimed zone** | Towers near zone boundaries legitimately serve adjacent areas |
| `mockProvider = false` AND event is **IMD Red Alert** (highest severity) | Extreme events disrupt normal patterns; false positive risk is too high to penalize |

#### 3c. No Auto-Rejection. Ever.

**GigShield never auto-rejects a claim.** The worst outcome for a flagged claim is a 2-hour human review delay. This is deliberately asymmetric — we accept that some fraudulent claims may occasionally pass fast review rather than risk denying a genuine claim to a worker who has lost a day's wages.

The financial model accounts for this: our loss ratio projections include a **3–5% fraud leakage buffer** that keeps the platform viable even under coordinated attack scenarios.

#### 3d. Why This Architecture Is Syndicate-Resistant

| Attack Vector | GigShield Defense |
|--------------|-------------------|
| GPS coordinate spoofing | Cell tower ID cross-check + `isFromMockProvider()` flag |
| 500 workers claiming simultaneously | Population-level Isolation Forest surge detection |
| New accounts created for fraud | Account age weighting in coherence score |
| Organized via Telegram | Claim timing distribution analysis detects coordination lag |
| Worker continues taking orders during "disruption" | Platform order log cross-reference |
| Honest worker caught in false positive | 3-step review, benefit-of-the-doubt overrides, no auto-rejection |

> The syndicate's advantage is coordination. Our advantage is that coordination itself leaves a statistical signature — and we are watching for it at the population level, not just the individual level.

---

## The AI/ML Layer

We're not using AI as a buzzword. Here's exactly what it does:

**Dynamic Premium Engine (XGBoost)**
Takes in zone-level weather history, seasonal patterns, the worker's risk profile, and next-week forecasts. Outputs a weekly premium multiplier. Retrained monthly as new weather data comes in.

**Risk Profile Scoring**
Every new worker gets a score (0–100) based on where they operate, how long they've been on the platform, and historical disruption frequency in their zone. This feeds into their tier pricing and payout eligibility.

**Fraud Detection (Isolation Forest)**
Unsupervised anomaly detection on claims data. Flags patterns that deviate significantly from the worker's own history and from their zone peers. Tuned to minimize false positives — we'd rather let an edge case through than wrongly reject a genuine claim.

**Civic Disruption NLP Classifier (DistilBERT)**
A fine-tuned DistilBERT model (rule-based regex for the MVP) that scans government RSS feeds and news sources for bandh/curfew declarations and maps them to pincodes.

---

## Tech Stack

**Frontend:** React.js (web) + React Native PWA (mobile) + TailwindCSS
**Backend:** Node.js + Express for APIs, FastAPI for ML model serving
**Database:** PostgreSQL (policy/claims data) + Redis (real-time trigger state)
**ML:** Python + Scikit-learn / XGBoost / Hugging Face Transformers
**Auth:** Firebase OTP (phone number login — no passwords for gig workers)
**Payments:** Razorpay Test Mode / UPI Simulator
**APIs:** OpenWeatherMap (free tier), CPCB AQI, IMD public data, mock Zomato/Swiggy API
**Hosting:** Vercel (frontend) + Railway (backend) — free tiers

---

## Repository Structure

```
gigshield/
├── frontend/               # React.js Web App
│   ├── src/
│   │   ├── components/
│   │   ├── pages/          # Onboarding, Dashboard, Policy, Claims
│   │   └── store/          # Redux state management
├── mobile/                 # React Native PWA
├── backend/
│   ├── api/                # REST API routes
│   ├── services/           # Trigger engine, payout processor, fraud scorer
│   └── db/                 # PostgreSQL schemas + migrations
├── ml/
│   ├── premium_engine/     # XGBoost weekly premium model
│   ├── fraud_detection/    # Isolation Forest anomaly model
│   └── nlp_classifier/     # Civic disruption classifier
├── mock-apis/              # Simulated Zomato/Swiggy + payment APIs
├── data/                   # Sample weather, AQI, and worker datasets
└── README.md
```

---

*GigShield — Because every delivery partner deserves a safety net that works as hard as they do.*
