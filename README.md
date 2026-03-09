# 🛵 GigShield — Income Protection for Food Delivery Partners

> **Guidewire DEVTrails 2026 **
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

## The AI/ML Layer

We're not using AI as a buzzword. Here's exactly what it does:

**Dynamic Premium Engine (XGBoost)**
Takes in zone-level weather history, seasonal patterns, the worker's risk profile, and next-week forecasts. Outputs a weekly premium multiplier. Retrained monthly as new weather data comes in.

**Risk Profile Scoring**
Every new worker gets a score (0–100) based on where they operate, how long they've been on the platform, and historical disruption frequency in their zone. This feeds into their tier pricing and payout eligibility.

**Fraud Detection (Isolation Forest)**
Unsupervised anomaly detection on claims data. Flags patterns that deviate significantly from the worker's own history and from their zone peers. Tuned to minimize false positives — we'd rather let an edge case through than wrongly reject a genuine claim.

**Civic Disruption NLP Classifier**
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
