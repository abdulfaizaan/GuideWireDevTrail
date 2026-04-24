export interface WeatherData {
  rain: number;
  temp: number;
  humidity: number;
  condition: string;
  description: string;
  windSpeed: number;
  city: string;
  isLive: boolean;
  fetchedAt: string;
}

export interface TriggerBreakdown {
  factor: string;
  value: number;
  threshold: number;
  exceeded: boolean;
  contribution: number;
}

export interface TriggerResult {
  triggered: boolean;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  triggerType: string | null;
  triggerLabel: string | null;
  triggerIcon: string | null;
  triggerPayout: number;
  envScore: number;
  activityDrop: number;
  weather: WeatherData;
  breakdown: TriggerBreakdown[];
  evaluatedAt: string;
}

export interface ForecastDay {
  day: string;
  rain: number;
  temp: number;
  condition: string;
  riskLevel: "low" | "medium" | "high";
}

const THRESHOLDS = {
  rain: { field: "rain" as const, min: 20, envWeight: 40, label: "Heavy Rain", icon: "Rain", payout: 680 },
  heat: { field: "temp" as const, min: 40, envWeight: 30, label: "Extreme Heat", icon: "Heat", payout: 450 },
  humidity: { field: "humidity" as const, min: 85, envWeight: 15, label: "High Humidity", icon: "Humidity", payout: 380 },
};

const CITY_CACHE: Record<string, { lat: number; lon: number }> = {
  mumbai: { lat: 19.076, lon: 72.8777 },
  delhi: { lat: 28.6139, lon: 77.209 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  hyderabad: { lat: 17.385, lon: 78.4867 },
  pune: { lat: 18.5204, lon: 73.8567 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
};

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

async function getCityCoords(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const key = city.toLowerCase().trim();
  if (CITY_CACHE[key]) return { ...CITY_CACHE[key], name: city };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.results?.length) {
        const hit = data.results[0];
        CITY_CACHE[key] = { lat: hit.latitude, lon: hit.longitude };
        return { lat: hit.latitude, lon: hit.longitude, name: hit.name || city };
      }
    }
  } catch {}

  return { lat: 19.076, lon: 72.8777, name: city };
}

function getSimulatedWeather(city: string): WeatherData {
  const conditions = [
    { condition: "Rain", description: "moderate rain", rain: 18 + Math.random() * 30, temp: 26 + Math.random() * 5 },
    { condition: "Thunderstorm", description: "thunderstorm with rain", rain: 25 + Math.random() * 40, temp: 24 + Math.random() * 4 },
    { condition: "Clouds", description: "overcast clouds", rain: 0, temp: 30 + Math.random() * 6 },
    { condition: "Clear", description: "clear sky", rain: 0, temp: 33 + Math.random() * 10 },
    { condition: "Haze", description: "haze", rain: 0, temp: 35 + Math.random() * 8 },
  ];

  const picked = conditions[Math.floor(Math.random() * conditions.length)];
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

export async function getWeatherData(city = "Mumbai"): Promise<WeatherData> {
  try {
    const coords = await getCityCoords(city);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m&timezone=auto`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeout);

    if (!res.ok) return getSimulatedWeather(city);

    const data = await res.json();
    const current = data.current;
    if (!current) return getSimulatedWeather(city);

    const mapped = wmoToCondition(current.weather_code ?? 0);
    return {
      rain: current.rain ?? 0,
      temp: current.temperature_2m ?? 30,
      humidity: current.relative_humidity_2m ?? 70,
      condition: mapped.condition,
      description: mapped.description,
      windSpeed: Math.round(((current.wind_speed_10m ?? 0) / 3.6) * 10) / 10,
      city: coords.name,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return getSimulatedWeather(city);
  }
}

export function applyDemoBoost(weather: WeatherData): WeatherData {
  const isRainLike = ["Rain", "Thunderstorm", "Drizzle"].includes(weather.condition);

  return {
    ...weather,
    rain: Math.round((weather.rain + 25 + Math.random() * 20) * 10) / 10,
    temp: Math.round((Math.max(weather.temp, 38) + Math.random() * 5) * 10) / 10,
    humidity: Math.min(98, weather.humidity + 30 + Math.floor(Math.random() * 10)),
    condition: isRainLike ? weather.condition : "Rain",
    description: isRainLike ? weather.description : `boosted from ${weather.condition.toLowerCase()} to heavy rain`,
    windSpeed: Math.round((weather.windSpeed + 4 + Math.random() * 6) * 10) / 10,
  };
}

function simulateActivityDrop(weather: WeatherData): number {
  let base = 20;
  if (weather.rain > 30) base += 35;
  else if (weather.rain > 15) base += 20;
  else if (weather.rain > 5) base += 10;

  if (weather.temp > 42) base += 25;
  else if (weather.temp > 38) base += 15;

  if (weather.humidity > 90) base += 10;
  if (weather.windSpeed > 10) base += 10;

  base += Math.floor(Math.random() * 10) - 5;
  return Math.max(0, Math.min(100, base));
}

export function evaluateWeatherTrigger(weather: WeatherData): TriggerResult {
  let envScore = 0;
  let triggerType: string | null = null;
  let triggerLabel: string | null = null;
  let triggerIcon: string | null = null;
  let triggerPayout = 0;
  let maxContribution = 0;

  const breakdown: TriggerBreakdown[] = [];

  for (const [key, config] of Object.entries(THRESHOLDS)) {
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

    if (exceeded && contribution > maxContribution) {
      maxContribution = contribution;
      triggerType = key;
      triggerLabel = config.label;
      triggerIcon = config.icon;
      triggerPayout = config.payout;
    }
  }

  envScore = Math.min(100, envScore);
  const activityDrop = simulateActivityDrop(weather);
  const riskScore = Math.round(0.5 * envScore + 0.5 * activityDrop);

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (riskScore >= 75) riskLevel = "CRITICAL";
  else if (riskScore >= 50) riskLevel = "HIGH";
  else if (riskScore >= 30) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  const triggered = riskScore > 50 && triggerType !== null;

  return {
    triggered,
    riskScore,
    riskLevel,
    triggerType: triggered ? triggerType : null,
    triggerLabel: triggered ? triggerLabel : null,
    triggerIcon: triggered ? triggerIcon : null,
    triggerPayout: triggered ? triggerPayout : 0,
    envScore,
    activityDrop,
    weather,
    breakdown,
    evaluatedAt: new Date().toISOString(),
  };
}

export function get7DayForecast(baseWeather: WeatherData): ForecastDay[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().getDay();
  const start = today === 0 ? 6 : today - 1;
  const orderedDays = [...days.slice(start), ...days.slice(0, start)].slice(0, 7);

  return orderedDays.map((day, index) => {
    const uncertainty = 1 + index * 0.15;
    const rain = Math.max(0, Math.round((baseWeather.rain + (Math.random() * 20 - 10) * uncertainty) * 10) / 10);
    const temp = Math.round((baseWeather.temp + (Math.random() * 6 - 3) * uncertainty) * 10) / 10;
    const condition = rain > 20 ? "Rain" : rain > 5 ? "Drizzle" : temp > 40 ? "Extreme Heat" : "Clear";
    const riskLevel: "low" | "medium" | "high" = rain > 20 || temp > 42 ? "high" : rain > 8 || temp > 38 ? "medium" : "low";
    return { day, rain, temp, condition, riskLevel };
  });
}
