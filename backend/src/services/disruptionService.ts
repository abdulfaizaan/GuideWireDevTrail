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
import { getDisruptionsByRegion } from "./municipalService";
import { getPincodeLocation } from "./pincodeService";

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

export function evaluateOutageTrigger(weather: WeatherData, city: string = "mumbai", pincode?: string): DisruptionResult {
  const region = pincode ? getPincodeLocation(pincode).locality : city;
  
  // Check exact locality first, then fallback to city
  let activeOutages = getDisruptionsByRegion(region, "outage");
  if (activeOutages.length === 0 && pincode) {
    activeOutages = getDisruptionsByRegion(city, "outage");
  }
  
  const activeOutage = activeOutages.length > 0 ? activeOutages[0] : null;

  if (activeOutage) {
    return {
      active: true,
      type: "outage",
      severity: activeOutage.severity,
      source: activeOutage.source,
      confidence: 0.95,
      details: `Municipal API reported an active outage in ${activeOutage.region}. Severity: ${activeOutage.severity}.`,
      payout: Math.round(OUTAGE_BASE_PAYOUT * (activeOutage.severity === "full" ? 1.2 : 1.0)),
    };
  }

  // Fallback to weather heuristic if no active outage reported
  let outageScore = 0;
  const reasons: string[] = [];

  if (weather.rain > 40) { outageScore += 45; reasons.push(`Extreme rainfall (${weather.rain}mm) causing infrastructure stress`); }
  else if (weather.rain > 25) { outageScore += 25; reasons.push(`Heavy rainfall (${weather.rain}mm) may impact platform uptime`); }

  if (weather.windSpeed > 15) { outageScore += 20; reasons.push(`High wind speed (${weather.windSpeed} m/s) risk to connectivity`); }
  if (weather.condition === "Thunderstorm") { outageScore += 25; reasons.push("Thunderstorm activity — power grid vulnerability"); }

  const hour = new Date().getHours();
  if (hour >= 1 && hour <= 5) { outageScore += 10; reasons.push("Off-peak hours — maintenance window overlap"); }

  const active = outageScore >= 50;
  const severity: DisruptionResult["severity"] = outageScore >= 70 ? "full" : outageScore >= 50 ? "partial" : "none";

  return {
    active,
    type: "outage",
    severity,
    source: "Weather-Infrastructure Correlation Model (Fallback)",
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

export function evaluateBandhTrigger(city: string = "mumbai", pincode?: string): DisruptionResult {
  const region = pincode ? getPincodeLocation(pincode).locality : city;
  
  // Check exact locality first, then fallback to city
  let activeBandhs = getDisruptionsByRegion(region, "bandh");
  if (activeBandhs.length === 0 && pincode) {
    activeBandhs = getDisruptionsByRegion(city, "bandh");
  }
  
  const activeBandh = activeBandhs.length > 0 ? activeBandhs[0] : null;

  if (activeBandh) {
    return {
      active: true,
      type: "bandh",
      severity: activeBandh.severity,
      source: activeBandh.source,
      confidence: 0.90,
      details: `Active Bandh declared via Municipal API for ${activeBandh.region}. Severity: ${activeBandh.severity}. Source: ${activeBandh.source}.`,
      payout: Math.round(BANDH_BASE_PAYOUT * (activeBandh.severity === "full" ? 1.0 : 0.75)),
    };
  }

  return {
    active: false,
    type: "bandh",
    severity: "none",
    source: "Municipal API",
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
  city: string = "mumbai",
  pincode?: string
): CombinedDisruptionResult {
  const outage = evaluateOutageTrigger(weather, city, pincode);
  const bandh = evaluateBandhTrigger(city, pincode);

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
