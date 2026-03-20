# GigShield — Parametric Income Protection for India's Gig Economy

---

## Inspiration

Every evening in Mumbai, Delhi, and Bengaluru, millions of delivery partners power our on-demand economy. We order food, they brave the roads. Then the monsoon arrives.

We came across a statistic that stopped us cold: **India's 57.6 million gig workers lose 20–30% of their monthly income during external disruptions** — monsoons, heatwaves, bandhs, severe pollution — with absolutely no recourse. No insurance covers this. No form exists to file. They just absorb the loss.

Meet **Ramesh**. He's 27, delivers for Swiggy in Mumbai, and earns around ₹750 on a good day. When a Red Alert drops in July, orders disappear. By week's end, he's down ₹3,200 — nearly 60% of what he was counting on. There's no safety net. He just does the math under a chai stall and waits for the rain to stop.

We were inspired by the elegance of **parametric insurance** — a model where payouts are triggered automatically by objective, measurable events rather than claims filed by the victim. No paperwork. No adjuster. No proof burden on someone who just lost a day's wages to the sky.

The question became: *why doesn't this exist for India's gig economy yet?* We decided to build it.

---

## What It Does

**GigShield** is an AI-powered parametric income insurance platform built exclusively for food delivery partners (Zomato / Swiggy). It protects workers against income loss caused by five verified external disruptions:

| Trigger | Threshold | Payout |
|--------|-----------|--------|
| 🌧️ Heavy Rain / Flood | ≥35mm in 3hrs OR IMD Red Alert | Full / Partial Day |
| 🌡️ Extreme Heat | Temp ≥43°C + IMD Heat Wave declaration | Partial (4 hrs) |
| 😷 Severe Air Pollution | AQI ≥301 for 4+ hours | Partial Day |
| 🚫 Bandh / Curfew | Verified govt curfew in pincode | Full Day |
| 📵 Platform Outage | App down 2+ hrs during peak hours | Proportional |

**The worker experience is zero-touch:**
1. Sign up in 3 minutes with Swiggy Partner ID + Aadhaar eKYC
2. Choose a weekly plan (₹29 / ₹49 / ₹79)
3. Work normally — GigShield monitors their zone every 15 minutes
4. When a trigger fires, the payout hits their UPI automatically
5. They get a notification: *"Heavy rain in Andheri East. ₹680 sent. Stay safe."*

That's the entire user journey. No claims. No proof. No adjuster.

---

## How We Built It

### Architecture

We built GigShield as a **Progressive Web App (PWA)** — a single codebase serving both web and mobile, with no Play Store friction for workers who already have minimal device storage.

```
Worker → Jutro Digital Platform (React PWA)
       → PolicyCenter (weekly policy engine)
       → BillingCenter (premium management)
       → AI Risk Factor Engine (XGBoost + Isolation Forest)
       → Integration Gateway (IMD, CPCB, OpenWeatherMap, Govt feeds)
       → AutoPilot Payout Processor (UPI / Razorpay)
```

### Weekly Premium Model

Premiums are calculated dynamically using an XGBoost model. The pricing formula is:

$$P_{weekly} = P_{base} \times R_{zone} \times S_{seasonal} \times (1 - D_{loyalty})$$

Where:
- \\( P_{base} \\) = tier base rate (₹29 / ₹49 / ₹79)
- \\( R_{zone} \\) = zone risk multiplier derived from 3-year historical disruption frequency
- \\( S_{seasonal} \\) = seasonal weight (monsoon months carry higher multiplier for Mumbai/Chennai)
- \\( D_{loyalty} \\) = loyalty discount for workers with clean claims history

### AI/ML Stack

**1. Dynamic Premium Engine (XGBoost)**
Inputs: zone-level weather history, seasonal patterns, worker's risk profile, 7-day weather forecast. Output: weekly premium multiplier. Retrained monthly on rolling weather data.

**2. Risk Profile Scoring**
Every worker receives a risk score \\( s \in [0, 100] \\) on onboarding, based on operating zone, platform tenure, and historical disruption frequency in their area.

**3. Fraud Detection (Isolation Forest)**
Unsupervised anomaly detection. The anomaly score for a claim \\( x \\) is:

$$\text{AnomalyScore}(x) = 2^{-\frac{E[h(x)]}{c(n)}}$$

Where \\( E[h(x)] \\) is the average path length across trees and \\( c(n) \\) is the expected path length for a dataset of size \\( n \\). Scores approaching 1 indicate anomalies.

**4. Civic Disruption NLP (DistilBERT)**
Fine-tuned classifier scanning government RSS feeds and news sources for bandh/curfew declarations, mapping them to pincodes in real time.

### Tech Stack

- **Frontend:** React.js + TailwindCSS (PWA), React Native wrapper
- **Backend:** Node.js + Express (REST APIs), FastAPI (ML model serving)
- **Database:** PostgreSQL (policy/claims), Redis (real-time trigger state)
- **ML:** Python + Scikit-learn + XGBoost + HuggingFace Transformers
- **Auth:** Firebase OTP (phone-first login — no passwords for gig workers)
- **Payments:** Razorpay Test Mode + UPI Simulator
- **APIs:** OpenWeatherMap, CPCB AQI, IMD public data, Mock Zomato/Swiggy API
- **Hosting:** Vercel (frontend) + Railway (backend)

---

## Challenges We Ran Into

### 1. The GPS Spoofing Crisis (24-Hour Pivot)

Halfway through Phase 1, we received a threat brief: a 500-worker syndicate was using GPS-spoofing apps to fake their locations inside active weather alert zones, draining a competitor's liquidity pool via mass false payouts.

This forced us to fundamentally rethink our fraud architecture. Simple GPS verification was obsolete overnight. Our solution became the **Behavioral Coherence Engine** — a 7-signal cross-validation system where GPS is just one of many inputs:

| Signal | Spoofer Weakness |
|--------|-----------------|
| Cell tower ID (MCC/MNC) | Set by network operator — cannot be faked by any app |
| `isFromMockProvider()` Android flag | Directly detects GPS mock apps |
| IP geolocation | Home ISP IP ≠ field location |
| Platform order activity | Can't be "on disruption" and completing 12 deliveries |
| Claim timing distribution | Telegram-coordinated bursts have a 15–30 min synchronization signature |
| Spatial uniformity (Gini score) | Real monsoons are epicenter-heavy; syndicate attacks are uniform |
| Account age weighting | Fraud rings create new accounts — flagged in < 60 days |

The coordinated attack paradox: **individual spoofing is hard to catch; coordinated spoofing is easier**, because coordination itself leaves a statistical fingerprint at the population level.

### 2. Designing Fraud Detection That Doesn't Punish Honest Workers

The hardest UX problem was building fraud detection that catches bad actors without making honest workers feel like suspects. Our design constraint: **GigShield never auto-rejects a claim.** Ever.

The worst outcome for a flagged claim is a 2-hour human review delay. We deliberately accept 3–5% fraud leakage to ensure no genuine claim is wrongly denied to a worker who just lost a day's wages.

### 3. Making the Weekly Premium Model Financially Viable

Parametric insurance is actuarially tricky — triggers are objective, but calibrating payout amounts against premium revenue required modeling claim frequency distributions for each city and trigger type. We built a Monte Carlo simulation to stress-test our loss ratios across 10,000 simulated disruption scenarios before finalizing our tier pricing.

### 4. The UX Constraint: Workers Have 3 Minutes and Bad Signal

Our target user has an entry-level Android, may have patchy network connectivity, and will abandon any onboarding flow that takes more than 3 minutes. Every screen had to be designed for one-thumb use, minimal text input, and graceful offline behavior via service workers.

---

## Accomplishments That We're Proud Of

- **The zero-touch payout flow** — from trigger detection to UPI credit without a single action from the worker
- **The Behavioral Coherence Engine** — our 7-signal anti-spoofing architecture that treats GPS as one input among many, not the ground truth
- **`isFromMockProvider()` integration** — a single Android API call that neutralizes most consumer GPS-spoofing apps on the Play Store
- **The syndicate detection logic** — using Gini spatial uniformity scoring and claim timing distribution analysis to catch coordinated fraud rings that individual-level detection would miss
- **A financially viable ₹29/week entry tier** — less than ₹7/day, affordable on a gig income, with a loss ratio that actually holds up under stress testing

---

## What We Learned

**Parametric insurance is fundamentally a data problem, not an insurance problem.** The actuarial work is straightforward once you have clean, reliable trigger data. The hard part is sourcing, validating, and cross-checking that data in real time — especially for civic disruptions like bandhs where no single clean API exists.

**Fraud resistance must be designed in from day one.** Adding fraud detection as a layer on top of a GPS-only system was the mistake that sank the platform we were warned about. Our architecture treats every data signal as probabilistic evidence, not ground truth.

**Gig workers are not a homogeneous market.** A Swiggy partner in Dharavi (flood-prone, high-disruption) and a partner in Koramangala (less risk, stable zone) have genuinely different risk profiles and should pay different premiums. Flat-rate pricing is both unfair and unsustainable.

**The UX is the product.** For a population that has never interacted with insurance in any form, the experience of *receiving* a payout before you even knew a claim was filed is more powerful than any feature we could build. The notification — *"Heavy rain in Andheri East. ₹680 sent. Stay safe."* — is the entire value proposition in 12 words.

---

## What's Next for GigShield

**Phase 2 — Build:**
- Full working registration and policy management flows
- Live parametric trigger integrations (OpenWeatherMap, CPCB AQI, IMD)
- Zero-touch claims engine with automated payout via Razorpay sandbox
- XGBoost premium model v1 trained on real IMD historical data

**Phase 3 — Scale:**
- Advanced fraud detection with trained Isolation Forest on simulated claims data
- Dual-dashboard: worker earnings tracker + insurer loss ratio analytics
- Simulated disruption demo (trigger a fake rainstorm, watch the payout fire)
- Expand persona coverage to grocery delivery (Zepto / Blinkit) and e-commerce (Amazon / Flipkart)

**Beyond the Hackathon:**
- Partner with Zomato/Swiggy for in-app integration and verified platform data
- Seek IRDAI sandbox license for parametric microinsurance
- Explore premium auto-deduction directly from weekly platform payouts — making GigShield completely invisible until the moment a worker needs it most

---

*GigShield — Because every delivery partner deserves a safety net that works as hard as they do.*
