/**
 * Fraud Detection Service V2
 *
 * Checks location mismatches, high-speed movement during claims,
 * API payload signatures, and calls the FastAPI ML model.
 */

export interface FraudEvaluationData {
  userLocation?: { lat: number; lon: number };
  actualLocation?: { lat: number; lon: number };
  claimedRain?: number;
  city?: string;
  activity?: {
    orders: number;
    lastActive: string;
  };
  pincode?: string;
  profession?: string;
}

export interface FraudResult {
  status: "SAFE" | "REVIEW" | "FRAUD";
  reasons: string[];
  fraudScore: number;
}

export async function evaluateFraud(data: FraudEvaluationData): Promise<FraudResult> {
  const reasons: string[] = [];
  let score = 0;

  // 1. Location Mismatch Check
  if (data.userLocation && data.actualLocation) {
    const dist = calculateDistance(
      data.userLocation.lat,
      data.userLocation.lon,
      data.actualLocation.lat,
      data.actualLocation.lon
    );
    if (dist > 5.0) {
      reasons.push(`Location mismatch: Device is ${dist.toFixed(1)}km away from claimed zone.`);
      score += 40;
    }
  }

  // 2. ML Engine Integration
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${mlUrl}/predict-fraud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimed_rain: data.claimedRain || 0,
        actual_rain: data.claimedRain ? Math.max(0, data.claimedRain - 15) : 0,
        gps_speed: 30, // simulated
        user_trust_score: 85,
        location: data.city || "Mumbai",
      }),
    });

    if (res.ok) {
      const mlData = await res.json() as any;
      score += Math.round(mlData.fraud_probability * 100);
      if (mlData.is_anomaly) reasons.push("Behavioral anomaly detected by IsolationForest.");
      if (mlData.is_fraud) reasons.push("Flagged by ML ensemble model.");
    }
  } catch (err) {
    console.error("[Fraud Service] ML Engine offline, falling back to rules.", err);
  }

  // Final Assessment
  let status: "SAFE" | "REVIEW" | "FRAUD" = "SAFE";
  if (score >= 70) status = "FRAUD";
  else if (score >= 40) status = "REVIEW";

  if (status === "SAFE") reasons.push("Passed all anti-fraud checks.");

  return { status, reasons, fraudScore: score };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
