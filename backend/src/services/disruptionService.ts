/**
 * Disruption Service — Outage & Bandh Feed Integration
 *
 * Provides structured data feeds for non-weather disruptions:
 *   1. Platform Outage — heuristic based on weather severity + time-of-day patterns
 *   2. Civil Bandh — stub that checks a local gazette feed (demonstrates integration pattern)
 *
 * In production, these would integrate with:
 *   - Swiggy/Zomato partner APIs for outage detection
 *   - Government RSS feeds / social media NLP for bandh detection
 */

import type { WeatherData } from "./weatherService";

export interface DisruptionResult {
  active: boolean;
  type: "outage" | "bandh";
  severity: "none" | "partial" | "full";
  source: string;
  confidence: number;   // 0.0–1.0
  details: string;
  payout: number;
}

// ---------------------------------------------------------------------------
// Platform Outage Detection (heuristic)
// ---------------------------------------------------------------------------
// Real outages correlate with extreme weather, power grid stress, and peak hours.
// This heuristic approximates that pattern using live weather data.

const OUTAGE_BASE_PAYOUT = 550;

export function evaluateOutageTrigger(weather: WeatherData): DisruptionResult {
  let outageScore = 0;
  const reasons: string[] = [];

  // Heavy rain → infrastructure stress
  if (weather.rain > 40) {
    outageScore += 45;
    reasons.push(`Extreme rainfall (${weather.rain}mm) causing infrastructure stress`);
  } else if (weather.rain > 25) {
    outageScore += 25;
    reasons.push(`Heavy rainfall (${weather.rain}mm) may impact platform uptime`);
  }

  // High wind → cell tower / power disruption
  if (weather.windSpeed > 15) {
    outageScore += 20;
    reasons.push(`High wind speed (${weather.windSpeed} m/s) risk to connectivity`);
  }

  // Thunderstorm conditions
  if (weather.condition === "Thunderstorm") {
    outageScore += 25;
    reasons.push("Thunderstorm activity — power grid vulnerability");
  }

  // Time-of-day factor (off-peak hours = more likely to have unresolved outages)
  const hour = new Date().getHours();
  if (hour >= 1 && hour <= 5) {
    outageScore += 10;
    reasons.push("Off-peak hours — maintenance window overlap");
  }

  const active = outageScore >= 50;
  const severity: DisruptionResult["severity"] =
    outageScore >= 70 ? "full" : outageScore >= 50 ? "partial" : "none";

  return {
    active,
    type: "outage",
    severity,
    source: "Weather-Infrastructure Correlation Model",
    confidence: Math.min(outageScore / 100, 0.95),
    details: reasons.length > 0 ? reasons.join(". ") : "No significant outage indicators detected.",
    payout: active ? Math.round(OUTAGE_BASE_PAYOUT * (severity === "full" ? 1.2 : 1.0)) : 0,
  };
}

// ---------------------------------------------------------------------------
// Bandh (Civil Shutdown) Detection — gazette feed stub
// ---------------------------------------------------------------------------
// In production this would poll:
//   - State government gazette feeds
//   - Social media trend APIs (Twitter/X trending #bandh)
//   - News aggregator RSS feeds
//   - Manual override from admin panel

const BANDH_BASE_PAYOUT = 720;

// Simulated gazette — in production, this would be fetched from an external source
const GAZETTE_FEED = [
  { date: "2026-04-26", region: "mumbai", type: "Maharashtra Bandh", severity: "full" as const, source: "State Government Gazette" },
  { date: "2026-05-01", region: "all", type: "May Day Strike", severity: "partial" as const, source: "Labour Union Coalition" },
];

export function evaluateBandhTrigger(city: string = "mumbai"): DisruptionResult {
  const today = new Date().toISOString().split("T")[0];
  const cityKey = city.toLowerCase().trim();

  // Check gazette feed for active bandh
  const activeBandh = GAZETTE_FEED.find(
    (entry) =>
      entry.date === today &&
      (entry.region === "all" || entry.region === cityKey)
  );

  if (activeBandh) {
    return {
      active: true,
      type: "bandh",
      severity: activeBandh.severity,
      source: activeBandh.source,
      confidence: 0.90,
      details: `${activeBandh.type} declared for ${activeBandh.date}. Source: ${activeBandh.source}. Gig platform activity expected to drop 80–100%.`,
      payout: Math.round(BANDH_BASE_PAYOUT * (activeBandh.severity === "full" ? 1.0 : 0.75)),
    };
  }

  return {
    active: false,
    type: "bandh",
    severity: "none",
    source: "Government Gazette Feed + News API",
    confidence: 0.0,
    details: "No active bandh or civil shutdown declarations found for this region.",
    payout: 0,
  };
}

// ---------------------------------------------------------------------------
// Combined disruption evaluation
// ---------------------------------------------------------------------------
export interface CombinedDisruptionResult {
  outage: DisruptionResult;
  bandh: DisruptionResult;
  anyActive: boolean;
  highestPayout: number;
  primaryDisruption: DisruptionResult | null;
}

export function evaluateAllDisruptions(
  weather: WeatherData,
  city: string = "mumbai"
): CombinedDisruptionResult {
  const outage = evaluateOutageTrigger(weather);
  const bandh = evaluateBandhTrigger(city);

  const anyActive = outage.active || bandh.active;
  const primary = bandh.active ? bandh : outage.active ? outage : null;

  return {
    outage,
    bandh,
    anyActive,
    highestPayout: Math.max(outage.payout, bandh.payout),
    primaryDisruption: primary,
  };
}
