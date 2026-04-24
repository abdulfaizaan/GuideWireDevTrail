/**
 * AQI Service — Real-time Air Quality Integration
 *
 * Uses the WAQI.info (World Air Quality Index) public API as a second
 * real oracle alongside Open-Meteo weather data.
 *
 * Demo token works without registration and is sufficient for hackathon use.
 * For production, obtain a free key at https://aqicn.org/data-platform/token/
 */

export interface AQIData {
  aqi: number;               // 0–500+ USAQI scale
  dominant: string;           // dominant pollutant (pm25, pm10, o3, etc.)
  station: string;            // monitoring station name
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

// ---------------------------------------------------------------------------
// WAQI.info API — free, demo token works globally
// ---------------------------------------------------------------------------
const WAQI_TOKEN = "demo"; // replace with real token for production

const AQI_CITY_MAP: Record<string, string> = {
  mumbai: "mumbai",
  delhi: "delhi",
  bangalore: "bangalore",
  chennai: "chennai",
  kolkata: "kolkata",
  hyderabad: "hyderabad",
  pune: "pune",
  jaipur: "jaipur",
};

// ---------------------------------------------------------------------------
// AQI risk classification (US EPA standard)
// ---------------------------------------------------------------------------
function classifyAQI(aqi: number): AQITriggerResult["riskLevel"] {
  if (aqi <= 50) return "GOOD";
  if (aqi <= 100) return "MODERATE";
  if (aqi <= 150) return "UNHEALTHY_SG";
  if (aqi <= 200) return "UNHEALTHY";
  if (aqi <= 300) return "VERY_UNHEALTHY";
  return "HAZARDOUS";
}

// ---------------------------------------------------------------------------
// Simulated fallback
// ---------------------------------------------------------------------------
function getSimulatedAQI(city: string): AQIData {
  // Indian cities often have moderate-to-poor AQI
  const baseAQI = city.toLowerCase() === "delhi" ? 180 : 90;
  const noise = Math.floor(Math.random() * 60) - 30;
  const aqi = Math.max(20, Math.min(400, baseAQI + noise));

  const pollutants = ["pm25", "pm10", "o3", "no2"];
  const dominant = pollutants[Math.floor(Math.random() * pollutants.length)];

  return {
    aqi,
    dominant,
    station: `${city} Central Monitor (Simulated)`,
    city,
    isLive: false,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Live AQI fetcher
// ---------------------------------------------------------------------------
export async function getAQIData(city: string = "mumbai"): Promise<AQIData> {
  const slug = AQI_CITY_MAP[city.toLowerCase().trim()] || city.toLowerCase().trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.waqi.info/feed/${encodeURIComponent(slug)}/?token=${WAQI_TOKEN}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`[AQI] WAQI API returned ${res.status} — using simulated data`);
      return getSimulatedAQI(city);
    }

    const json: any = await res.json();
    if (json.status !== "ok" || !json.data) {
      console.log("[AQI] Unexpected response structure — using fallback");
      return getSimulatedAQI(city);
    }

    const d = json.data;
    return {
      aqi: typeof d.aqi === "number" ? d.aqi : 50,
      dominant: d.dominentpol || "pm25",
      station: d.city?.name || `${city} Monitor`,
      city,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.log(`[AQI] Fetch failed (${err.message}) — using simulated data`);
    return getSimulatedAQI(city);
  }
}

// ---------------------------------------------------------------------------
// AQI Trigger evaluation
// ---------------------------------------------------------------------------
const AQI_TRIGGER_THRESHOLD = 200; // "Unhealthy" on US EPA scale
const AQI_BASE_PAYOUT = 380;

export function evaluateAQITrigger(data: AQIData): AQITriggerResult {
  const riskLevel = classifyAQI(data.aqi);
  const triggered = data.aqi >= AQI_TRIGGER_THRESHOLD;

  // Scale payout by severity above threshold
  let payout = 0;
  if (triggered) {
    const severity = Math.min((data.aqi - AQI_TRIGGER_THRESHOLD) / 200, 1.0);
    payout = Math.round(AQI_BASE_PAYOUT * (1.0 + severity * 0.5));
  }

  return {
    triggered,
    aqi: data.aqi,
    threshold: AQI_TRIGGER_THRESHOLD,
    riskLevel,
    payout,
    data,
  };
}
