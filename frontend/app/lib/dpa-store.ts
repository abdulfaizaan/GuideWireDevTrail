
import { WeeklyEntry, PLAN_DEFINITIONS } from "./dpa";

const STORAGE_KEY = "gigshield_dpa_history";
const MAX_WEEKS = 52;



function seedHistory(basePremium: number): WeeklyEntry[] {
  const now = new Date();
  const entries: WeeklyEntry[] = [];

  
  for (let i = 7; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    const weekNum = getISOWeek(date);

    
    let contribution: number;
    if (i === 5) {
      contribution = Math.round(basePremium * 0.78); 
    } else if (i === 2) {
      contribution = Math.round(basePremium * 1.12); 
    } else {
      const variation = 0.92 + Math.random() * 0.16; 
      contribution = Math.round(basePremium * variation);
    }

    entries.push({
      week: weekNum,
      label: `W${weekNum}`,
      contribution,
    });
  }

  return entries;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function currentWeekLabel(): string {
  return `W${getISOWeek(new Date())}`;
}



export function loadHistory(planName?: string): WeeklyEntry[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as WeeklyEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      
    }
  }

  
  const plan = PLAN_DEFINITIONS[planName ?? "Standard"] ?? PLAN_DEFINITIONS.Standard;
  const seeded = seedHistory(plan.basePremium);
  saveHistory(seeded);
  return seeded;
}

export function saveHistory(history: WeeklyEntry[]): void {
  if (typeof window === "undefined") return;
  
  const trimmed = history.slice(-MAX_WEEKS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function addWeeklyContribution(
  history: WeeklyEntry[],
  amount: number
): WeeklyEntry[] {
  const label = currentWeekLabel();
  const week = getISOWeek(new Date());

  
  const filtered = history.filter((e) => e.label !== label);
  const updated: WeeklyEntry[] = [
    ...filtered,
    { week, label, contribution: amount },
  ];

  saveHistory(updated);
  return updated;
}

export function clearHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
