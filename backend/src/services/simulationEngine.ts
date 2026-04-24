/**
 * Simulation Engine — Scenario Modeling for Financial Planning
 *
 * Runs what-if scenarios:
 *   - Monsoon intensity changes
 *   - AQI spikes
 *   - Fraud rate changes
 *
 * Outputs reserve requirements, profitability, premium corrections.
 */

import { computeSustainabilityMetrics, type SustainabilityMetrics } from "./sustainabilityService";

export interface SimulationScenario {
  name: string;
  description: string;
  claim_multiplier: number;
  fraud_rate_delta: number;
  premium_adjustment: number;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  baseline: SustainabilityMetrics;
  projected: SustainabilityMetrics;
  delta: {
    loss_ratio_change: number;
    reserve_change: number;
    premium_correction_needed: number;
    profitability_impact: string;
  };
  recommendation: string;
  run_at: string;
}

// ── Built-in scenarios ───────────────────────────────────────────────────────
const SCENARIOS: SimulationScenario[] = [
  {
    name: "Monsoon Intensity +30%",
    description: "Simulate 30% increase in monsoon rainfall leading to more rain triggers",
    claim_multiplier: 1.30,
    fraud_rate_delta: 0.02,
    premium_adjustment: 0,
  },
  {
    name: "AQI Spike Delhi NCR",
    description: "Winter AQI crisis in Delhi NCR region with sustained 300+ readings",
    claim_multiplier: 1.45,
    fraud_rate_delta: 0.05,
    premium_adjustment: 0,
  },
  {
    name: "Fraud Rate +10%",
    description: "Coordinated fraud attack increasing fraudulent claims by 10%",
    claim_multiplier: 1.10,
    fraud_rate_delta: 0.10,
    premium_adjustment: 0,
  },
  {
    name: "Pilot Expansion (Punjab + Delhi)",
    description: "Double the policy base with new high-risk regions",
    claim_multiplier: 1.15,
    fraud_rate_delta: 0.03,
    premium_adjustment: 0.05,
  },
  {
    name: "Best Case (Low Season)",
    description: "Dry winter months with minimal triggers",
    claim_multiplier: 0.60,
    fraud_rate_delta: -0.02,
    premium_adjustment: -0.05,
  },
];

export function getAvailableScenarios(): SimulationScenario[] {
  return SCENARIOS;
}

export function runSimulation(
  claimHistory: { payout: number; status: string }[],
  scenario: SimulationScenario,
  currentPolicyCount: number = 24892,
  avgPremium: number = 89,
): SimulationResult {
  // Baseline
  const baseline = computeSustainabilityMetrics(claimHistory, currentPolicyCount, avgPremium);

  // Project claims under scenario
  const projectedClaims = claimHistory.map(c => ({
    payout: c.status === "APPROVED" ? Math.round(c.payout * scenario.claim_multiplier) : c.payout,
    status: c.status,
  }));

  // Add synthetic fraud claims
  const fraudCount = Math.round(claimHistory.length * scenario.fraud_rate_delta);
  for (let i = 0; i < Math.abs(fraudCount); i++) {
    if (fraudCount > 0) {
      projectedClaims.push({ payout: 600, status: "APPROVED" });
    }
  }

  const adjustedPremium = avgPremium * (1 + scenario.premium_adjustment);
  const projected = computeSustainabilityMetrics(projectedClaims, currentPolicyCount, adjustedPremium);

  const lossChange = projected.lossRatio - baseline.lossRatio;
  const reserveChange = projected.currentReserve - baseline.currentReserve;
  const premiumCorrection = lossChange > 5 ? Math.round(lossChange * 0.3) : 0;

  let profitability: string;
  if (projected.combinedRatio < 75) profitability = "PROFITABLE";
  else if (projected.combinedRatio < 95) profitability = "MARGINAL";
  else profitability = "LOSS";

  let recommendation: string;
  if (profitability === "LOSS") {
    recommendation = `Scenario "${scenario.name}" would push combined ratio to ${projected.combinedRatio.toFixed(1)}%. Recommend premium increase of ${premiumCorrection}% and tighter trigger thresholds.`;
  } else if (profitability === "MARGINAL") {
    recommendation = `Scenario "${scenario.name}" is manageable but margins thin. Consider ${premiumCorrection > 0 ? `${premiumCorrection}% premium adjustment` : "maintaining current premiums"} and increasing reserves.`;
  } else {
    recommendation = `Scenario "${scenario.name}" remains profitable. Current pricing is adequate.`;
  }

  return {
    scenario,
    baseline,
    projected,
    delta: {
      loss_ratio_change: Math.round(lossChange * 100) / 100,
      reserve_change: Math.round(reserveChange),
      premium_correction_needed: premiumCorrection,
      profitability_impact: profitability,
    },
    recommendation,
    run_at: new Date().toISOString(),
  };
}

export function runAllSimulations(
  claimHistory: { payout: number; status: string }[],
  policyCount?: number,
  avgPremium?: number,
): SimulationResult[] {
  return SCENARIOS.map(s => runSimulation(claimHistory, s, policyCount, avgPremium));
}
