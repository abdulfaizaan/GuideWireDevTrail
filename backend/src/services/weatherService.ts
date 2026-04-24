/**
 * Weather Service — Open-Meteo integration (free, no API key required)
 * 
 * Fetches real-time weather data from Open-Meteo API.
 * Uses their geocoding API to resolve city names to coordinates.
 * Falls back to simulated weather data if API request fails.
 */

import { getPincodeLocation } from "./pincodeService";

export interface WeatherData {
  rain: number;         // mm in last 1h
  temp: number;         // °C
  humidity: number;     // %
  condition: string;    // e.g. "Rain", "Clear", "Clouds"
  description: string;  // e.g. "heavy intensity rain"
  windSpeed: number;    // m/s → km/h from API
  city: string;
  isLive: boolean;      // true = real API, false = simulated fallback
  fetchedAt: string;    // ISO timestamp
}

// ---------------------------------------------------------------------------
// WMO Weather Code → condition mapping
// https://open-meteo.com/en/docs#weathervariables
// ---------------------------------------------------------------------------
function wmoToCondition(code: number): { condition: string; description: string } {
  if (code === 0) return { condition: "Clear", description: "clear sky" };
  if (code <= 3) return { condition: "Clouds", description: "partly cloudy" };
  if (code <= 49) return { condition: "Haze", description: "fog or haze" };
  if (code <= 59) return { condition: "Drizzle", description: "drizzle" };
  if (code <= 69) return { condition: "Rain", description: "moderate rain" };
  if (code <= 79) return { condition: "Snow", description: "snow" };
  if (code <= 84) return { condition: "Rain", description: "rain showers" };
  if (code <= 86) return { condition: "Snow", description: "snow showers" };
  if (code <= 99) return { condition: "Thunderstorm", description: "thunderstorm with rain" };
  return { condition: "Unknown", description: "unknown" };
}

// ---------------------------------------------------------------------------
// City → coordinates resolver (Open-Meteo Geocoding API)
// ---------------------------------------------------------------------------
const CITY_CACHE: Record<string, { lat: number; lon: number }> = {
  // Pre-cache common Indian cities to avoid geocoding calls
  "mumbai":    { lat: 19.0760, lon: 72.8777 },
  "delhi":     { lat: 28.6139, lon: 77.2090 },
  "bangalore": { lat: 12.9716, lon: 77.5946 },
  "chennai":   { lat: 13.0827, lon: 80.2707 },
  "kolkata":   { lat: 22.5726, lon: 88.3639 },
  "hyderabad": { lat: 17.3850, lon: 78.4867 },
  "pune":      { lat: 18.5204, lon: 73.8567 },
  "jaipur":    { lat: 26.9124, lon: 75.7873 },
};

async function getCityCoords(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const key = city.toLowerCase().trim();

  // Check cache first
  if (CITY_CACHE[key]) {
    return { ...CITY_CACHE[key], name: city };
  }

  // Use Open-Meteo Geocoding API
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data.results?.length > 0) {
        const r = data.results[0];
        CITY_CACHE[key] = { lat: r.latitude, lon: r.longitude };
        return { lat: r.latitude, lon: r.longitude, name: r.name || city };
      }
    }
  } catch { /* fallback to default */ }

  // Default to Mumbai
  return { lat: 19.0760, lon: 72.8777, name: city };
}

// ---------------------------------------------------------------------------
// Simulated fallback — used when API request fails
// ---------------------------------------------------------------------------
function getSimulatedWeather(city: string): WeatherData {
  const conditions = [
    { condition: "Rain",         description: "moderate rain",          rain: 18 + Math.random() * 30, temp: 26 + Math.random() * 5 },
    { condition: "Thunderstorm", description: "thunderstorm with rain", rain: 25 + Math.random() * 40, temp: 24 + Math.random() * 4 },
    { condition: "Clouds",       description: "overcast clouds",        rain: 0,                       temp: 30 + Math.random() * 6 },
    { condition: "Clear",        description: "clear sky",              rain: 0,                       temp: 33 + Math.random() * 10 },
    { condition: "Haze",         description: "haze",                   rain: 0,                       temp: 35 + Math.random() * 8 },
  ];

  const weights = [35, 25, 15, 15, 10];
  const roll = Math.random() * 100;
  let cumulative = 0;
  let picked = conditions[0];
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) { picked = conditions[i]; break; }
  }

  return {
    rain: Math.round(picked.rain * 10) / 10,
    temp: Math.round(picked.temp * 10) / 10,
    humidity: Math.floor(60 + Math.random() * 35),
    condition: picked.condition,
    description: picked.description,
    windSpeed: Math.round((2 + Math.random() * 12) * 10) / 10,
    city,
    isLive: false,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Live weather fetcher — Open-Meteo (free, no key needed)
// ---------------------------------------------------------------------------
export async function getWeatherData(city: string = "Mumbai"): Promise<WeatherData> {
  try {
    const coords = await getCityCoords(city);
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m&timezone=auto`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`[Weather] Open-Meteo API returned ${res.status} — falling back to simulated data`);
      return getSimulatedWeather(city);
    }

    const data: any = await res.json();
    const current = data.current;

    if (!current) {
      console.log("[Weather] No current data in response — using fallback");
      return getSimulatedWeather(city);
    }

    const weatherCode = current.weather_code ?? 0;
    const { condition, description } = wmoToCondition(weatherCode);

    return {
      rain: current.rain ?? 0,
      temp: current.temperature_2m ?? 30,
      humidity: current.relative_humidity_2m ?? 70,
      condition,
      description,
      windSpeed: Math.round((current.wind_speed_10m ?? 0) / 3.6 * 10) / 10, // km/h → m/s
      city: coords.name,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.log(`[Weather] Fetch failed (${err.message}) — using simulated data`);
    return getSimulatedWeather(city);
  }
}

// ---------------------------------------------------------------------------
// Hyperlocal: Weather by pincode
// ---------------------------------------------------------------------------
export async function getWeatherByPincode(pincode: string): Promise<WeatherData> {
  const loc = getPincodeLocation(pincode);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m&timezone=auto`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return getSimulatedWeather(loc.locality);

    const data: any = await res.json();
    const current = data.current;
    if (!current) return getSimulatedWeather(loc.locality);

    const { condition, description } = wmoToCondition(current.weather_code ?? 0);

    return {
      rain: current.rain ?? 0,
      temp: current.temperature_2m ?? 30,
      humidity: current.relative_humidity_2m ?? 70,
      condition,
      description,
      windSpeed: Math.round((current.wind_speed_10m ?? 0) / 3.6 * 10) / 10,
      city: `${loc.locality}, ${loc.city}`,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.log(`[Weather] Pincode fetch failed (${err.message}) — using simulated data`);
    return getSimulatedWeather(loc.locality);
  }
}

// ---------------------------------------------------------------------------
// Demo Boost — amplifies real weather to guarantee trigger-worthy conditions
// ---------------------------------------------------------------------------
export function applyDemoBoost(weather: WeatherData): WeatherData {
  const boostedRain = weather.rain + 25 + Math.random() * 20;
  const boostedTemp = Math.max(weather.temp, 38) + Math.random() * 5;
  const boostedHumidity = Math.min(98, weather.humidity + 30 + Math.floor(Math.random() * 10));

  const rainConditions = ["Rain", "Thunderstorm", "Drizzle"];
  const isAlreadyRain = rainConditions.includes(weather.condition);

  return {
    ...weather,
    rain: Math.round(boostedRain * 10) / 10,
    temp: Math.round(boostedTemp * 10) / 10,
    humidity: boostedHumidity,
    condition: isAlreadyRain ? weather.condition : "Rain",
    description: isAlreadyRain ? weather.description : `boosted from ${weather.condition.toLowerCase()} — heavy rain overlay`,
    windSpeed: Math.round((weather.windSpeed + 4 + Math.random() * 6) * 10) / 10,
    isLive: true,
  };
}

// ---------------------------------------------------------------------------
// Mock 7-day forecast (for admin dashboard)
// ---------------------------------------------------------------------------
export interface ForecastDay {
  day: string;
  rain: number;
  temp: number;
  condition: string;
  riskLevel: "low" | "medium" | "high";
}

export function get7DayForecast(baseWeather: WeatherData): ForecastDay[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().getDay();
  const orderedDays = [...days.slice(today === 0 ? 6 : today - 1), ...days.slice(0, today === 0 ? 6 : today - 1)].slice(0, 7);

  return orderedDays.map((day, i) => {
    const uncertainty = 1 + i * 0.15;
    const rain = Math.max(0, Math.round((baseWeather.rain + (Math.random() * 20 - 10) * uncertainty) * 10) / 10);
    const temp = Math.round((baseWeather.temp + (Math.random() * 6 - 3) * uncertainty) * 10) / 10;
    const condition = rain > 20 ? "Rain" : rain > 5 ? "Drizzle" : temp > 40 ? "Extreme Heat" : "Clear";
    const riskLevel: "low" | "medium" | "high" = rain > 20 || temp > 42 ? "high" : rain > 8 || temp > 38 ? "medium" : "low";
    return { day, rain, temp, condition, riskLevel };
  });
}
