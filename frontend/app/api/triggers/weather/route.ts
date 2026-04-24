import { NextRequest, NextResponse } from "next/server";
import { applyDemoBoost, evaluateWeatherTrigger, getWeatherData } from "../../../../lib/weather-oracle";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") || "Mumbai";
  const demo = request.nextUrl.searchParams.get("demo") === "true";

  let weather = await getWeatherData(city);
  if (demo) weather = applyDemoBoost(weather);

  return NextResponse.json({
    success: true,
    demoBoost: demo,
    ...evaluateWeatherTrigger(weather),
  });
}
