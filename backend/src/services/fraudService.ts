/**
 * Advanced Fraud Detection Engine
 * 
 * Implements rule-based validation for GigShield platform.
 * Integrates GPS, Weather Discrepancy, and Platform Activity.
 */

import { getWeatherData } from "./weatherService";

export interface Location {
  lat: number;
  lon: number;
}

export interface ActivityData {
  orders: number;
  lastActive: string;
}

export interface FraudEvaluationData {
  userLocation?: Location;
  actualLocation?: Location;
  claimedRain?: number;
  city?: string;
  activity?: ActivityData;
}

/**
 * Haversine formula to calculate distance between two coordinates in km
 */
function getDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
  const dLon = (loc2.lon - loc1.lon) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * (Math.PI / 180)) * Math.cos(loc2.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function checkGPSFraud(userLocation?: Location, actualLocation?: Location) {
  if (!userLocation || !actualLocation) return { fraud: false, score: 0 };
  
  const distance = getDistance(userLocation, actualLocation);

  // If user is > 5km away from their claimed operative zone
  if (distance > 5) {
    return { fraud: true, score: 40, reason: `GPS mismatch detected (${distance.toFixed(1)}km discrepancy)` };
  }

  return { fraud: false, score: 0 };
}

export async function checkWeatherFraud(claimedRain?: number, city: string = "Mumbai") {
  if (claimedRain === undefined || claimedRain === 0) return { fraud: false, score: 0 };

  const weather = await getWeatherData(city);

  // If they claim heavy rain but actual weather oracle says it's practically dry
  if (claimedRain > 15 && weather.rain < 5) {
    return { fraud: true, score: 30, reason: `False rain claim. Claimed ${claimedRain}mm but Oracle reported ${weather.rain}mm` };
  }

  return { fraud: false, score: 0 };
}

export function checkBehaviorFraud(activityData?: ActivityData) {
  if (!activityData) return { fraud: false, score: 0 };

  // If gig worker claims compensation for platform inactivity but delivered orders
  if (activityData.orders > 0) {
    return { fraud: true, score: 30, reason: `User active but claimed inactive. ${activityData.orders} orders processed during window.` };
  }

  return { fraud: false, score: 0 };
}

export async function evaluateFraud(data: FraudEvaluationData) {
  let totalScore = 0;
  let reasons: string[] = [];

  const gps = checkGPSFraud(data.userLocation, data.actualLocation);
  if (gps.fraud) {
    totalScore += gps.score;
    reasons.push(gps.reason);
  }

  const weather = await checkWeatherFraud(data.claimedRain, data.city);
  if (weather.fraud) {
    totalScore += weather.score;
    reasons.push(weather.reason);
  }

  const behavior = checkBehaviorFraud(data.activity);
  if (behavior.fraud) {
    totalScore += behavior.score;
    reasons.push(behavior.reason);
  }

  return {
    fraudScore: totalScore,
    status: totalScore > 50 ? "FRAUD" : "SAFE",
    reasons
  };
}
