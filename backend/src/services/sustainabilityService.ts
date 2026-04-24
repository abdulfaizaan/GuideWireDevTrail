/**
 * Financial Sustainability Service
 *
 * Simplified actuarial model for GigShield parametric insurance.
 * Tracks loss ratio, reserve adequacy, and breakeven analysis.
 */

export interface SustainabilityMetrics {
  // Loss metrics
  lossRatio: number;              // total payouts / total premiums (< 1.0 = profitable)
  combinedRatio: number;          // loss ratio + expense ratio
  totalPremiumsCollected: number;
  totalPayoutsIssued: number;

  // Reserve modeling
  reserveAdequacy: number;        // current reserve / expected claims (%)
  currentReserve: number;
  expectedAnnualClaims: number;

  // Breakeven
  breakevenPolicyCount: number;   // minimum policies needed for sustainability
  currentPolicyCount: number;
  avgPremiumPerPolicy: number;
  avgClaimRate: number;           // claims per policy per month

  // Actuarial Modifiers
  dynamicPremiumModifier: number; // Multiplier for user premiums
  payoutModifier: number;         // Multiplier for claim payouts

  // Risk indicators
  healthStatus: "HEALTHY" | "CAUTION" | "AT_RISK";
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Configuration — base assumptions for the model
// ---------------------------------------------------------------------------
const EXPENSE_RATIO = 0.18;        // 18% operating expenses (tech, fraud detection, etc.)
const TARGET_LOSS_RATIO = 0.60;    // 60% target loss ratio
const SAFETY_MARGIN = 1.25;        // 25% safety margin on reserves

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------
export function computeSustainabilityMetrics(
  claimHistory: { payout: number; status: string }[],
  currentPolicyCount: number = 24892,
  avgPremiumPerPolicy: number = 89 // weekly
): SustainabilityMetrics {
  // Calculate actuals from claim history
  const approvedClaims = claimHistory.filter(
    (c) => c.status === "APPROVED" || c.status === "Settled" || c.status === "Transferred"
  );
  const rejectedClaims = claimHistory.filter(
    (c) => c.status === "REJECTED" || c.status === "Rejected"
  );

  const totalPayoutsIssued = approvedClaims.reduce((sum, c) => sum + (c.payout || 0), 0);

  // Annualize premiums: policyCount × weeklyPremium × 52
  const weeksInData = Math.max(1, Math.ceil(claimHistory.length / currentPolicyCount * 52) || 4);
  const totalPremiumsCollected = currentPolicyCount * avgPremiumPerPolicy * weeksInData;

  // Loss ratio
  const lossRatio = totalPremiumsCollected > 0
    ? totalPayoutsIssued / totalPremiumsCollected
    : 0;

  const combinedRatio = lossRatio + EXPENSE_RATIO;

  // Claim rate (claims per policy per week)
  const totalClaims = claimHistory.length;
  const avgClaimRate = currentPolicyCount > 0
    ? totalClaims / (currentPolicyCount * weeksInData)
    : 0.02; // default 2% claim rate

  // Average payout per approved claim
  const avgPayout = approvedClaims.length > 0
    ? totalPayoutsIssued / approvedClaims.length
    : 550; // default average

  // Expected annual claims
  const expectedAnnualClaims = currentPolicyCount * avgClaimRate * 52 * avgPayout;

  // Reserve adequacy
  // Current reserve = premiums collected - payouts - expenses
  const expenses = totalPremiumsCollected * EXPENSE_RATIO;
  const currentReserve = Math.max(0, totalPremiumsCollected - totalPayoutsIssued - expenses);
  const requiredReserve = expectedAnnualClaims * SAFETY_MARGIN;
  const reserveAdequacy = requiredReserve > 0
    ? (currentReserve / requiredReserve) * 100
    : 100;

  // Breakeven: how many policies needed for sustainability
  // Revenue = N × avgPremium × 52
  // Costs = N × claimRate × 52 × avgPayout + N × avgPremium × 52 × expenseRatio
  // Breakeven: Revenue = Costs
  // N × P × 52 = N × R × 52 × A + N × P × 52 × E
  // P = R × A + P × E
  // P × (1 - E) = R × A
  // N = minimum such that we can cover variance
  // Simpler: need at least enough policies so premiums cover claims + expenses
  const revenuePerPolicyAnnual = avgPremiumPerPolicy * 52;
  const costPerPolicyAnnual = (avgClaimRate * 52 * avgPayout) + (revenuePerPolicyAnnual * EXPENSE_RATIO);
  const profitPerPolicy = revenuePerPolicyAnnual - costPerPolicyAnnual;

  // Need enough policies to have positive margin + reserves
  const breakevenPolicyCount = profitPerPolicy > 0
    ? Math.ceil((expectedAnnualClaims * SAFETY_MARGIN) / profitPerPolicy)
    : 50000; // fallback

  // Health status
  let healthStatus: SustainabilityMetrics["healthStatus"];
  if (combinedRatio < 0.75 && reserveAdequacy > 100) {
    healthStatus = "HEALTHY";
  } else if (combinedRatio < 0.90 || reserveAdequacy > 60) {
    healthStatus = "CAUTION";
  } else {
    healthStatus = "AT_RISK";
  }

  // Recommendations
  const recommendations: string[] = [];
  if (lossRatio > TARGET_LOSS_RATIO) {
    recommendations.push("Loss ratio exceeds target. Consider tightening trigger thresholds or increasing premiums.");
  }
  if (reserveAdequacy < 100) {
    recommendations.push("Reserve adequacy is below 100%. Increase reinsurance allocation or grow policy base.");
  }
  if (avgClaimRate > 0.05) {
    recommendations.push("High claim frequency detected. Review fraud detection thresholds and cooling-off periods.");
  }
  if (currentPolicyCount < breakevenPolicyCount) {
    recommendations.push(`Policy count (${currentPolicyCount.toLocaleString()}) is below breakeven (${breakevenPolicyCount.toLocaleString()}). Focus on user acquisition.`);
  }

  const fraudInterceptRate = rejectedClaims.length / Math.max(1, totalClaims);
  if (fraudInterceptRate > 0.30) {
    recommendations.push("High fraud interception rate (>30%). Strengthening KYC may reduce fraudulent submissions.");
  }

  if (recommendations.length === 0) {
    recommendations.push("All financial indicators are within healthy ranges. Continue monitoring.");
  }

  // Calculate dynamic actuarial modifiers
  let dynamicPremiumModifier = 1.0;
  let payoutModifier = 1.0;

  if (healthStatus === "AT_RISK") {
    dynamicPremiumModifier = 1.15; // Increase premiums by 15% due to poor reserve health
    payoutModifier = 0.85;         // Reduce payouts by 15% to stabilize pool
  } else if (healthStatus === "CAUTION") {
    dynamicPremiumModifier = 1.05; // 5% premium bump
    payoutModifier = 0.95;         // 5% payout haircut
  } else if (reserveAdequacy > 150) {
    // Excess reserves — distribute value back to network
    dynamicPremiumModifier = 0.90; // 10% premium discount
    payoutModifier = 1.10;         // 10% payout boost
  }

  return {
    lossRatio: Math.round(lossRatio * 10000) / 100,       // as percentage
    combinedRatio: Math.round(combinedRatio * 10000) / 100,
    totalPremiumsCollected: Math.round(totalPremiumsCollected),
    totalPayoutsIssued: Math.round(totalPayoutsIssued),
    reserveAdequacy: Math.round(reserveAdequacy * 10) / 10,
    currentReserve: Math.round(currentReserve),
    expectedAnnualClaims: Math.round(expectedAnnualClaims),
    breakevenPolicyCount,
    currentPolicyCount,
    avgPremiumPerPolicy,
    avgClaimRate: Math.round(avgClaimRate * 10000) / 100, // as percentage
    dynamicPremiumModifier,
    payoutModifier,
    healthStatus,
    recommendations,
  };
}
