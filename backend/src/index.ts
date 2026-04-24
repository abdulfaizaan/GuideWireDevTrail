import "dotenv/config";
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
import { computeSustainabilityMetrics } from "./services/sustainabilityService";
import { pincodeToCityName } from "./services/pincodeService";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", apiLimiter);

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/gigshield";
let mongoConnected = false;
mongoose.connect(MONGO_URI)
  .then(() => { mongoConnected = true; console.log("MongoDB connected successfully"); })
  .catch(() => console.log("MongoDB not connected, using in-memory fallback"));

mongoose.connection.on("disconnected", () => { mongoConnected = false; });
mongoose.connection.on("connected", () => { mongoConnected = true; });

const claimSchema = new mongoose.Schema({
  id: String,
  type: String,
  trigger: String,
  date: String,
  payout: Number,
  status: String,
  fraudScore: Number,
  timeline: [String],
  createdAt: { type: Date, default: Date.now },
});
const Claim = mongoose.model("Claim", claimSchema);

const payoutSchema = new mongoose.Schema({
  id: String,
  claimId: String,
  transactionId: String,
  gateway: String,
  amount: Number,
  status: String,
  timestamp: { type: Date, default: Date.now }
});
const Payout = mongoose.model("Payout", payoutSchema);

const inMemoryPayouts: object[] = [];

const inMemoryClaims: object[] = [];

// ── Background trigger log (Fix 6) ──────────────────────────────────────────
interface BackgroundTriggerEvent {
  timestamp: string;
  city: string;
  triggered: boolean;
  riskScore: number;
  riskLevel: string;
  triggerType: string | null;
  triggerLabel: string | null;
  triggerPayout: number;
  activeTriggersCount: number;
  weatherSummary: string;
}
const backgroundTriggerLog: BackgroundTriggerEvent[] = [];

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_ScqqkDkAaShrbI",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "lhXc024uCrTK140A1LGhmG7j",
});

app.post("/api/payment/order", async (req, res) => {
  try {
    const { amount } = req.body;
    const options = {
      amount: amount * 100, // Razorpay works in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create order" });
  }
});

app.post("/api/payment/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET || "lhXc024uCrTK140A1LGhmG7j";
  
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    res.json({ success: true, message: "Payment verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid payment signature" });
  }
});

// ── UPI Autopay Mandate Stub (Fix 8) ─────────────────────────────────────────
app.post("/api/payment/mandate", (req, res) => {
  const { amount, frequency, upiId } = req.body;
  // In production, this would call Razorpay Subscription API:
  // razorpay.subscriptions.create({ plan_id, customer_notify, total_count, ... })
  res.json({
    success: true,
    mandate: {
      id: `mandate_${Date.now()}`,
      amount: amount || 89,
      frequency: frequency || "weekly",
      upiId: upiId || "user@upi",
      status: "ACTIVE",
      nextDebit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    },
  });
});

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  service: "gigshield-backend",
  mongo: mongoConnected ? "connected" : "disconnected (in-memory)",
  ml_service: process.env.ML_SERVICE_URL || "http://127.0.0.1:8000",
  features: ["weather", "aqi", "disruption", "fraud-ml", "sustainability", "scheduler"],
}));

app.get("/api/claims", async (_req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 }).limit(20);
    res.json(claims);
  } catch (_e) {
    res.json(inMemoryClaims);
  }
});

app.post("/api/claims/submit", async (req, res) => {
  const { id, type, trigger, date, payout, claimed_rain, actual_rain, gps_speed, user_trust_score, userLocation, actualLocation, activity, demoMode, enrolledAt, dailyEarnings } = req.body;

  // ── Anti-Adverse-Selection: Cooling-off Period (Fix 3) ────────────────────
  let coolingOffPenalty = 1.0;
  let coolingOffMessage: string | null = null;
  if (enrolledAt) {
    const enrollmentDate = new Date(enrolledAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - enrollmentDate.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < 72) {
      // Hard reject — cooling-off period active
      return res.json({
        success: false,
        claim: {
          id: id || `CLM-${Math.floor(Math.random() * 1000)}`,
          type: type || "Weather",
          trigger: trigger || "🌧️",
          date: date || new Date().toISOString().split("T")[0],
          payout: 0,
          status: "REJECTED",
          fraudScore: 0,
          timeline: ["Incident Detected", "Cooling-Off Check", "REJECTED: Policy too new"],
          reasons: [`Cooling-off period active. Policy age: ${Math.round(hoursElapsed)}h (minimum 72h required). This prevents adverse selection.`],
        },
        ai_engine: { status: "REJECTED", reason: "Cooling-off period active", is_fraud: false, fraud_probability: 0 },
        fraud_engine: { status: "COOLING_OFF", reasons: ["Policy enrolled too recently"], fraudScore: 0 },
        payout: null,
      });
    } else if (hoursElapsed < 168) {
      // Soft penalty — first week
      coolingOffPenalty = 0.5;
      coolingOffMessage = `New policy penalty: 50% payout reduction (policy age: ${Math.round(hoursElapsed / 24)} days, full payouts after 7 days)`;
    }
  }

  // In parametric insurance, the weather API is the oracle.
  const liveWeather = await getWeatherData("Mumbai");
  const resolvedActualRain = liveWeather.rain;
  const is_blacklisted_zone = 0; 

  let aiResponse = {
     is_fraud: false,
     fraud_probability: 0.1,
     is_anomaly: false,
     status: "APPROVED",
     reason: "Claim verified smoothly.",
     engine_reasons: [] as string[]
  };

  // --- Strict Oracle Verification ---
  const oracleRain = liveWeather.rain;
  const oracleTemp = liveWeather.temp;

  let criteriaValid = true;
  if (type.toLowerCase().includes("rain") && oracleRain < 20) {
    criteriaValid = false;
    aiResponse.status = "REJECTED";
    aiResponse.reason = `Oracle Discrepancy: Rainfall is ${oracleRain}mm (Requires >20mm threshold). Check Failed.`;
    aiResponse.is_fraud = true;
    aiResponse.fraud_probability = 0.99;
  } else if (type.toLowerCase().includes("heat") && oracleTemp < 40) {
    criteriaValid = false;
    aiResponse.status = "REJECTED";
    aiResponse.reason = `Oracle Discrepancy: Temp is ${oracleTemp}°C (Requires >40°C threshold). Check Failed.`;
    aiResponse.is_fraud = true;
    aiResponse.fraud_probability = 0.99;
  }

  // --- External AI Engine ---
  if (criteriaValid) {
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${mlServiceUrl}/api/ml/predict-fraud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           claimed_rain: claimed_rain ?? 0,
           actual_rain: resolvedActualRain,
           gps_speed: gps_speed ?? 30.0,
           user_trust_score: user_trust_score ?? 85.0,
           is_blacklisted_zone: is_blacklisted_zone
        })
     });
     if (response.ok) {
        aiResponse = (await response.json()) as typeof aiResponse;
     }
  } catch (error) {
     console.log("ML service unreachable. Using fallback logic.");
     
     if ((gps_speed && gps_speed > 80) || (claimed_rain && claimed_rain > 30)) {
        aiResponse.is_fraud = true;
        aiResponse.status = "REJECTED";
        aiResponse.reason = "High risk indicators detected by fallback rules.";
     }
  }
  }

  // --- Advanced Fraud Detection System ---
  const fraudPayload: FraudEvaluationData = {
    userLocation,
    actualLocation,
    claimedRain: claimed_rain,
    city: "Mumbai",
    activity
  };

  let fraudEngine = await evaluateFraud(fraudPayload);
  
  if (demoMode) {
    aiResponse.status = "APPROVED";
    aiResponse.is_fraud = false;
    aiResponse.fraud_probability = 0.05;
    fraudEngine = { status: "APPROVED", reasons: ["Verified smoothly via Demo Mode"], fraudScore: 5 };
  }

  // Combine logic
  let finalStatus = aiResponse.status;
  let finalFraudScore = Math.max(aiResponse.fraud_probability * 100, fraudEngine.fraudScore);
  const finalReasons = aiResponse.status === "REJECTED" ? [aiResponse.reason] : [];
  
  if (fraudEngine.status === "FRAUD") {
    finalStatus = "REJECTED";
    finalReasons.push(...fraudEngine.reasons);
  } else if (aiResponse.status === "APPROVED") {
    finalReasons.push("Verified smoothly against oracle parameters.");
  }

  // Apply cooling-off penalty to payout
  const adjustedPayout = Math.round((payout || 0) * coolingOffPenalty);
  if (coolingOffMessage) {
    finalReasons.push(coolingOffMessage);
  }

  // Safe claim object
  const safeBody = {
    id: id || `CLM-${Math.floor(Math.random() * 1000)}`,
    type: type || "Weather",
    trigger: trigger || "🌧️",
    date: date || new Date().toISOString().split("T")[0],
    payout: adjustedPayout,
    status: finalStatus,
    fraudScore: finalFraudScore,
    timeline: ["Incident Detected", "Fraud Check", "GPS & Weather Validated", `System Output: ${finalStatus}`],
    reasons: finalReasons,
    ai_explanation: finalReasons.join(" | ")
  };

  let savedClaim;
  try {
    const claim = new Claim(safeBody);
    savedClaim = await claim.save();
  } catch (_e) {
    inMemoryClaims.unshift(safeBody);
    savedClaim = safeBody;
  }

  
  let payoutData = null;
  if (finalStatus === "APPROVED") {
     payoutData = {
        id: `PAY-${Date.now()}`,
        claimId: safeBody.id,
        transactionId: `txn_sim_${Math.floor(Math.random() * 10000000)}`,
        gateway: "Stripe Sandbox",
        amount: safeBody.payout,
        status: "SUCCESS"
     };
     try {
        await new Payout(payoutData).save();
     } catch (_e) {
        inMemoryPayouts.unshift(payoutData);
     }
     safeBody.timeline.push(`₹${safeBody.payout} Sent to Wallet`);
  }

  res.json({
     success: true,
     claim: safeBody,
     ai_engine: aiResponse,
     fraud_engine: fraudEngine,
     payout: payoutData
  });
});

app.get("/api/policy/:userId", (req, res) => {
  res.json({
    userId: req.params.userId,
    plan: "Standard",
    coverage: 10000,
    premium: 89,
    daysRemaining: 23,
    status: "active",
  });
});

// ── Weather Trigger Endpoints ──────────────────────────────────────────────

app.get("/api/triggers/weather", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const pincode = req.query.pincode as string | undefined;
    const demo = req.query.demo === "true";
    const dailyEarnings = req.query.dailyEarnings ? parseFloat(req.query.dailyEarnings as string) : undefined;

    // Hyperlocal: use pincode if provided (Fix 5)
    let weather = pincode
      ? await getWeatherByPincode(pincode)
      : await getWeatherData(city);

    if (demo) weather = applyDemoBoost(weather);

    // Full multi-trigger evaluation (Fix 1)
    const resolvedCity = pincode ? pincodeToCityName(pincode) : city;
    const evaluation = await evaluateAllTriggers(weather, resolvedCity, dailyEarnings);
    res.json({ success: true, demoBoost: demo, ...evaluation });
  } catch (error) {
    console.error("[Weather Trigger] Error:", error);
    res.status(500).json({ success: false, error: "Weather trigger evaluation failed" });
  }
});

// ── AQI Trigger Endpoint (Fix 1) ──────────────────────────────────────────

app.get("/api/triggers/aqi", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const pincode = req.query.pincode as string | undefined;
    const resolvedCity = pincode ? pincodeToCityName(pincode) : city;

    const aqiData = await getAQIData(resolvedCity);
    const evaluation = evaluateAQITrigger(aqiData);

    res.json({ success: true, ...evaluation });
  } catch (error) {
    console.error("[AQI Trigger] Error:", error);
    res.status(500).json({ success: false, error: "AQI trigger evaluation failed" });
  }
});

// ── Disruption Trigger Endpoint (Fix 1) ──────────────────────────────────

app.get("/api/triggers/disruption", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const pincode = req.query.pincode as string | undefined;
    const resolvedCity = pincode ? pincodeToCityName(pincode) : city;

    const weather = pincode
      ? await getWeatherByPincode(pincode)
      : await getWeatherData(resolvedCity);

    const result = evaluateAllDisruptions(weather, resolvedCity);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Disruption Trigger] Error:", error);
    res.status(500).json({ success: false, error: "Disruption trigger evaluation failed" });
  }
});

// ── Background Trigger History (Fix 6) ────────────────────────────────────

app.get("/api/triggers/recent", (_req, res) => {
  // Return last 24h of background trigger checks
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = backgroundTriggerLog.filter((e) => e.timestamp >= cutoff);
  res.json({
    success: true,
    events: recent,
    total: recent.length,
    triggered: recent.filter((e) => e.triggered).length,
  });
});

app.get("/api/weather/forecast", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Mumbai";
    const weather = await getWeatherData(city);
    const forecast = get7DayForecast(weather);

    // Also fetch AQI for the forecast page
    const aqiData = await getAQIData(city);
    const aqiResult = evaluateAQITrigger(aqiData);

    res.json({
      success: true,
      currentWeather: weather,
      currentAQI: aqiData,
      aqiTriggered: aqiResult.triggered,
      forecast,
      expectedClaims: forecast.filter(d => d.riskLevel === "high").length * 12 + forecast.filter(d => d.riskLevel === "medium").length * 5,
      riskZones: [
        { zone: "Andheri East", level: weather.rain > 15 ? "high" : "medium" },
        { zone: "Kurla West", level: weather.rain > 20 ? "high" : weather.rain > 10 ? "medium" : "low" },
        { zone: "Bandra", level: weather.temp > 38 ? "high" : "low" },
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Forecast fetch failed" });
  }
});

// ── Financial Sustainability Endpoint (Fix 4) ─────────────────────────────

app.get("/api/admin/sustainability", async (_req, res) => {
  try {
    // Gather claim data from MongoDB or in-memory
    let claimData: { payout: number; status: string }[] = [];
    try {
      const claims = await Claim.find().select("payout status").lean();
      claimData = claims.map((c: any) => ({
        payout: c.payout || 0,
        status: c.status || "APPROVED",
      }));
    } catch {
      claimData = (inMemoryClaims as any[]).map((c: any) => ({
        payout: c.payout || 0,
        status: c.status || "APPROVED",
      }));
    }

    // If no real claims, inject some baseline assumptions for meaningful output
    if (claimData.length === 0) {
      claimData = [
        { payout: 680, status: "APPROVED" },
        { payout: 450, status: "APPROVED" },
        { payout: 720, status: "REJECTED" },
        { payout: 380, status: "APPROVED" },
        { payout: 550, status: "APPROVED" },
        { payout: 680, status: "REJECTED" },
        { payout: 450, status: "APPROVED" },
        { payout: 380, status: "APPROVED" },
      ];
    }

    const metrics = computeSustainabilityMetrics(claimData);
    res.json({ success: true, ...metrics });
  } catch (error) {
    console.error("[Sustainability] Error:", error);
    res.status(500).json({ success: false, error: "Sustainability computation failed" });
  }
});

// ── Background Scheduler (Fix 6) ──────────────────────────────────────────
// Runs every 5 minutes, checks triggers for active policy zones
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
const MONITORED_CITIES = ["Mumbai", "Delhi", "Bangalore"];

async function runBackgroundTriggerCheck() {
  for (const city of MONITORED_CITIES) {
    try {
      const weather = await getWeatherData(city);
      const evaluation = await evaluateAllTriggers(weather, city);

      const event: BackgroundTriggerEvent = {
        timestamp: new Date().toISOString(),
        city,
        triggered: evaluation.triggered,
        riskScore: evaluation.riskScore,
        riskLevel: evaluation.riskLevel,
        triggerType: evaluation.triggerType,
        triggerLabel: evaluation.triggerLabel,
        triggerPayout: evaluation.triggerPayout,
        activeTriggersCount: evaluation.activeTriggersCount,
        weatherSummary: `${weather.condition} | Rain: ${weather.rain}mm | Temp: ${weather.temp}°C`,
      };

      backgroundTriggerLog.push(event);

      // Keep only last 288 entries (24h at 5-min intervals × 3 cities)
      while (backgroundTriggerLog.length > 288) {
        backgroundTriggerLog.shift();
      }

      if (evaluation.triggered) {
        console.log(`[Scheduler] ⚡ TRIGGER DETECTED in ${city}: ${evaluation.triggerLabel} (risk: ${evaluation.riskScore})`);
      }
    } catch (err: any) {
      console.log(`[Scheduler] Error checking ${city}: ${err.message}`);
    }
  }
}

// Start the scheduler after server boots
setTimeout(() => {
  console.log("[Scheduler] Background trigger monitoring started (every 5 min)");
  runBackgroundTriggerCheck(); // Initial check
  setInterval(runBackgroundTriggerCheck, SCHEDULER_INTERVAL_MS);
}, 3000);

app.listen(PORT, () => {
  console.log(`GigShield Backend running on http://localhost:${PORT}`);
});
