const CLAIMS_STORAGE_KEY = "gigshield_claims";
const MAX_CLAIMS = 100;

export interface StoredClaim {
  id: string;
  trigger: string;
  type: string;
  date: string;
  payout: number;
  status: string;
  fraudScore: number;
  timeline: string[];
  reasons?: string[];
  ai_explanation?: string;
  transactionId?: string;
  gateway?: string;
}

export function loadClaims(fallback: StoredClaim[] = []): StoredClaim[] {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = localStorage.getItem(CLAIMS_STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as StoredClaim[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function saveClaims(claims: StoredClaim[]): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(claims.slice(0, MAX_CLAIMS)));
}
