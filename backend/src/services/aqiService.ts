/**
 * AQI Service — Production Air Quality Integration
 *
 * Primary: WAQI.info API (token from env var)
 * Fallback: Simulated data calibrated to Indian city baselines
 */

import { getPincodeLocation } from "./pincodeService";

export interface AQIData {
  aqi: number;
  dominant: string;
  station: string;
  city: string;
  isLive: boolean;
  fetchedAt: string;
}

export interface AQITriggerResult {
  triggered: boolean;
  aqi: number;
  threshold: number;
  riskLevel: "GOOD" | "MODERATE" | "UNHEALTHY_SG" | "UNHEALTHY" | "VERY_UNHEALTHY" | "HAZARDOUS";
  payout: number;
  data: AQIData;
}

// ── Config ───────────────────────────────────────────────────────────────────
const WAQI_TOKEN = process.env.WAQI_API_TOKEN || "demo";
const AQI_TRIGGER_THRESHOLD = 200;
const AQI_BASE_PAYOUT = 380;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const AQI_CITY_MAP: Record<string, string> = {
  mumbai: "mumbai", delhi: "delhi", bangalore: "bangalore", chennai: "chennai",
  kolkata: "kolkata", hyderabad: "hyderabad", pune: "pune", jaipur: "jaipur",
  lucknow: "lucknow", chandigarh: "chandigarh",
};

// ── Cache ────────────────────────────────────────────────────────────────────
const aqiCache: Map<string, { data: AQIData; expires: number }> = new Map();

function getCached(key: string): AQIData | null {
  const entry = aqiCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  aqiCache.delete(key);
  return null;
}

// ── Indian city AQI baselines (calibrated to real averages) ──────────────────
const CITY_AQI_BASELINE: Record<string, number> = {
  delhi: 220, lucknow: 180, kolkata: 150, mumbai: 100,
  chennai: 80, bangalore: 70, hyderabad: 90, pune: 85,
  jaipur: 130, chandigarh: 100,
};

function classifyAQI(aqi: number): AQITriggerResult["riskLevel"] {
  if (aqi <= 50) return "GOOD";
  if (aqi <= 100) return "MODERATE";
  if (aqi <= 150) return "UNHEALTHY_SG";
  if (aqi <= 200) return "UNHEALTHY";
  if (aqi <= 300) return "VERY_UNHEALTHY";
  return "HAZARDOUS";
}

function getSimulatedAQI(city: string): AQIData {
  const base = CITY_AQI_BASELINE[city.toLowerCase()] || 100;
  const noise = Math.floor(Math.random() * 50) - 25;
  const aqi = Math.max(20, Math.min(450, base + noise));
  const pollutants = ["pm25", "pm10", "o3", "no2"];
  return {
    aqi, dominant: pollutants[Math.floor(Math.random() * pollutants.length)],
    station: `${city} Central (Simulated)`, city, isLive: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getAQIData(city: string = "mumbai", pincode?: string): Promise<AQIData> {
  const cacheKey = pincode || city.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let fetchUrl = "";
  let resolvedCity = city;

  if (pincode) {
    const loc = getPincodeLocation(pincode);
    resolvedCity = loc.city;
    fetchUrl = `https://api.waqi.info/feed/geo:${loc.lat};${loc.lon}/?token=${WAQI_TOKEN}`;
  } else {
    const slug = AQI_CITY_MAP[city.toLowerCase().trim()] || city.toLowerCase().trim();
    fetchUrl = `https://api.waqi.info/feed/${encodeURIComponent(slug)}/?token=${WAQI_TOKEN}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return getSimulatedAQI(resolvedCity);

    const json: any = await res.json();
    if (json.status !== "ok" || !json.data) return getSimulatedAQI(resolvedCity);

    const d = json.data;
    const result: AQIData = {
      aqi: typeof d.aqi === "number" ? d.aqi : 50,
      dominant: d.dominentpol || "pm25",
      station: d.city?.name || `${resolvedCity} Monitor`,
      city: resolvedCity, isLive: true,
      fetchedAt: new Date().toISOString(),
    };

    aqiCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err: any) {
    console.log(`[AQI] Fetch failed (${err.message}) — using simulated`);
    return getSimulatedAQI(resolvedCity);
  }
}

export function evaluateAQITrigger(data: AQIData): AQITriggerResult {
  const riskLevel = classifyAQI(data.aqi);
  const triggered = data.aqi >= AQI_TRIGGER_THRESHOLD;
  let payout = 0;
  if (triggered) {
    const severity = Math.min((data.aqi - AQI_TRIGGER_THRESHOLD) / 200, 1.0);
    payout = Math.round(AQI_BASE_PAYOUT * (1.0 + severity * 0.5));
  }
  return { triggered, aqi: data.aqi, threshold: AQI_TRIGGER_THRESHOLD, riskLevel, payout, data };
}
