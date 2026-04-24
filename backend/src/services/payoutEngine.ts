/**
 * Payout Engine — Dynamic Income-Proportional Payouts
 *
 * Formula: daily_income × severity × coverage_percent
 * Replaces all flat payout values with actuarially-sound calculations.
 */

export interface PayoutInput {
  profession: string;
  daily_income: number;
  trigger_type: string;
  plan_tier: string;
  severity_override?: number;
}

export interface PayoutResult {
  amount: number;
  formula: string;
  daily_income: number;
  severity: number;
  coverage_percent: number;
  breakdown: {
    base: number;
    severity_adjusted: number;
    coverage_adjusted: number;
  };
}

// ── Severity by trigger type (0.0–1.0) ───────────────────────────────────────
const TRIGGER_SEVERITY: Record<string, number> = {
  rain:         0.70,
  heat:         0.55,
  humidity:     0.40,
  aqi:          0.60,
  outage:       0.65,
  bandh:        0.85,
  thunderstorm: 0.80,
};

// ── Coverage percent by plan tier ────────────────────────────────────────────
const COVERAGE_PERCENT: Record<string, number> = {
  Basic:    0.60,
  Standard: 0.80,
  Premium:  1.00,
  Daily:    0.50,
  Weekly:   0.80,
  Monthly:  1.00,
};

// ── Profession income baselines ──────────────────────────────────────────────
const PROFESSION_INCOME: Record<string, number> = {
  delivery_rider: 900,
  cab_driver:     1200,
  auto_driver:    800,
  freelancer:     1500,
  street_vendor:  600,
  construction:   700,
  other:          800,
};

/**
 * Calculate dynamic payout based on income, severity, and coverage
 */
export function calculatePayout(input: PayoutInput): PayoutResult {
  const dailyIncome = input.daily_income > 0
    ? input.daily_income
    : PROFESSION_INCOME[input.profession.toLowerCase()] || 800;

  const severity = input.severity_override ?? TRIGGER_SEVERITY[input.trigger_type.toLowerCase()] ?? 0.50;
  const coveragePercent = COVERAGE_PERCENT[input.plan_tier] ?? 0.80;

  const base = dailyIncome;
  const severityAdjusted = Math.round(base * severity);
  const coverageAdjusted = Math.round(severityAdjusted * coveragePercent);
  const amount = Math.max(50, Math.min(5000, coverageAdjusted));

  return {
    amount,
    formula: `₹${dailyIncome} × ${severity} × ${coveragePercent} = ₹${amount}`,
    daily_income: dailyIncome,
    severity,
    coverage_percent: coveragePercent,
    breakdown: {
      base,
      severity_adjusted: severityAdjusted,
      coverage_adjusted: coverageAdjusted,
    },
  };
}

/**
 * Compute severity from weather data
 */
export function computeSeverity(triggerType: string, value: number): number {
  switch (triggerType.toLowerCase()) {
    case "rain":
      if (value >= 50) return 1.0;
      if (value >= 35) return 0.85;
      if (value >= 20) return 0.70;
      return 0.40;
    case "heat":
      if (value >= 47) return 1.0;
      if (value >= 44) return 0.80;
      if (value >= 40) return 0.55;
      return 0.30;
    case "aqi":
      if (value >= 400) return 1.0;
      if (value >= 300) return 0.80;
      if (value >= 200) return 0.60;
      return 0.30;
    case "humidity":
      if (value >= 95) return 0.60;
      if (value >= 85) return 0.40;
      return 0.20;
    default:
      return 0.50;
  }
}

export function getBaseIncome(profession: string): number {
  return PROFESSION_INCOME[profession.toLowerCase()] || 800;
}
