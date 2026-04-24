import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getWeatherData, getWeatherByPincode, get7DayForecast, applyDemoBoost } from "./services/weatherService";
import { evaluateWeatherTrigger, evaluateAllTriggers } from "./services/triggerEngine";
import { evaluateFraud, FraudEvaluationData } from "./services/fraudService";
import { getAQIData, evaluateAQITrigger } from "./services/aqiService";
import { evaluateAllDisruptions } from "./services/disruptionService";
import { addDisruption, clearDisruptions, getAllActiveDisruptions, getActiveAlerts } from "./services/municipalService";
import { computeSustainabilityMetrics } from "./services/sustainabilityService";
import { pincodeToCityName, getPincodeLocation } from "./services/pincodeService";
import { getZoneSignals, addOutageReport } from "./services/signalService";
import { runClaimPipeline } from "./services/claimPipeline";
import { calculatePayout, getBaseIncome } from "./services/payoutEngine";
import { checkWaitingPeriod, getPolicyAgePenalty, checkGeoLock, getAllWaitingPeriods } from "./services/waitingPeriodService";
import { startScheduler, setSchedulerDeps, getRecentEvents, getSchedulerStats } from "./services/scheduler";
import { runSimulation, runAllSimulations, getAvailableScenarios } from "./services/simulationEngine";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*" }));
app.use(express.json());
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));



// ── Prisma ──────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();
let dbConnected = false;
prisma.$connect()
  .then(() => { dbConnected = true; console.log("PostgreSQL connected via Prisma"); })
  .catch((e) => console.log("PostgreSQL not connected, using in-memory fallback", e));

// ── In-memory fallbacks ──────────────────────────────────────────────────────
const inMemoryClaims: any[] = [];
const inMemoryPayouts: any[] = [];
const inMemoryUsers: any[] = [];
const inMemoryPolicies: any[] = [];

// ── Razorpay ─────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_ScqqkDkAaShrbI",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "lhXc024uCrTK140A1LGhmG7j",
});

// ── Scheduler Dependencies ───────────────────────────────────────────────────
setSchedulerDeps(
  async (city: string) => {
    try {
      if (dbConnected) {
        const policies = await prisma.policy.findMany({ 
          where: { city: { contains: city, mode: "insensitive" }, status: "ACTIVE", paused: false } 
        });
        return policies.map((p) => ({
          userId: p.userId, profession: p.profession || "delivery_rider",
          dailyEarnings: p.dailyEarnings || 900, plan: p.plan || "Standard",
          enrolledAt: p.enrolledAt.toISOString(),
        }));
      }
    } catch {}
    return inMemoryPolicies
      .filter(p => p.city?.toLowerCase() === city.toLowerCase() && p.status === "ACTIVE")
      .map(p => ({
        userId: p.userId, profession: p.profession || "delivery_rider",
        dailyEarnings: p.daily_earnings || 900, plan: p.plan || "Standard",
        enrolledAt: p.enrolled_at || new Date().toISOString(),
      }));
  },
  async (data: any) => {
    try { 
      if (dbConnected) {
        await prisma.claim.create({ data: {
          id: data.id, type: data.type, triggerIcon: data.trigger, triggerType: data.trigger_type,
          date: data.date, payout: data.payout, severity: data.severity, status: data.status,
          fraudScore: data.fraudScore, fraudClassification: data.fraud_classification,
          reasons: data.reasons || [], aiExplanation: data.ai_explanation,
          timeline: data.timeline || []
        }});
      } else {
        inMemoryClaims.unshift(data);
      }
    } catch { inMemoryClaims.unshift(data); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/health", (_req, res) => res.json({
  status: "ok", service: "gigshield-backend", version: "2.0.0",
  db: dbConnected ? "connected" : "in-memory",
  scheduler: getSchedulerStats(),
  features: ["weather","aqi","disruption","fraud-ml","sustainability","scheduler","claim-pipeline","dynamic-payouts","waiting-periods","geo-lock"],
}));

// ═══════════════════════════════════════════════════════════════════════════════
// USER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/register", async (req, res) => {
  const { phone, aadhaar, platform, partnerId, pincode, dailyEarnings, profession, city, plan } = req.body;
  const loc = pincode ? getPincodeLocation(pincode) : null;
  const resolvedCity = city || loc?.city || "Mumbai";
  const zoneId = loc ? `${loc.city.toLowerCase()}_${pincode}` : resolvedCity.toLowerCase();

  // Fetch risk score from ML service
  let riskScore = 50, tier = "medium";
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
    const mlRes = await fetch(`${mlUrl}/predict-risk`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: resolvedCity, profession: profession || "delivery_rider", claims_history_count: 0, device_trust: 80, payment_consistency: 90 }),
    });
    if (mlRes.ok) { const d = await mlRes.json() as any; riskScore = d.risk_score; tier = d.tier; }
  } catch { /* keep defaults */ }

  const userData = {
    phone, aadhaarHash: aadhaar ? crypto.createHash("sha256").update(aadhaar).digest("hex") : null,
    platform, partnerId, profession: profession || "delivery_rider",
    city: resolvedCity, pincode, lat: loc?.lat, lng: loc?.lon, zoneId,
    dailyEarnings: dailyEarnings || 900, riskScore, tier,
    plan: plan || "Standard", enrolledAt: new Date(),
  };

  let savedUser;
  try { 
    if (dbConnected) {
      savedUser = await prisma.user.create({ data: userData }); 
    } else {
      throw new Error("DB offline");
    }
  }
  catch { inMemoryUsers.push({ ...userData, id: `user_${Date.now()}` }); savedUser = { ...userData, id: `user_${Date.now()}` }; }

  // Auto-create policy
  const policyData = {
    userId: (savedUser as any).id?.toString() || `user_${Date.now()}`,
    city: resolvedCity, pincode, profession: profession || "delivery_rider",
    plan: plan || "Standard", premium: plan === "Premium" ? 149 : plan === "Basic" ? 49 : 89,
    dailyEarnings: dailyEarnings || 900,
    coverTypes: ["rain","heat","aqi","outage","bandh"],
    coverageLimit: plan === "Premium" ? 20000 : plan === "Basic" ? 5000 : 10000,
    coveragePercent: plan === "Premium" ? 1.0 : plan === "Basic" ? 0.6 : 0.8,
    status: "ACTIVE", enrolledAt: new Date(),
  };
  try { 
    if (dbConnected) {
      await prisma.policy.create({ data: policyData }); 
    } else {
      throw new Error("DB offline");
    }
  } catch { inMemoryPolicies.push(policyData); }

  res.json({ success: true, user: { ...userData, aadhaarHash: undefined }, risk_score: riskScore, tier, recommended_plan: tier === "high" ? "Premium" : tier === "medium" ? "Standard" : "Basic" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/payment/order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({ amount: (req.body.amount || 89) * 100, currency: "INR", receipt: `rcpt_${Date.now()}` });
    res.json({ success: true, order });
  } catch { res.status(500).json({ success: false, error: "Failed to create order" }); }
});

app.post("/api/payment/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET || "lhXc024uCrTK140A1LGhmG7j";
  const sig = crypto.createHmac("sha256", secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  res.json({ success: sig === razorpay_signature, message: sig === razorpay_signature ? "Verified" : "Invalid signature" });
});

app.post("/api/payment/mandate", async (req, res) => {
  try {
    const { amount, frequency } = req.body;
    const plan = await razorpay.plans.create({
      period: frequency || "weekly", interval: 1,
      item: { name: `GigShield ${frequency || "Weekly"} Cover`, amount: Math.round((amount || 89) * 100), currency: "INR", description: "Auto-renewing parametric insurance" },
    });
    const sub = await razorpay.subscriptions.create({ plan_id: plan.id, customer_notify: 1, total_count: 52 });
    res.json({ success: true, mandate: { id: sub.id, plan_id: plan.id, amount: amount || 89, frequency: frequency || "weekly", status: sub.status, short_url: sub.short_url } });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// Subscription plans
const SUBSCRIPTION_PLANS = [
  { name: "Daily", price: 10, period: "daily" },
  { name: "Weekly", price: 49, period: "weekly" },
  { name: "Monthly", price: 149, period: "monthly" },
];
app.get("/api/payment/plans", (_req, res) => res.json({ success: true, plans: SUBSCRIPTION_PLANS }));

app.post("/api/webhooks/razorpay", (req, res) => {
  const { event, payload } = req.body;
  if (event === "subscription.charged") {
    console.log(`[Webhook] Subscription charged: ${payload?.subscription?.entity?.id}`);
  } else if (event === "subscription.halted") {
    console.log(`[Webhook] Subscription halted`);
  }
  res.status(200).send("OK");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNALS (Unified)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/signals/:zone", async (req, res) => {
  try {
    const signal = await getZoneSignals(req.params.zone, req.query.pincode as string);
    res.json({ success: true, ...signal });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/report/outage", (req, res) => {
  const { zone_id, reporter_id, description } = req.body;
  if (!zone_id) return res.status(400).json({ success: false, error: "zone_id required" });
  const report = addOutageReport(zone_id, reporter_id || "anonymous", description || "Outage reported");
  res.json({ success: true, report });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIMS (Production Pipeline)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/claims", async (_req, res) => {
  try {
    if (dbConnected) {
      const claims = await prisma.claim.findMany({
        orderBy: { createdAt: "desc" },
        take: 30
      });
      res.json(claims);
    } else {
      res.json(inMemoryClaims);
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/claims/submit", async (req, res) => {
  const { id, type, trigger, date, payout, claimed_rain, gps_speed, user_trust_score,
    userLocation, actualLocation, activity, demoMode, enrolledAt, dailyEarnings,
    city: reqCity, profession, plan } = req.body;

  const city = reqCity || "Mumbai";
  const result = await runClaimPipeline({
    claim_id: id || `CLM-${Date.now()}`,
    user_id: "user_dashboard",
    city,
    trigger_type: type || "rain",
    profession: profession || "delivery_rider",
    daily_income: dailyEarnings || 900,
    plan_tier: plan || "Standard",
    enrolled_at: enrolledAt || new Date(Date.now() - 30 * 86400000).toISOString(),
    user_location: userLocation,
    actual_location: actualLocation,
    claimed_rain: claimed_rain,
    gps_speed: gps_speed,
    user_trust_score: user_trust_score,
    activity,
    demo_mode: demoMode || false,
  });

  const safeBody = {
    id: result.claim_id, type: type || "Weather", triggerIcon: trigger || "🌧️",
    triggerType: result.weather ? type : null,
    date: date || new Date().toISOString().split("T")[0],
    payout: result.payout_amount,
    severity: result.payout_details?.severity || 0,
    status: result.final_status, fraudScore: result.fraud_score,
    fraudClassification: result.stages.find(s => s.name === "Fraud Detection")?.status || "PASS",
    timeline: result.stages.map(s => `${s.name}: ${s.status} (${s.duration_ms}ms)`),
    reasons: result.reasons,
    aiExplanation: result.reasons.join(" | "),
  };

  try { 
    if (dbConnected) {
      await prisma.claim.create({ data: safeBody });
    } else {
      throw new Error("DB offline");
    }
  } catch { inMemoryClaims.unshift(safeBody); }

  let payoutData = null;
  if (result.final_status === "APPROVED" && result.payout_amount > 0) {
    payoutData = {
      id: `PAY-${Date.now()}`, claimId: safeBody.id,
      transactionId: `txn_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      gateway: "Razorpay", amount: result.payout_amount, status: "SUCCESS",
    };
    try { 
      if (dbConnected) {
        await prisma.payout.create({ data: payoutData });
      } else {
        throw new Error("DB offline");
      }
    } catch { inMemoryPayouts.unshift(payoutData); }
  }

  res.json({ success: true, claim: safeBody, pipeline: { stages: result.stages, total_ms: result.total_duration_ms }, payout: payoutData });
});

// Internal claim processing
app.post("/api/claim/process", async (req, res) => {
  try {
    const result = await runClaimPipeline(req.body);
    res.json({ success: true, result });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/triggers/weather", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const pincode = req.query.pincode as string | undefined;
    const demo = req.query.demo === "true";
    const dailyEarnings = req.query.dailyEarnings ? parseFloat(req.query.dailyEarnings as string) : undefined;
    let weather = pincode ? await getWeatherByPincode(pincode) : await getWeatherData(city);
    if (demo) weather = applyDemoBoost(weather);
    const resolvedCity = pincode ? pincodeToCityName(pincode) : city;
    const evaluation = await evaluateAllTriggers(weather, resolvedCity, dailyEarnings, pincode);
    const metrics = await getSustainabilityMetrics();
    evaluation.triggerPayout = Math.round(evaluation.triggerPayout * metrics.payoutModifier);
    res.json({ success: true, demoBoost: demo, ...evaluation });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/triggers/aqi", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const pincode = req.query.pincode as string | undefined;
    const resolvedCity = pincode ? pincodeToCityName(pincode) : city;
    const data = await getAQIData(resolvedCity, pincode);
    res.json({ success: true, ...evaluateAQITrigger(data) });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/triggers/disruption", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const pincode = req.query.pincode as string | undefined;
    const resolvedCity = pincode ? pincodeToCityName(pincode) : city;
    const weather = pincode ? await getWeatherByPincode(pincode) : await getWeatherData(resolvedCity);
    res.json({ success: true, ...evaluateAllDisruptions(weather, resolvedCity, pincode) });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/trigger/evaluate", async (req, res) => {
  try {
    const { city, pincode, dailyEarnings } = req.body;
    const weather = pincode ? await getWeatherByPincode(pincode) : await getWeatherData(city || "Mumbai");
    const result = await evaluateAllTriggers(weather, city || "Mumbai", dailyEarnings, pincode);
    res.json({ success: true, ...result });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/policy/:userId", async (req, res) => {
  const metrics = await getSustainabilityMetrics();
  const basePremium = 89;
  res.json({
    userId: req.params.userId, plan: "Standard", coverage: 10000,
    premium: Math.round(basePremium * metrics.dynamicPremiumModifier),
    daysRemaining: 23, status: "active",
    waiting_periods: getAllWaitingPeriods(),
  });
});

app.post("/api/policy/purchase", async (req, res) => {
  const { userId, city, pincode, plan, profession, dailyEarnings } = req.body;

  // Geo-lock check
  const alerts = getActiveAlerts(city || "Mumbai");
  const geoLock = checkGeoLock(alerts);
  if (geoLock.locked) {
    return res.json({ success: false, error: geoLock.reason, geo_locked: true });
  }

  const policyData = {
    userId, city: city || "Mumbai", pincode, profession: profession || "delivery_rider",
    plan: plan || "Standard", premium: plan === "Premium" ? 149 : plan === "Basic" ? 49 : 89,
    dailyEarnings: dailyEarnings || 900,
    coverTypes: ["rain","heat","aqi","outage","bandh"],
    coverageLimit: plan === "Premium" ? 20000 : plan === "Basic" ? 5000 : 10000,
    coveragePercent: plan === "Premium" ? 1.0 : plan === "Basic" ? 0.6 : 0.8,
    status: "ACTIVE", enrolledAt: new Date(),
  };
  try { 
    if (dbConnected) {
      await prisma.policy.create({ data: policyData });
    } else {
      throw new Error("DB offline");
    }
  } catch { inMemoryPolicies.push(policyData); }
  res.json({ success: true, policy: policyData, waiting_periods: getAllWaitingPeriods() });
});

app.post("/api/pause-policy", async (req, res) => {
  const { userId } = req.body;
  try {
    if (dbConnected) {
      await prisma.policy.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { paused: true }
      });
      res.json({ success: true, message: "Policy paused" });
    } else {
      throw new Error("DB offline");
    }
  } catch {
    inMemoryPolicies.filter(p => p.userId === userId).forEach(p => p.paused = true);
    res.json({ success: true, message: "Policy paused (in-memory)" });
  }
});

app.post("/api/resume-policy", async (req, res) => {
  const { userId } = req.body;
  try {
    if (dbConnected) {
      await prisma.policy.updateMany({
        where: { userId },
        data: { paused: false }
      });
      res.json({ success: true, message: "Policy resumed" });
    } else {
      throw new Error("DB offline");
    }
  } catch {
    inMemoryPolicies.filter(p => p.userId === userId).forEach(p => p.paused = false);
    res.json({ success: true, message: "Policy resumed (in-memory)" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/admin/disruptions", (req, res) => {
  const { type, severity, source, region, expiry_hours } = req.body;
  if (!type || !severity || !region) return res.status(400).json({ success: false, error: "Missing fields" });
  const d = addDisruption({ type, severity, source: source || "Admin", region, date: new Date().toISOString().split("T")[0], expiry_hours });
  res.json({ success: true, disruption: d });
});

app.delete("/api/admin/disruptions", (req, res) => {
  const cleared = clearDisruptions(req.query.region as string);
  res.json({ success: true, cleared });
});

app.get("/api/admin/disruptions", (_req, res) => {
  res.json({ success: true, disruptions: getAllActiveDisruptions() });
});

async function getSustainabilityMetrics() {
  let claimData: { payout: number; status: string }[] = [];
  try {
    if (dbConnected) {
      const claims = await prisma.claim.findMany({ select: { payout: true, status: true } });
      claimData = claims.map((c) => ({ payout: c.payout || 0, status: c.status || "APPROVED" }));
    } else {
      throw new Error("DB offline");
    }
  } catch {
    claimData = (inMemoryClaims as any[]).map((c: any) => ({ payout: c.payout || 0, status: c.status || "APPROVED" }));
  }
  if (claimData.length === 0) {
    claimData = [
      { payout: 680, status: "APPROVED" }, { payout: 450, status: "APPROVED" },
      { payout: 720, status: "REJECTED" }, { payout: 380, status: "APPROVED" },
      { payout: 550, status: "APPROVED" }, { payout: 680, status: "REJECTED" },
    ];
  }
  return computeSustainabilityMetrics(claimData);
}

app.get("/api/admin/sustainability", async (_req, res) => {
  try { res.json({ success: true, ...await getSustainabilityMetrics() }); }
  catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/weather/forecast", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const weather = await getWeatherData(city);
    const forecast = get7DayForecast(weather);
    const aqiData = await getAQIData(city);
    const aqiResult = evaluateAQITrigger(aqiData);
    res.json({
      success: true, currentWeather: weather, currentAQI: aqiData,
      aqiTriggered: aqiResult.triggered, forecast,
      expectedClaims: forecast.filter(d => d.riskLevel === "high").length * 12 + forecast.filter(d => d.riskLevel === "medium").length * 5,
      riskZones: [
        { zone: "Andheri East", level: weather.rain > 15 ? "high" : "medium" },
        { zone: "Kurla West", level: weather.rain > 20 ? "high" : weather.rain > 10 ? "medium" : "low" },
        { zone: "Bandra", level: weather.temp > 38 ? "high" : "low" },
      ],
    });
  } catch { res.status(500).json({ success: false, error: "Forecast failed" }); }
});

// Scheduler events
app.get("/api/triggers/recent", (_req, res) => {
  const events = getRecentEvents(24);
  res.json({ success: true, events, total: events.length, triggered: events.filter(e => e.triggered).length });
});

app.get("/api/scheduler/stats", (_req, res) => {
  res.json({ success: true, ...getSchedulerStats() });
});

// Payout calculator (public)
app.post("/api/payout/calculate", (req, res) => {
  const { profession, daily_income, trigger_type, plan_tier, severity } = req.body;
  const result = calculatePayout({ profession, daily_income, trigger_type, plan_tier, severity_override: severity });
  res.json({ success: true, ...result });
});

// Simulation engine
app.get("/api/admin/simulations/scenarios", (_req, res) => {
  res.json({ success: true, scenarios: getAvailableScenarios() });
});

app.post("/api/admin/simulations/run", async (req, res) => {
  try {
    let claimData: { payout: number; status: string }[] = [];
    try {
      if (dbConnected) {
        const claims = await prisma.claim.findMany({ select: { payout: true, status: true } });
        claimData = claims.map((c) => ({ payout: c.payout || 0, status: c.status || "APPROVED" }));
      } else {
        throw new Error("DB offline");
      }
    } catch {
      claimData = inMemoryClaims.map((c: any) => ({ payout: c.payout || 0, status: c.status || "APPROVED" }));
    }
    if (claimData.length === 0) {
      claimData = [
        { payout: 680, status: "APPROVED" }, { payout: 450, status: "APPROVED" },
        { payout: 720, status: "REJECTED" }, { payout: 380, status: "APPROVED" },
      ];
    }
    if (req.body.scenario) {
      res.json({ success: true, result: runSimulation(claimData, req.body.scenario) });
    } else {
      res.json({ success: true, results: runAllSimulations(claimData) });
    }
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════
startScheduler(5000);

app.listen(PORT, () => {
  console.log(`GigShield Backend v2.0 running on http://localhost:${PORT}`);
});
