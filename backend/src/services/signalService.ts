/**
 * Signal Service — Unified Disruption Signal Aggregator
 *
 * Aggregates all disruption signals per zone into a single response:
 *   - Weather (Open-Meteo)
 *   - AQI (WAQI / OpenAQ)
 *   - Power Outage (admin + heuristic)
 *   - Bandh / Strike (admin + feeds)
 *
 * Caches results with configurable TTL to avoid API spam.
 */

import { getWeatherData, getWeatherByPincode, type WeatherData } from "./weatherService";
import { getAQIData, type AQIData } from "./aqiService";
import { evaluateOutageTrigger, evaluateBandhTrigger, type DisruptionResult } from "./disruptionService";
import { getPincodeLocation } from "./pincodeService";

export interface ZoneSignal {
  zone_id: string;
  weather: {
    rain: number;
    temp: number;
    humidity: number;
    wind_speed: number;
    condition: string;
    is_live: boolean;
  };
  aqi: {
    value: number;
    dominant_pollutant: string;
    risk_level: string;
    is_live: boolean;
  };
  outage: {
    active: boolean;
    severity: string;
    source: string;
    confidence: number;
  };
  bandh: {
    active: boolean;
    severity: string;
    source: string;
    confidence: number;
  };
  confidence_score: number;
  timestamp: string;
  cached: boolean;
}

// ── In-memory signal cache ───────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const signalCache: Map<string, { data: ZoneSignal; expires: number }> = new Map();

function getCachedSignal(zoneId: string): ZoneSignal | null {
  const entry = signalCache.get(zoneId);
  if (entry && Date.now() < entry.expires) {
    return { ...entry.data, cached: true };
  }
  signalCache.delete(zoneId);
  return null;
}

function setCachedSignal(zoneId: string, data: ZoneSignal): void {
  signalCache.set(zoneId, { data, expires: Date.now() + CACHE_TTL_MS });
}

// ── Confidence computation ───────────────────────────────────────────────────
function computeConfidence(
  weather: WeatherData,
  aqi: AQIData,
  outage: DisruptionResult,
  bandh: DisruptionResult
): number {
  let score = 0;
  let weights = 0;

  // Weather confidence
  const weatherWeight = 0.35;
  score += (weather.isLive ? 0.95 : 0.40) * weatherWeight;
  weights += weatherWeight;

  // AQI confidence
  const aqiWeight = 0.25;
  score += (aqi.isLive ? 0.90 : 0.35) * aqiWeight;
  weights += aqiWeight;

  // Outage confidence
  const outageWeight = 0.20;
  score += outage.confidence * outageWeight;
  weights += outageWeight;

  // Bandh confidence
  const bandhWeight = 0.20;
  score += bandh.confidence * bandhWeight;
  weights += bandhWeight;

  return Math.round((score / weights) * 100) / 100;
}

// ── Main aggregator ──────────────────────────────────────────────────────────
export async function getZoneSignals(zoneId: string, pincode?: string): Promise<ZoneSignal> {
  // Check cache first
  const cached = getCachedSignal(zoneId);
  if (cached) return cached;

  // Resolve location
  let city = zoneId;
  if (pincode) {
    const loc = getPincodeLocation(pincode);
    city = loc.city;
  }

  // Fetch all signals in parallel
  const [weather, aqi] = await Promise.all([
    pincode ? getWeatherByPincode(pincode) : getWeatherData(city),
    getAQIData(city, pincode),
  ]);

  const outage = evaluateOutageTrigger(weather, city, pincode);
  const bandh = evaluateBandhTrigger(city, pincode);
  const confidence = computeConfidence(weather, aqi, outage, bandh);

  const signal: ZoneSignal = {
    zone_id: zoneId,
    weather: {
      rain: weather.rain,
      temp: weather.temp,
      humidity: weather.humidity,
      wind_speed: weather.windSpeed,
      condition: weather.condition,
      is_live: weather.isLive,
    },
    aqi: {
      value: aqi.aqi,
      dominant_pollutant: aqi.dominant,
      risk_level: aqi.aqi <= 50 ? "GOOD" : aqi.aqi <= 100 ? "MODERATE" :
                  aqi.aqi <= 200 ? "UNHEALTHY" : aqi.aqi <= 300 ? "VERY_UNHEALTHY" : "HAZARDOUS",
      is_live: aqi.isLive,
    },
    outage: {
      active: outage.active,
      severity: outage.severity,
      source: outage.source,
      confidence: outage.confidence,
    },
    bandh: {
      active: bandh.active,
      severity: bandh.severity,
      source: bandh.source,
      confidence: bandh.confidence,
    },
    confidence_score: confidence,
    timestamp: new Date().toISOString(),
    cached: false,
  };

  setCachedSignal(zoneId, signal);
  return signal;
}

// ── Crowdsourced outage reports ──────────────────────────────────────────────
interface OutageReport {
  zone_id: string;
  reporter_id: string;
  description: string;
  timestamp: string;
}

const outageReports: OutageReport[] = [];

export function addOutageReport(zoneId: string, reporterId: string, description: string): OutageReport {
  const report: OutageReport = {
    zone_id: zoneId,
    reporter_id: reporterId,
    description,
    timestamp: new Date().toISOString(),
  };
  outageReports.push(report);

  // Invalidate cache for this zone
  signalCache.delete(zoneId);

  // Keep only last 500 reports
  while (outageReports.length > 500) outageReports.shift();
  return report;
}

export function getOutageReports(zoneId: string, hours: number = 24): OutageReport[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return outageReports.filter(r => r.zone_id === zoneId && r.timestamp >= cutoff);
}

export function clearSignalCache(): void {
  signalCache.clear();
}
