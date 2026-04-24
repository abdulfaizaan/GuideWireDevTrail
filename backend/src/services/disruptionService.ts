/**
 * Disruption Service — Outage & Bandh Feed Integration
 *
 * Integrates municipal alerts and crowdsourced signals from the Signal Service.
 */

import type { WeatherData } from "./weatherService";
import { getDisruptionsByRegion } from "./municipalService";
import { getOutageReports } from "./signalService";
import { getPincodeLocation } from "./pincodeService";

export interface DisruptionResult {
  active: boolean;
  severity: "none" | "partial" | "full";
  source: string;
  confidence: number;
}

export function evaluateOutageTrigger(weather: WeatherData | null, city: string, pincode?: string): DisruptionResult {
  const alerts = getDisruptionsByRegion(city, "outage");
  if (alerts.length > 0) {
    const alert = alerts[0];
    return {
      active: true,
      severity: alert.severity,
      source: alert.source,
      confidence: 0.95,
    };
  }

  // Crowdsourced fallback
  let zoneId = city.toLowerCase();
  if (pincode) {
    const loc = getPincodeLocation(pincode);
    zoneId = `${loc.city.toLowerCase()}_${pincode}`;
  }
  const recentReports = getOutageReports(zoneId, 2); // last 2 hours
  
  if (recentReports.length > 10) {
    return {
      active: true,
      severity: "full",
      source: "Crowdsourced Reports",
      confidence: Math.min(recentReports.length / 50, 0.8),
    };
  } else if (recentReports.length > 3) {
    return {
      active: true,
      severity: "partial",
      source: "Crowdsourced Reports",
      confidence: 0.4,
    };
  }

  return { active: false, severity: "none", source: "No active outages", confidence: 1.0 };
}

export function evaluateBandhTrigger(city: string, pincode?: string): DisruptionResult {
  const alerts = getDisruptionsByRegion(city, "bandh");
  if (alerts.length > 0) {
    const alert = alerts[0];
    return {
      active: true,
      severity: alert.severity,
      source: alert.source,
      confidence: 0.98,
    };
  }

  return { active: false, severity: "none", source: "No active bandhs", confidence: 1.0 };
}

export function evaluateAllDisruptions(weather: WeatherData | null, city: string, pincode?: string) {
  return {
    outage: evaluateOutageTrigger(weather, city, pincode),
    bandh: evaluateBandhTrigger(city, pincode),
  };
}
