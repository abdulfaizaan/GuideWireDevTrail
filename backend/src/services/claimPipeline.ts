/**
 * Claim Pipeline — Orchestrated Instant Claim Processing
 *
 * Pipeline stages:
 *   1. Trigger validation (oracle check)
 *   2. Waiting period check
 *   3. Fraud detection (ML + rules)
 *   4. Payout calculation (dynamic)
 *   5. Transfer initiation
 *   6. Notification
 *
 * Target: < 3 minutes end-to-end
 */

import { calculatePayout, computeSeverity, type PayoutResult } from "./payoutEngine";
import { checkWaitingPeriod, getPolicyAgePenalty, type WaitingCheckResult } from "./waitingPeriodService";
import { evaluateFraud, type FraudEvaluationData } from "./fraudService";
import { getWeatherData, type WeatherData } from "./weatherService";

export interface ClaimPipelineInput {
  claim_id: string;
  user_id: string;
  city: string;
  pincode?: string;
  trigger_type: string;
  profession: string;
  daily_income: number;
  plan_tier: string;
  enrolled_at: string;
  // Fraud inputs
  user_location?: { lat: number; lon: number };
  actual_location?: { lat: number; lon: number };
  claimed_rain?: number;
  gps_speed?: number;
  user_trust_score?: number;
  activity?: { orders: number; lastActive: string };
  demo_mode?: boolean;
}

export interface PipelineStage {
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  duration_ms: number;
  details: string;
}

export interface ClaimPipelineResult {
  claim_id: string;
  final_status: "APPROVED" | "REJECTED" | "REVIEW" | "HOLD";
  payout_amount: number;
  fraud_score: number;
  stages: PipelineStage[];
  total_duration_ms: number;
  payout_details: PayoutResult | null;
  waiting_check: WaitingCheckResult | null;
  reasons: string[];
  weather: WeatherData | null;
}

export async function runClaimPipeline(input: ClaimPipelineInput): Promise<ClaimPipelineResult> {
  const stages: PipelineStage[] = [];
  const reasons: string[] = [];
  let finalStatus: ClaimPipelineResult["final_status"] = "APPROVED";
  let payoutAmount = 0;
  let fraudScore = 0;
  let payoutDetails: PayoutResult | null = null;
  let waitingCheck: WaitingCheckResult | null = null;
  let weather: WeatherData | null = null;
  const pipelineStart = Date.now();

  // ── Stage 1: Oracle Validation ─────────────────────────────────────────────
  const s1Start = Date.now();
  try {
    weather = await getWeatherData(input.city);
    const triggerType = input.trigger_type.toLowerCase();

    let oracleValid = true;
    if (triggerType.includes("rain") && weather.rain < 15) {
      oracleValid = false;
      reasons.push(`Oracle: Rainfall ${weather.rain}mm below 15mm threshold.`);
    } else if (triggerType.includes("heat") && weather.temp < 38) {
      oracleValid = false;
      reasons.push(`Oracle: Temperature ${weather.temp}°C below 38°C threshold.`);
    }

    if (!oracleValid && !input.demo_mode) {
      finalStatus = "REJECTED";
    }

    stages.push({
      name: "Oracle Validation",
      status: oracleValid || input.demo_mode ? "PASS" : "FAIL",
      duration_ms: Date.now() - s1Start,
      details: `${weather.condition} | Rain: ${weather.rain}mm | Temp: ${weather.temp}°C | Live: ${weather.isLive}`,
    });
  } catch (err: any) {
    stages.push({
      name: "Oracle Validation",
      status: "WARN",
      duration_ms: Date.now() - s1Start,
      details: `Oracle fetch failed: ${err.message}. Proceeding with caution.`,
    });
  }

  // ── Stage 2: Waiting Period ────────────────────────────────────────────────
  const s2Start = Date.now();
  if (input.enrolled_at) {
    waitingCheck = checkWaitingPeriod(input.enrolled_at, input.trigger_type);
    if (!waitingCheck.allowed && !input.demo_mode) {
      finalStatus = "REJECTED";
      reasons.push(waitingCheck.message);
    }
    stages.push({
      name: "Waiting Period",
      status: waitingCheck.allowed || input.demo_mode ? "PASS" : "FAIL",
      duration_ms: Date.now() - s2Start,
      details: waitingCheck.message,
    });
  } else {
    stages.push({
      name: "Waiting Period",
      status: "SKIP",
      duration_ms: 0,
      details: "No enrollment date provided.",
    });
  }

  // ── Stage 3: Fraud Detection ───────────────────────────────────────────────
  const s3Start = Date.now();
  if (finalStatus !== "REJECTED") {
    const fraudData: FraudEvaluationData = {
      userLocation: input.user_location,
      actualLocation: input.actual_location,
      claimedRain: input.claimed_rain,
      city: input.city,
      activity: input.activity,
    };

    let fraudResult = await evaluateFraud(fraudData);

    if (input.demo_mode) {
      fraudResult = { status: "SAFE", reasons: ["Demo mode — bypassed"], fraudScore: 2 };
    }

    fraudScore = fraudResult.fraudScore;
    if (fraudResult.status === "FRAUD") {
      finalStatus = "REJECTED";
      reasons.push(...fraudResult.reasons);
    }

    stages.push({
      name: "Fraud Detection",
      status: fraudResult.status === "FRAUD" ? "FAIL" : "PASS",
      duration_ms: Date.now() - s3Start,
      details: `Score: ${fraudScore} | ${fraudResult.reasons.join("; ")}`,
    });
  } else {
    stages.push({
      name: "Fraud Detection",
      status: "SKIP",
      duration_ms: 0,
      details: "Skipped — claim already rejected.",
    });
  }

  // ── Stage 4: Payout Calculation ────────────────────────────────────────────
  const s4Start = Date.now();
  if (finalStatus === "APPROVED") {
    const severityValue = weather
      ? computeSeverity(input.trigger_type, weather.rain || weather.temp)
      : undefined;

    payoutDetails = calculatePayout({
      profession: input.profession,
      daily_income: input.daily_income,
      trigger_type: input.trigger_type,
      plan_tier: input.plan_tier,
      severity_override: severityValue,
    });

    // Apply policy age penalty
    const agePenalty = getPolicyAgePenalty(input.enrolled_at);
    payoutAmount = Math.round(payoutDetails.amount * agePenalty.modifier);
    if (agePenalty.message) {
      reasons.push(agePenalty.message);
    }

    stages.push({
      name: "Payout Calculation",
      status: "PASS",
      duration_ms: Date.now() - s4Start,
      details: payoutDetails.formula + (agePenalty.modifier < 1 ? ` (age penalty: ×${agePenalty.modifier})` : ""),
    });
  } else {
    stages.push({
      name: "Payout Calculation",
      status: "SKIP",
      duration_ms: 0,
      details: "Skipped — claim rejected.",
    });
  }

  // ── Stage 5: Transfer ──────────────────────────────────────────────────────
  stages.push({
    name: "Transfer",
    status: finalStatus === "APPROVED" ? "PASS" : "SKIP",
    duration_ms: 0,
    details: finalStatus === "APPROVED" ? `₹${payoutAmount} queued for transfer.` : "No transfer — claim not approved.",
  });

  // ── Stage 6: Notification ──────────────────────────────────────────────────
  stages.push({
    name: "Notification",
    status: "PASS",
    duration_ms: 0,
    details: `User ${input.user_id} notified. Status: ${finalStatus}.`,
  });

  if (finalStatus === "APPROVED" && reasons.length === 0) {
    reasons.push("Claim verified. All pipeline stages passed.");
  }

  return {
    claim_id: input.claim_id,
    final_status: finalStatus,
    payout_amount: payoutAmount,
    fraud_score: fraudScore,
    stages,
    total_duration_ms: Date.now() - pipelineStart,
    payout_details: payoutDetails,
    waiting_check: waitingCheck,
    reasons,
    weather,
  };
}
