


export interface WeeklyEntry {
  week: number;          
  label: string;         
  contribution: number;  
}

export type FlexLabel = "Stable" | "Fluctuating" | "Risky";

export interface FlexibilityResult {
  score: number;           
  label: FlexLabel;
  consistencyFactor: number; 
  cv: number;              
  dropCount: number;       
}

export interface CoverageResult {
  coverage: number;        
  ratio: number;           
}

export interface PayoutResult {
  payout: number;          
  multiplier: number;      
}

export type WarningSeverity = "info" | "warning" | "success";

export interface Warning {
  severity: WarningSeverity;
  message: string;
}

export interface DPASnapshot {
  effectivePremium: number;
  flexibility: FlexibilityResult;
  coverage: CoverageResult;
  triggerPayouts: Record<string, PayoutResult>; 
  warnings: Warning[];
}



export interface BasePlan {
  name: string;
  basePremium: number;
  baseCoverage: number;
  triggers: Record<string, number>; 
}

export const PLAN_DEFINITIONS: Record<string, BasePlan> = {
  Basic: {
    name: "Basic",
    basePremium: 49,
    baseCoverage: 5000,
    triggers: { rain: 340, heat: 225, aqi: 190, outage: 275, bandh: 360 },
  },
  Standard: {
    name: "Standard",
    basePremium: 89,
    baseCoverage: 10000,
    triggers: { rain: 680, heat: 450, aqi: 380, outage: 550, bandh: 720 },
  },
  Premium: {
    name: "Premium",
    basePremium: 149,
    baseCoverage: 20000,
    triggers: { rain: 1200, heat: 850, aqi: 700, outage: 950, bandh: 1400 },
  },
};



const DECAY = 0.75;              
const COVERAGE_MIN_RATIO = 0.30; 
const COVERAGE_MAX_RATIO = 1.50; 
const DROP_THRESHOLD = 0.20;     



export function computeEffectivePremium(
  history: WeeklyEntry[],
  decay: number = DECAY
): number {
  if (history.length === 0) return 0;
  const n = history.length;
  let weightedSum = 0;
  let weightSum = 0;

  history.forEach((entry, i) => {
    
    const exponent = n - 1 - i;
    const weight = Math.pow(decay, exponent);
    weightedSum += entry.contribution * weight;
    weightSum += weight;
  });

  return Math.round((weightedSum / weightSum) * 100) / 100;
}



export function computeFlexibility(history: WeeklyEntry[]): FlexibilityResult {
  if (history.length < 2) {
    // Anti-adverse-selection: brand new enrollees get reduced payout factor
    const newEnrolleeFactor = history.length === 0 ? 0.60 : 0.70;
    return { score: 100, label: "Stable", consistencyFactor: newEnrolleeFactor, cv: 0, dropCount: 0 };
  }

  const values = history.map((e) => e.contribution);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  
  let dropCount = 0;
  for (let i = 1; i < values.length; i++) {
    const dropRatio = (values[i - 1] - values[i]) / values[i - 1];
    if (dropRatio > DROP_THRESHOLD) dropCount++;
  }

  
  const rawScore = 100 - cv * 100 - dropCount * 5;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let label: FlexLabel;
  let consistencyFactor: number;

  if (cv < 0.15 && dropCount <= 1) {
    label = "Stable";
    consistencyFactor = 1.0;
  } else if (cv < 0.30 && dropCount <= 3) {
    label = "Fluctuating";
    consistencyFactor = 0.92;
  } else {
    label = "Risky";
    consistencyFactor = 0.82;
  }

  return { score, label, consistencyFactor, cv, dropCount };
}



export function computeCoverage(
  effectivePremium: number,
  plan: BasePlan
): CoverageResult {
  const ratio = plan.basePremium > 0 ? effectivePremium / plan.basePremium : 1;
  const clampedRatio = Math.max(COVERAGE_MIN_RATIO, Math.min(COVERAGE_MAX_RATIO, ratio));
  const coverage = Math.round(plan.baseCoverage * clampedRatio);
  return { coverage, ratio: Math.round(clampedRatio * 100) / 100 };
}



export function computePayout(
  triggerId: string,
  effectivePremium: number,
  plan: BasePlan,
  flexibility: FlexibilityResult,
  riskScore: number 
): PayoutResult {
  const basePayout = plan.triggers[triggerId] ?? 0;

  
  const riskFactor = 0.7 + (Math.max(0, Math.min(100, riskScore)) / 100) * 0.6;

  
  const premiumRatio = plan.basePremium > 0 ? effectivePremium / plan.basePremium : 1;
  const clampedPremiumRatio = Math.max(COVERAGE_MIN_RATIO, Math.min(COVERAGE_MAX_RATIO, premiumRatio));

  
  const multiplier =
    Math.round(clampedPremiumRatio * riskFactor * flexibility.consistencyFactor * 100) / 100;
  const payout = Math.round(basePayout * multiplier);

  return { payout, multiplier };
}



export function getWarnings(
  newContribution: number,
  effectivePremium: number,
  flexibility: FlexibilityResult
): Warning[] {
  const warnings: Warning[] = [];

  if (effectivePremium > 0) {
    const ratio = newContribution / effectivePremium;

    if (ratio < 0.50) {
      warnings.push({
        severity: "warning",
        message: "Significant reduction will heavily decrease your payout protection.",
      });
    } else if (ratio < 0.80) {
      warnings.push({
        severity: "info",
        message: "Lower contribution reduces your protection proportionally.",
      });
    }

    if (ratio > 1.50) {
      warnings.push({
        severity: "info",
        message: "Higher contributions build gradually — benefit doesn't increase instantly.",
      });
    }
  }

  if (flexibility.label === "Risky") {
    warnings.push({
      severity: "warning",
      message: "Frequent changes are reducing your reliability score and payout potential.",
    });
  } else if (flexibility.label === "Stable") {
    warnings.push({
      severity: "success",
      message: "Consistent contributions are improving your benefits.",
    });
  }

  return warnings;
}



export function simulateDPA(
  history: WeeklyEntry[],
  newContribution: number,
  plan: BasePlan,
  riskScore: number
): DPASnapshot {
  
  const previewHistory: WeeklyEntry[] = [
    ...history,
    { week: history.length + 1, label: "New", contribution: newContribution },
  ];

  const effectivePremium = computeEffectivePremium(previewHistory);
  const flexibility = computeFlexibility(previewHistory);
  const coverage = computeCoverage(effectivePremium, plan);

  const triggerPayouts: Record<string, PayoutResult> = {};
  for (const triggerId of Object.keys(plan.triggers)) {
    triggerPayouts[triggerId] = computePayout(
      triggerId,
      effectivePremium,
      plan,
      flexibility,
      riskScore
    );
  }

  const warnings = getWarnings(newContribution, computeEffectivePremium(history), flexibility);

  return { effectivePremium, flexibility, coverage, triggerPayouts, warnings };
}
