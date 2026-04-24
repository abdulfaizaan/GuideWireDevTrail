/**
 * Background Scheduler — Trigger Monitoring Engine
 *
 * Runs every 15 minutes:
 *   1. Iterate all monitored zones
 *   2. Fetch signals per zone
 *   3. Evaluate triggers
 *   4. Auto-create claims for active policies
 *   5. Log events
 *
 * Falls back to setInterval when Redis/BullMQ unavailable.
 */

import { getWeatherData, type WeatherData } from "./weatherService";
import { evaluateAllTriggers, type TriggerResult } from "./triggerEngine";
import { runClaimPipeline, type ClaimPipelineResult } from "./claimPipeline";

// ── Configuration ────────────────────────────────────────────────────────────
const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOG_SIZE = 500;

// Monitored cities (expand with pilot rollout)
const MONITORED_ZONES = [
  { city: "Mumbai", pincodes: ["400001", "400058", "400070"] },
  { city: "Delhi", pincodes: ["110001", "110017", "110044"] },
  { city: "Bangalore", pincodes: ["560001", "560008", "560034"] },
  { city: "Pune", pincodes: ["411001", "411014"] },
  { city: "Chennai", pincodes: ["600001", "600017"] },
];

// ── Event log ────────────────────────────────────────────────────────────────
export interface SchedulerEvent {
  timestamp: string;
  city: string;
  zone: string;
  triggered: boolean;
  risk_score: number;
  risk_level: string;
  trigger_type: string | null;
  trigger_label: string | null;
  trigger_payout: number;
  active_triggers_count: number;
  weather_summary: string;
  claims_created: number;
}

const eventLog: SchedulerEvent[] = [];
let isRunning = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// ── Policy store interface (injected from index.ts) ──────────────────────────
type PolicyFinder = (city: string) => Promise<{ userId: string; profession: string; dailyEarnings: number; plan: string; enrolledAt: string }[]>;
type ClaimCreator = (data: any) => Promise<void>;

let findActivePolicies: PolicyFinder = async () => [];
let createClaim: ClaimCreator = async () => {};

export function setSchedulerDeps(finder: PolicyFinder, creator: ClaimCreator) {
  findActivePolicies = finder;
  createClaim = creator;
}

// ── Core check ───────────────────────────────────────────────────────────────
async function checkZone(city: string): Promise<SchedulerEvent> {
  const weather = await getWeatherData(city);
  const evaluation = await evaluateAllTriggers(weather, city);

  const event: SchedulerEvent = {
    timestamp: new Date().toISOString(),
    city,
    zone: city.toLowerCase(),
    triggered: evaluation.triggered,
    risk_score: evaluation.riskScore,
    risk_level: evaluation.riskLevel,
    trigger_type: evaluation.triggerType,
    trigger_label: evaluation.triggerLabel,
    trigger_payout: evaluation.triggerPayout,
    active_triggers_count: evaluation.activeTriggersCount,
    weather_summary: `${weather.condition} | Rain: ${weather.rain}mm | Temp: ${weather.temp}°C`,
    claims_created: 0,
  };

  if (evaluation.triggered) {
    console.log(`[Scheduler] ⚡ TRIGGER in ${city}: ${evaluation.triggerLabel} (risk: ${evaluation.riskScore})`);

    try {
      const policies = await findActivePolicies(city);
      console.log(`[Scheduler] Processing ${policies.length} active policies in ${city}`);

      for (const policy of policies) {
        try {
          const result = await runClaimPipeline({
            claim_id: `AUTO-${Date.now()}-${policy.userId}`,
            user_id: policy.userId,
            city,
            trigger_type: evaluation.triggerType || "rain",
            profession: policy.profession || "delivery_rider",
            daily_income: policy.dailyEarnings || 900,
            plan_tier: policy.plan || "Standard",
            enrolled_at: policy.enrolledAt || new Date(Date.now() - 30 * 86400000).toISOString(),
            demo_mode: false,
          });

          if (result.final_status === "APPROVED") {
            await createClaim({
              id: result.claim_id,
              type: evaluation.triggerLabel,
              trigger: evaluation.triggerIcon,
              date: new Date().toISOString().split("T")[0],
              payout: result.payout_amount,
              status: "APPROVED",
              fraudScore: result.fraud_score,
              timeline: result.stages.map(s => `${s.name}: ${s.status}`),
              pipeline_timing: {
                total_ms: result.total_duration_ms,
                stages: result.stages.map(s => ({ name: s.name, ms: s.duration_ms })),
              },
            });
            event.claims_created++;
            console.log(`[Scheduler] ✅ Auto-claim ₹${result.payout_amount} for ${policy.userId}`);
          }
        } catch (err: any) {
          console.log(`[Scheduler] ⚠️ Pipeline error for ${policy.userId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.log(`[Scheduler] ⚠️ Policy lookup error: ${err.message}`);
    }
  }

  return event;
}

// ── Main loop ────────────────────────────────────────────────────────────────
async function runSchedulerCycle() {
  if (isRunning) {
    console.log("[Scheduler] Previous cycle still running, skipping.");
    return;
  }

  isRunning = true;
  const cycleStart = Date.now();
  console.log(`[Scheduler] ─── Cycle started at ${new Date().toISOString()} ───`);

  for (const zone of MONITORED_ZONES) {
    try {
      const event = await checkZone(zone.city);
      eventLog.push(event);
    } catch (err: any) {
      console.log(`[Scheduler] Error checking ${zone.city}: ${err.message}`);
    }
  }

  // Trim log
  while (eventLog.length > MAX_LOG_SIZE) eventLog.shift();

  const elapsed = Date.now() - cycleStart;
  console.log(`[Scheduler] ─── Cycle complete in ${elapsed}ms ───`);
  isRunning = false;
}

// ── Public API ───────────────────────────────────────────────────────────────
export function startScheduler(delayMs: number = 5000) {
  console.log(`[Scheduler] Starting background trigger monitoring (every ${SCHEDULER_INTERVAL_MS / 60000} min)`);
  setTimeout(() => {
    runSchedulerCycle();
    intervalHandle = setInterval(runSchedulerCycle, SCHEDULER_INTERVAL_MS);
  }, delayMs);
}

export function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[Scheduler] Stopped.");
  }
}

export function getRecentEvents(hours: number = 24): SchedulerEvent[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return eventLog.filter(e => e.timestamp >= cutoff);
}

export function getSchedulerStats() {
  const recent = getRecentEvents(24);
  return {
    total_checks: recent.length,
    triggers_detected: recent.filter(e => e.triggered).length,
    claims_created: recent.reduce((sum, e) => sum + e.claims_created, 0),
    zones_monitored: MONITORED_ZONES.length,
    interval_minutes: SCHEDULER_INTERVAL_MS / 60000,
    is_running: isRunning,
  };
}
