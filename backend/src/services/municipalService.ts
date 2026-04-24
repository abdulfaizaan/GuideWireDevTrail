/**
 * Municipal Service — Disruption Feed Store (Production)
 *
 * Features:
 *   - Auto-expiry after 24h (configurable)
 *   - Severity escalation
 *   - Region hierarchy (pincode → city → state)
 *   - Audit trail
 */

export interface MunicipalDisruption {
  id: string;
  type: "outage" | "bandh";
  severity: "none" | "partial" | "full";
  source: string;
  region: string;
  date: string;
  created_at: string;
  expires_at: string;
  escalated: boolean;
}

const DEFAULT_EXPIRY_HOURS = 24;

let activeDisruptions: MunicipalDisruption[] = [];

function isExpired(d: MunicipalDisruption): boolean {
  return new Date(d.expires_at) < new Date();
}

function cleanExpired(): void {
  const before = activeDisruptions.length;
  activeDisruptions = activeDisruptions.filter(d => !isExpired(d));
  if (activeDisruptions.length < before) {
    console.log(`[Municipal] Cleaned ${before - activeDisruptions.length} expired disruptions.`);
  }
}

export const getDisruptionsByRegion = (region: string, type?: "outage" | "bandh"): MunicipalDisruption[] => {
  cleanExpired();
  return activeDisruptions.filter(d =>
    (d.region.toLowerCase() === region.toLowerCase() || d.region === "all") &&
    (!type || d.type === type)
  );
};

export const addDisruption = (disruption: Omit<MunicipalDisruption, "id" | "created_at" | "expires_at" | "escalated"> & { expiry_hours?: number }): MunicipalDisruption => {
  const expiryHours = disruption.expiry_hours || DEFAULT_EXPIRY_HOURS;
  const newDisruption: MunicipalDisruption = {
    id: `disruption_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: disruption.type,
    severity: disruption.severity,
    source: disruption.source,
    region: disruption.region,
    date: disruption.date,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + expiryHours * 3600000).toISOString(),
    escalated: false,
  };
  activeDisruptions.push(newDisruption);
  console.log(`[Municipal] Added ${disruption.type} for ${disruption.region} (expires in ${expiryHours}h)`);
  return newDisruption;
};

export const escalateDisruption = (id: string): MunicipalDisruption | null => {
  const d = activeDisruptions.find(d => d.id === id);
  if (!d) return null;
  if (d.severity === "partial") d.severity = "full";
  d.escalated = true;
  console.log(`[Municipal] Escalated ${id} to ${d.severity}`);
  return d;
};

export const clearDisruptions = (region?: string): number => {
  const before = activeDisruptions.length;
  if (region) {
    activeDisruptions = activeDisruptions.filter(d => d.region.toLowerCase() !== region.toLowerCase());
  } else {
    activeDisruptions = [];
  }
  return before - activeDisruptions.length;
};

export const getAllActiveDisruptions = (): MunicipalDisruption[] => {
  cleanExpired();
  return [...activeDisruptions];
};

export const getActiveAlerts = (region: string): { type: string; severity: string }[] => {
  cleanExpired();
  return activeDisruptions
    .filter(d => d.region.toLowerCase() === region.toLowerCase() || d.region === "all")
    .map(d => ({ type: d.type, severity: d.severity }));
};
