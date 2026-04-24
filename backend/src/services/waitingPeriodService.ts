/**
 * Waiting Period Service — Per-Cover Adverse Selection Controls
 *
 * Implements per-cover-type waiting periods and geo-lock:
 *   Rain:   48 hours
 *   AQI:    72 hours
 *   Bandh:  5 days (120 hours)
 *   Outage: 24 hours
 *
 * Geo-lock: blocks policy purchase if severe alert already active.
 */

export interface WaitingPeriodConfig {
  cover_type: string;
  hours: number;
  label: string;
}

export interface WaitingCheckResult {
  allowed: boolean;
  cover_type: string;
  waiting_until: string | null;
  hours_remaining: number;
  message: string;
}

// ── Per-cover waiting periods ────────────────────────────────────────────────
const WAITING_PERIODS: Record<string, number> = {
  rain:    48,
  heat:    48,
  humidity: 24,
  aqi:     72,
  bandh:   120,  // 5 days
  outage:  24,
};

/**
 * Check if a claim is allowed given the policy enrollment date and cover type
 */
export function checkWaitingPeriod(
  enrolledAt: string | Date,
  coverType: string,
): WaitingCheckResult {
  const enrollment = new Date(enrolledAt);
  const now = new Date();
  const hoursElapsed = (now.getTime() - enrollment.getTime()) / (1000 * 60 * 60);
  const requiredHours = WAITING_PERIODS[coverType.toLowerCase()] ?? 48;
  const allowed = hoursElapsed >= requiredHours;

  return {
    allowed,
    cover_type: coverType,
    waiting_until: allowed ? null : new Date(enrollment.getTime() + requiredHours * 3600000).toISOString(),
    hours_remaining: allowed ? 0 : Math.ceil(requiredHours - hoursElapsed),
    message: allowed
      ? `Waiting period complete for ${coverType} cover.`
      : `Waiting period active: ${Math.ceil(requiredHours - hoursElapsed)}h remaining for ${coverType} cover (requires ${requiredHours}h).`,
  };
}

/**
 * Compute payout modifier based on policy age (soft penalty for new policies)
 */
export function getPolicyAgePenalty(enrolledAt: string | Date): { modifier: number; message: string | null } {
  const enrollment = new Date(enrolledAt);
  const hoursElapsed = (Date.now() - enrollment.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed < 24) {
    return { modifier: 0.0, message: "Policy too new — no payouts in first 24 hours." };
  }
  if (hoursElapsed < 72) {
    return { modifier: 0.40, message: `New policy penalty: 60% payout reduction (age: ${Math.round(hoursElapsed)}h).` };
  }
  if (hoursElapsed < 168) {
    return { modifier: 0.70, message: `First-week penalty: 30% payout reduction (age: ${Math.round(hoursElapsed / 24)}d).` };
  }
  return { modifier: 1.0, message: null };
}

/**
 * Geo-lock check: block policy purchase if severe alert is already active
 */
export function checkGeoLock(activeAlerts: { type: string; severity: string }[]): {
  locked: boolean;
  reason: string | null;
} {
  const severeAlerts = activeAlerts.filter(
    a => a.severity === "full" || a.severity === "partial"
  );

  if (severeAlerts.length > 0) {
    const types = severeAlerts.map(a => a.type).join(", ");
    return {
      locked: true,
      reason: `Policy purchase blocked: active ${types} alert(s) in your zone. This prevents adverse selection.`,
    };
  }

  return { locked: false, reason: null };
}

export function getWaitingPeriodHours(coverType: string): number {
  return WAITING_PERIODS[coverType.toLowerCase()] ?? 48;
}

export function getAllWaitingPeriods(): WaitingPeriodConfig[] {
  return Object.entries(WAITING_PERIODS).map(([type, hours]) => ({
    cover_type: type,
    hours,
    label: `${type.charAt(0).toUpperCase() + type.slice(1)} Cover`,
  }));
}
