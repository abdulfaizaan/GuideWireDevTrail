import { NextRequest, NextResponse } from "next/server";
import { get7DayForecast, getWeatherData } from "../../../../lib/weather-oracle";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") || "Mumbai";
  const weather = await getWeatherData(city);
  const forecast = get7DayForecast(weather);

  return NextResponse.json({
    success: true,
    currentWeather: weather,
    forecast,
    expectedClaims:
      forecast.filter((day) => day.riskLevel === "high").length * 12 +
      forecast.filter((day) => day.riskLevel === "medium").length * 5,
    riskZones: [
      { zone: "Andheri East", level: weather.rain > 15 ? "high" : "medium" },
      { zone: "Kurla West", level: weather.rain > 20 ? "high" : weather.rain > 10 ? "medium" : "low" },
      { zone: "Bandra", level: weather.temp > 38 ? "high" : "low" },
    ],
  });
}
