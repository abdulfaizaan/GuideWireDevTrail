/**
 * Trigger Engine — Unified parametric evaluation
 * 
 * Evaluates ALL disruption triggers in one pass:
 *   1. Weather (rain, heat, humidity) — Open-Meteo oracle
 *   2. Air Quality (AQI) — WAQI.info oracle
 *   3. Platform Outage — weather-infrastructure correlation
 *   4. Civil Bandh — gazette feed
 *
 * The highest-severity trigger determines the primary payout.
 * Multiple triggers can fire simultaneously (compounding risk).
 */

import type { WeatherData } from "./weatherService";
import { getAQIData, evaluateAQITrigger, type AQITriggerResult } from "./aqiService";
import { evaluateOutageTrigger, evaluateBandhTrigger, type DisruptionResult } from "./disruptionService";

// ---------------------------------------------------------------------------
// Weather thresholds (unchanged from original)
// ---------------------------------------------------------------------------
const WEATHER_THRESHOLDS = {
  rain:    { field: "rain" as const, min: 20, envWeight: 40, label: "Heavy Rain",          icon: "🌧️", payout: 680 },
  heat:    { field: "temp" as const, min: 40, envWeight: 30, label: "Extreme Heat",        icon: "🌡️", payout: 450 },
  humidity:{ field: "humidity" as const, min: 85, envWeight: 15, label: "High Humidity",    icon: "💧", payout: 380 },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TriggerResult {
  triggered: boolean;
  riskScore: number;                           // 0–100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  triggerType: string | null;                  // which trigger matched, if any
  triggerLabel: string | null;
  triggerIcon: string | null;
  triggerPayout: number;
  envScore: number;
  activityDrop: number;                        // simulated activity disruption %
  weather: WeatherData;
  breakdown: TriggerBreakdown[];
  evaluatedAt: string;

  // New: multi-trigger data
  aqiResult?: AQITriggerResult;
  outageResult?: DisruptionResult;
  bandhResult?: DisruptionResult;
  activeTriggersCount: number;
}

export interface TriggerBreakdown {
  factor: string;
  value: number;
  threshold: number;
  exceeded: boolean;
  contribution: number;
}

// ---------------------------------------------------------------------------
// Activity drop simulator
// ---------------------------------------------------------------------------
function simulateActivityDrop(weather: WeatherData, aqiTriggered: boolean, disruptionActive: boolean): number {
  // More severe weather → higher activity drop on gig platforms
  let base = 20; // baseline drop %

  if (weather.rain > 30) base += 35;
  else if (weather.rain > 15) base += 20;
  else if (weather.rain > 5) base += 10;

  if (weather.temp > 42) base += 25;
  else if (weather.temp > 38) base += 15;

  if (weather.humidity > 90) base += 10;

  if (weather.windSpeed > 10) base += 10;

  // AQI and disruption compound the activity drop
  if (aqiTriggered) base += 15;
  if (disruptionActive) base += 20;

  // Add some noise
  base += Math.floor(Math.random() * 10) - 5;

  return Math.max(0, Math.min(100, base));
}

// ---------------------------------------------------------------------------
// Income-proportional payout scaling
// ---------------------------------------------------------------------------
function scalePayoutByIncome(basePayout: number, dailyEarnings?: number): number {
  if (!dailyEarnings || dailyEarnings <= 0) return basePayout;
  const incomeFactor = Math.max(0.5, Math.min(2.5, dailyEarnings / 500));
  return Math.round(basePayout * incomeFactor);
}

// ---------------------------------------------------------------------------
// Core unified trigger evaluation
// ---------------------------------------------------------------------------
export function evaluateWeatherTrigger(weather: WeatherData, dailyEarnings?: number): TriggerResult {
  let envScore = 0;
  let primaryTriggerType: string | null = null;
  let primaryTriggerLabel: string | null = null;
  let primaryTriggerIcon: string | null = null;
  let primaryTriggerPayout = 0;
  let maxContribution = 0;

  const breakdown: TriggerBreakdown[] = [];

  // Evaluate each weather threshold
  for (const [key, config] of Object.entries(WEATHER_THRESHOLDS)) {
    const value = weather[config.field];
    const exceeded = value >= config.min;
    const contribution = exceeded ? config.envWeight : Math.round((value / config.min) * config.envWeight * 0.3);

    envScore += contribution;

    breakdown.push({
      factor: config.label,
      value,
      threshold: config.min,
      exceeded,
      contribution,
    });

    // Track the strongest trigger
    if (exceeded && contribution > maxContribution) {
      maxContribution = contribution;
      primaryTriggerType = key;
      primaryTriggerLabel = config.label;
      primaryTriggerIcon = config.icon;
      primaryTriggerPayout = scalePayoutByIncome(config.payout, dailyEarnings);
    }
  }

  // Cap env score at 100
  envScore = Math.min(100, envScore);

  // Simulate activity disruption
  const activityDrop = simulateActivityDrop(weather, false, false);

  // Combined risk score
  const riskScore = Math.round(0.5 * envScore + 0.5 * activityDrop);

  // Risk level classification
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (riskScore >= 75) riskLevel = "CRITICAL";
  else if (riskScore >= 50) riskLevel = "HIGH";
  else if (riskScore >= 30) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  // A trigger fires when risk exceeds 50 AND at least one threshold was breached
  const triggered = riskScore > 50 && primaryTriggerType !== null;

  return {
    triggered,
    riskScore,
    riskLevel,
    triggerType: triggered ? primaryTriggerType : null,
    triggerLabel: triggered ? primaryTriggerLabel : null,
    triggerIcon: triggered ? primaryTriggerIcon : null,
    triggerPayout: triggered ? primaryTriggerPayout : 0,
    envScore,
    activityDrop,
    weather,
    breakdown,
    evaluatedAt: new Date().toISOString(),
    activeTriggersCount: triggered ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Full multi-trigger evaluation (weather + AQI + disruptions)
// ---------------------------------------------------------------------------
export async function evaluateAllTriggers(
  weather: WeatherData,
  city: string = "Mumbai",
  dailyEarnings?: number,
  pincode?: string
): Promise<TriggerResult> {
  // Start with weather evaluation
  const base = evaluateWeatherTrigger(weather, dailyEarnings);

  // Fetch AQI data
  const aqiData = await getAQIData(city, pincode);
  const aqiResult = evaluateAQITrigger(aqiData);

  // Evaluate disruptions
  const outageResult = evaluateOutageTrigger(weather, city, pincode);
  const bandhResult = evaluateBandhTrigger(city, pincode);

  // Add AQI to breakdown
  base.breakdown.push({
    factor: "Air Quality (AQI)",
    value: aqiData.aqi,
    threshold: 200,
    exceeded: aqiResult.triggered,
    contribution: aqiResult.triggered ? 20 : Math.round((aqiData.aqi / 200) * 20 * 0.3),
  });

  // Add outage to breakdown
  base.breakdown.push({
    factor: "Platform Outage",
    value: Math.round(outageResult.confidence * 100),
    threshold: 50,
    exceeded: outageResult.active,
    contribution: outageResult.active ? 15 : 0,
  });

  // Add bandh to breakdown
  base.breakdown.push({
    factor: "Civil Disruption",
    value: bandhResult.active ? 100 : 0,
    threshold: 50,
    exceeded: bandhResult.active,
    contribution: bandhResult.active ? 25 : 0,
  });

  // Recompute env score with all factors
  const extraEnv = (aqiResult.triggered ? 20 : 0) + (outageResult.active ? 15 : 0) + (bandhResult.active ? 25 : 0);
  base.envScore = Math.min(100, base.envScore + extraEnv);

  // Recompute activity drop with all factors
  base.activityDrop = simulateActivityDrop(weather, aqiResult.triggered, outageResult.active || bandhResult.active);

  // Recompute risk score
  base.riskScore = Math.round(0.5 * base.envScore + 0.5 * base.activityDrop);

  // Recompute risk level
  if (base.riskScore >= 75) base.riskLevel = "CRITICAL";
  else if (base.riskScore >= 50) base.riskLevel = "HIGH";
  else if (base.riskScore >= 30) base.riskLevel = "MEDIUM";
  else base.riskLevel = "LOW";

  // Determine the highest payout trigger across all categories
  const candidates: { type: string; label: string; icon: string; payout: number }[] = [];

  if (base.triggered && base.triggerType) {
    candidates.push({
      type: base.triggerType,
      label: base.triggerLabel!,
      icon: base.triggerIcon!,
      payout: base.triggerPayout,
    });
  }

  if (aqiResult.triggered) {
    candidates.push({
      type: "aqi",
      label: `Air Quality Crisis (AQI ${aqiData.aqi})`,
      icon: "😷",
      payout: scalePayoutByIncome(aqiResult.payout, dailyEarnings),
    });
  }

  if (outageResult.active) {
    const outagePayout = outageResult.severity === "full" ? 800 : outageResult.severity === "partial" ? 300 : 0;
    candidates.push({
      type: "outage",
      label: "Platform Outage",
      icon: "📵",
      payout: scalePayoutByIncome(outagePayout, dailyEarnings),
    });
  }

  if (bandhResult.active) {
    const bandhPayout = bandhResult.severity === "full" ? 800 : bandhResult.severity === "partial" ? 300 : 0;
    candidates.push({
      type: "bandh",
      label: "Civil Bandh",
      icon: "🚫",
      payout: scalePayoutByIncome(bandhPayout, dailyEarnings),
    });
  }

  // Pick highest payout
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.payout - a.payout);
    const winner = candidates[0];
    base.triggered = true;
    base.triggerType = winner.type;
    base.triggerLabel = winner.label;
    base.triggerIcon = winner.icon;
    base.triggerPayout = winner.payout;
  } else {
    base.triggered = base.riskScore > 50;
  }

  // Attach sub-results
  base.aqiResult = aqiResult;
  base.outageResult = outageResult;
  base.bandhResult = bandhResult;
  base.activeTriggersCount = candidates.length;

  return base;
}
