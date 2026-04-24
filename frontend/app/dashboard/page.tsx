"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  computeEffectivePremium,
  computeFlexibility,
  type WeeklyEntry,
  type FlexLabel,
} from "../lib/dpa";
import { loadClaims, saveClaims } from "../lib/claim-store";
import { loadHistory } from "../lib/dpa-store";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/policy", label: "Policy" },
  { href: "/claims", label: "Claims" },
];

const TRIGGERS = [
  { id: "rain", icon: "🌧️", label: "Rain", payout: 680 },
  { id: "heat", icon: "🌡️", label: "Heat", payout: 450 },
  { id: "aqi", icon: "😷", label: "AQI", payout: 380 },
  { id: "outage", icon: "📵", label: "Outage", payout: 550 },
  { id: "bandh", icon: "🚫", label: "Bandh", payout: 720 },
];

interface Claim {
  id: string;
  trigger: string;
  type: string;
  date: string;
  payout: number;
  status: string;
  fraudScore: number;
  timeline: string[];
  reasons?: string[];
  transactionId?: string;
  gateway?: string;
}

const FALLBACK_CLAIMS: Claim[] = [
  {
    id: "CLM-001", trigger: "ðŸŒ§ï¸", type: "Heavy Rain", date: "2024-03-28",
    payout: 680, status: "Transferred", fraudScore: 0.03,
    timeline: ["Incident Detected", "Policy Triggered", "Risk Assessment", "Payout Initiated"],
    transactionId: "txn_sim_3841920", gateway: "Razorpay Test",
  },
];

function generateFraudDemoData(triggerId: string) {
  // Demo Mock Data:
  // Randomly simulate a bad GPS location 20% of the time,
  // or a user working during an Outage 10% of the time.
  const isSpoofed = Math.random() < 0.2;
  const isWorking = Math.random() < 0.1;

  return {
    userLocation: isSpoofed ? { lat: 28.6139, lon: 77.2090 } : { lat: 19.0760, lon: 72.8777 },
    actualLocation: { lat: 19.0760, lon: 72.8777 }, // Mumbai
    activity: {
      orders: isWorking && (triggerId === "outage" || triggerId === "bandh") ? 3 : 0,
      lastActive: new Date().toISOString()
    }
  };
}

// ── Weather types ──────────────────────────────────────────────────────────
interface WeatherData {
  rain: number;
  temp: number;
  humidity: number;
  condition: string;
  description: string;
  windSpeed: number;
  city: string;
  isLive: boolean;
  fetchedAt: string;
}

interface TriggerBreakdown {
  factor: string;
  value: number;
  threshold: number;
  exceeded: boolean;
  contribution: number;
}

interface WeatherTriggerResult {
  success: boolean;
  triggered: boolean;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  triggerType: string | null;
  triggerLabel: string | null;
  triggerIcon: string | null;
  triggerPayout: number;
  envScore: number;
  activityDrop: number;
  weather: WeatherData;
  breakdown: TriggerBreakdown[];
  evaluatedAt: string;
}

type LiveState = "idle" | "loading" | "fetched" | "triggered" | "processing" | "complete";

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 bg-[#0B0B12]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-sm font-bold shadow-lg">
            G
          </div>
          <span className="font-bold text-white tracking-tight">GigShield</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-sm font-medium transition-colors ${
                pathname === n.href ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col items-end">
          <div className="text-sm font-medium text-white">Partner Portal</div>
          <div className="text-xs text-[#22C55E] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
            Monitoring your zone in real-time
          </div>
        </div>
      </div>
    </header>
  );
}

function flexColor(label: FlexLabel): string {
  return label === "Stable" ? "#22C55E" : label === "Fluctuating" ? "#EAB308" : "#EF4444";
}

function riskColor(level: string): string {
  if (level === "CRITICAL") return "#EF4444";
  if (level === "HIGH") return "#F97316";
  if (level === "MEDIUM") return "#EAB308";
  return "#22C55E";
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const [user, setUser] = useState<{plan?: string; riskScore?: number; phone?: string; enrolledAt?: string; dailyEarnings?: number; pincode?: string; city?: string; profession?: string} | null>(null);
  const [coolingOff, setCoolingOff] = useState<{active: boolean; hoursLeft: number}>({ active: false, hoursLeft: 0 });
  
  const [dpaHistory, setDpaHistory] = useState<WeeklyEntry[]>([]);
  const [dpaEffective, setDpaEffective] = useState<number>(89);
  const [dpaFlex, setDpaFlex] = useState(computeFlexibility([]));

  const [claims, setClaims] = useState<Claim[]>(() => loadClaims(FALLBACK_CLAIMS));
  const [simulating, setSimulating] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [riskData, setRiskData] = useState<{risk_score: number; final_premium: number} | null>(null);
  const [liveRiskScore, setLiveRiskScore] = useState<number>(65.0);

  // ── Live Mode State ────────────────────────────────────────────────────
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [demoBoost, setDemoBoost] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [weatherResult, setWeatherResult] = useState<WeatherTriggerResult | null>(null);
  const autoTriggered = useRef(false);
  
  const totalPaid = claims.filter((c) => c.status === "Transferred" || c.status === "Settled").reduce((a, c) => a + c.payout, 0);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchRisk = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";
      const res = await axios.post(`${apiUrl}/predict`, {
        zone_risk: 0.6, seasonal_risk: 0.5, risk_score: 65, weeks_active: 12, base_premium: 49,
      });
      setRiskData(res.data);
    } catch {
      setRiskData({ risk_score: 65, final_premium: 89 });
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("gigshield_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        const h = loadHistory(parsed.plan);
        setDpaHistory(h);
        setDpaEffective(computeEffectivePremium(h));
        setDpaFlex(computeFlexibility(h));

        // Check cooling-off period (Fix 3)
        if (parsed.enrolledAt) {
          const hoursElapsed = (Date.now() - new Date(parsed.enrolledAt).getTime()) / (1000 * 60 * 60);
          if (hoursElapsed < 72) {
            setCoolingOff({ active: true, hoursLeft: Math.ceil(72 - hoursElapsed) });
          }
        }
      } catch {
        const h = loadHistory("Standard");
        setDpaHistory(h);
        setDpaEffective(computeEffectivePremium(h));
        setDpaFlex(computeFlexibility(h));
      }
    } else {
      const h = loadHistory("Standard");
      setDpaHistory(h);
      setDpaEffective(computeEffectivePremium(h));
      setDpaFlex(computeFlexibility(h));
    }
    fetchRisk();
  }, [fetchRisk]);

  useEffect(() => {
    saveClaims(claims);
  }, [claims]);

  // ── Simulation claim handler (existing) ────────────────────────────────
  const simulateClaim = async (trigger: typeof TRIGGERS[number]) => {
    setSimulating(true);
    setTimelineStep(0);
    const fraudDemo = generateFraudDemoData(trigger.id);

    // Fetch the real-time evaluated payout scaling from the backend
    let evaluatedPayout = trigger.payout;
    try {
      const earnings = user?.dailyEarnings || 500;
      const res = await fetch(`${API_URL}/api/triggers/weather?demo=true&city=Mumbai&dailyEarnings=${earnings}`);
      if (res.ok) {
        const data = await res.json();
        // demo=true boosts rain to trigger Heavy Rain (base 680)
        // We calculate the dynamic income scaling factor the backend applied
        const scaleFactor = data.triggerPayout / 680;
        evaluatedPayout = Math.round(trigger.payout * scaleFactor);
      }
    } catch (e) {
      console.error("Failed to fetch dynamic payout:", e);
    }

    const newClaim: Claim = {
      id: `CLM-${String(claims.length + 1).padStart(3, "0")}`,
      trigger: trigger.icon, type: trigger.label,
      date: new Date().toISOString().split("T")[0],
      payout: evaluatedPayout, status: "Processing...",
      fraudScore: 0,
      timeline: [`Detecting ${trigger.label}...`, "Checking GPS...", "Verifying Oracle...", "Checking Activity...", `Decision Pending...`],
    };

    setActiveClaim(newClaim);
    setTimelineStep(1);
    await new Promise((r) => setTimeout(r, 400));
    setTimelineStep(2);
    await new Promise((r) => setTimeout(r, 400));
    setTimelineStep(3);

    try {
      const res = await fetch(`${API_URL}/api/claims/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newClaim.id,
          type: trigger.label,
          trigger: trigger.icon,
          date: newClaim.date,
          payout: evaluatedPayout,
          claimed_rain: trigger.id === "rain" ? 45 : 0,
          gps_speed: 30,
          user_trust_score: 85,
          userLocation: fraudDemo.userLocation,
          actualLocation: fraudDemo.actualLocation,
          activity: fraudDemo.activity,
          demoMode: true,
          city: user?.city || "Mumbai",
          profession: user?.profession || "delivery_rider",
          enrolledAt: user?.enrolledAt || new Date().toISOString(),
          plan: user?.plan || "Standard",
        }),
      });

      setTimelineStep(4);
      await new Promise((r) => setTimeout(r, 500));

      if (res.ok) {
        const data = await res.json();
        newClaim.fraudScore = data.claim?.fraudScore ?? data.ai_engine?.fraud_probability ?? 0;
        newClaim.status = data.claim?.status === "REJECTED" ? "Rejected" : "Transferred";
        newClaim.reasons = data.claim?.reasons || [];
        
        if (newClaim.status === "Rejected") {
          newClaim.timeline[4] = "Fraud Blocked 🔴";
        } else {
          newClaim.timeline[4] = `₹${evaluatedPayout} Sent ✅`;
        }

        if (data.payout) {
          newClaim.transactionId = data.payout.transactionId;
          newClaim.gateway = data.payout.gateway;
        }
      } else {
        newClaim.status = "Transferred";
        newClaim.timeline[4] = `₹${evaluatedPayout} Sent ✅`;
      }
    } catch {
      newClaim.status = "Transferred";
      newClaim.timeline[4] = `₹${evaluatedPayout} Sent ✅`;
      setTimelineStep(4);
      await new Promise((r) => setTimeout(r, 600));
    }

    setTimelineStep(4);
    setClaims((prev) => [{ ...newClaim }, ...prev]);
    setSimulating(false);
    setTimeout(() => setActiveClaim(null), 3000);
  };

  // ── Live weather fetch ─────────────────────────────────────────────────
  const fetchLiveWeather = useCallback(async () => {
    setLiveState("loading");
    autoTriggered.current = false;

    try {
      const query = `?city=Mumbai${demoBoost ? "&demo=true" : ""}${user?.pincode ? `&pincode=${user.pincode}` : ""}${user?.dailyEarnings ? `&dailyEarnings=${user.dailyEarnings}` : ""}`;
      let res = await fetch(`${API_URL}/api/triggers/weather${query}`);
      if (!res.ok) {
        res = await fetch(`/api/triggers/weather${query}`);
      }
      if (!res.ok) throw new Error("API error");

      const data: WeatherTriggerResult = await res.json();
      setWeatherResult(data);
      setLiveState(data.triggered ? "triggered" : "fetched");
    } catch {
      // Fallback: still show a result
      setWeatherResult(null);
      setLiveState("fetched");
    }
  }, [API_URL, demoBoost]);

  // Fetch weather on Live mode toggle
  useEffect(() => {
    if (isLiveMode) {
      fetchLiveWeather();
    } else {
      setLiveState("idle");
      setWeatherResult(null);
      autoTriggered.current = false;
    }
  }, [isLiveMode, demoBoost, fetchLiveWeather]);

  // Auto-trigger claim when weather trigger detected
  useEffect(() => {
    if (liveState === "triggered" && weatherResult?.triggered && !autoTriggered.current && !simulating) {
      autoTriggered.current = true;
      
      const triggerType = weatherResult.triggerType || "rain";
      const matchedTrigger = TRIGGERS.find(t => t.id === triggerType) || TRIGGERS[0];

      // Delay slightly for UX impact
      const timer = setTimeout(() => {
        setLiveState("processing");
        simulateLiveClaim(matchedTrigger, weatherResult);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [liveState, weatherResult, simulating]);

  // ── Live claim pipeline (auto-triggered) ───────────────────────────────
  const simulateLiveClaim = async (trigger: typeof TRIGGERS[number], result: WeatherTriggerResult) => {
    setSimulating(true);
    setTimelineStep(0);
    const fraudDemo = generateFraudDemoData(trigger.id);

    const newClaim: Claim = {
      id: `CLM-${String(claims.length + 1).padStart(3, "0")}`,
      trigger: trigger.icon,
      type: result.triggerLabel || trigger.label,
      date: new Date().toISOString().split("T")[0],
      payout: result.triggerPayout || trigger.payout,
      status: "Processing...",
      fraudScore: 0,
      timeline: [
        `🌐 ${result.weather.condition} Detected`,
        "Checking GPS...",
        "Evaluating Oracle...",
        "Checking Activity...",
        `Decision Pending...`,
      ],
    };

    setActiveClaim(newClaim);
    setTimelineStep(1);
    await new Promise((r) => setTimeout(r, 600));
    setTimelineStep(2);
    await new Promise((r) => setTimeout(r, 400));
    setTimelineStep(3);

    try {
      const res = await fetch(`${API_URL}/api/claims/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newClaim.id,
          type: result.triggerLabel || trigger.label,
          trigger: trigger.icon,
          date: newClaim.date,
          payout: result.triggerPayout || trigger.payout,
          claimed_rain: result.weather.rain,
          gps_speed: 30,
          user_trust_score: 85,
          userLocation: fraudDemo.userLocation,
          actualLocation: fraudDemo.actualLocation,
          activity: fraudDemo.activity,
          demoMode: demoBoost
        }),
      });

      setTimelineStep(4);
      await new Promise((r) => setTimeout(r, 700));

      if (res.ok) {
        const data = await res.json();
        newClaim.fraudScore = data.claim?.fraudScore ?? data.ai_engine?.fraud_probability ?? 0;
        newClaim.status = data.claim?.status === "REJECTED" ? "Rejected" : "Transferred";
        newClaim.reasons = data.claim?.reasons || [];

        if (newClaim.status === "Rejected") {
          newClaim.timeline[4] = "Fraud Blocked 🔴";
        } else {
          newClaim.timeline[4] = `₹${result.triggerPayout || trigger.payout} Sent ✅`;
        }

        if (data.payout) {
          newClaim.transactionId = data.payout.transactionId;
          newClaim.gateway = data.payout.gateway;
        }
      } else {
        newClaim.status = "Transferred";
        newClaim.timeline[4] = `₹${result.triggerPayout || trigger.payout} Sent ✅`;
      }
    } catch {
      newClaim.status = "Transferred";
      newClaim.timeline[4] = `₹${result.triggerPayout || trigger.payout} Sent ✅`;
      setTimelineStep(4);
      await new Promise((r) => setTimeout(r, 800));
    }

    setTimelineStep(4);
    setClaims((prev) => [{ ...newClaim }, ...prev]);
    setSimulating(false);
    setLiveState("complete");
    setTimeout(() => setActiveClaim(null), 4000);
  };

  const planDetails: Record<string, { coverage: number; premium: number }> = {
    Basic: { coverage: 5000, premium: 49 },
    Standard: { coverage: 10000, premium: 89 },
    Premium: { coverage: 20000, premium: 149 },
  };
  const currentPlan = user?.plan || "Standard";
  const planInfo = planDetails[currentPlan] || planDetails.Standard;
  
  const baseRiskScore = user?.riskScore || riskData?.risk_score || 65;

  useEffect(() => {
    setLiveRiskScore(baseRiskScore);
  }, [baseRiskScore]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveRiskScore((prev) => {
        const fluctuation = (Math.random() * 2) - 1; 
        let newScore = prev + fluctuation;
        if (newScore > baseRiskScore + 3) newScore = baseRiskScore + 3;
        if (newScore < baseRiskScore - 3) newScore = baseRiskScore - 3;
        return Number(newScore.toFixed(1));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [baseRiskScore]);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12 pb-24">
        
        {}
         <section className="space-y-4">
          <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>

          {/* Cooling-off Badge (Fix 3) */}
          {coolingOff.active && (
            <div className="inline-flex items-center gap-4 bg-[#F97316]/10 border border-[#F97316]/20 rounded-xl px-5 py-4 shadow-[0_0_20px_rgba(249,115,22,0.15)] backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#F97316] to-transparent" />
              <div className="w-10 h-10 rounded-full bg-[#F97316]/20 flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">⏳</div>
              <div>
                <div className="text-xs text-[#F97316]/80 uppercase tracking-widest font-bold mb-0.5">Cooling-Off Period Active</div>
                <div className="text-sm font-medium text-white">{coolingOff.hoursLeft}h remaining <span className="text-white/40">— claims restricted</span></div>
              </div>
            </div>
          )}

          <div className="inline-flex items-center gap-4 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-xl px-5 py-4 shadow-[0_0_20px_rgba(34,197,94,0.15)] backdrop-blur-md relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#22C55E] to-transparent" />
             <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center text-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
               💰
             </div>
             <div>
               <div className="text-xs text-[#22C55E]/80 uppercase tracking-widest font-bold mb-0.5">Value Protected This Month</div>
               <div className="text-2xl font-bold text-white font-mono">₹1,400</div>
             </div>
          </div>
        </section>

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {}
          <section className="grid grid-cols-2 gap-5">
            <div className="glass-card flex flex-col justify-between h-40">
              <span className="text-sm text-white/50 font-medium">Coverage Plan</span>
              <div>
                <div className="text-3xl font-semibold text-white mb-1">{currentPlan}</div>
                <div className="text-sm text-white/40">₹{planInfo.coverage.toLocaleString()} Max</div>
              </div>
            </div>
            
            <div className="glass-card flex flex-col justify-between h-40">
              <span className="text-sm text-white/50 font-medium">Disbursed</span>
              <div>
                <div className="text-3xl font-semibold text-white mb-1">₹{totalPaid.toLocaleString()}</div>
                <div className="text-sm text-white/40">{claims.length} Events</div>
              </div>
            </div>

            {}
            <div className="glass-card col-span-2 bg-gradient-to-br from-white/[0.03] to-brand-purple/[0.05] border-brand-purple/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div>
                  <span className="text-xs text-brand-purple uppercase tracking-[0.2em] font-bold block mb-2">Dynamic Premium</span>
                  <div className="text-3xl font-bold text-white font-mono flex items-baseline gap-1">
                    ₹{dpaEffective.toFixed(0)}
                    <span className="text-sm text-white/40 font-sans font-medium">/ weekly</span>
                  </div>
                </div>
                <div
                  className="text-[10px] font-bold px-3 py-1.5 rounded-full border tracking-widest uppercase shadow-sm"
                  style={{
                    color: flexColor(dpaFlex.label),
                    background: `${flexColor(dpaFlex.label)}15`,
                    borderColor: `${flexColor(dpaFlex.label)}30`,
                  }}
                >
                  {dpaFlex.label}
                </div>
              </div>

              {}
              {dpaHistory.length > 0 && (
                <div className="flex items-end gap-1 h-8 mb-3">
                  {dpaHistory.slice(-8).map((e, i) => {
                    const max = Math.max(...dpaHistory.slice(-8).map(x => x.contribution)) * 1.1;
                    const ratio = e.contribution / dpaEffective;
                    const barColor = ratio >= 0.95 ? "#22C55E" : ratio >= 0.75 ? "#EAB308" : "#EF4444";
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(15, (e.contribution / max) * 100)}%`,
                          background: barColor,
                          opacity: i === dpaHistory.slice(-8).length - 1 ? 1 : 0.5,
                        }}
                      />
                    );
                  })}
                </div>
              )}

              <Link
                href="/policy"
                className="text-xs text-[#8B5CF6] hover:text-[#a78bfa] transition-colors font-medium flex items-center gap-1"
              >
                Adjust Contribution →
              </Link>
            </div>
          </section>

          {}
          <section className="glass-card relative overflow-hidden flex flex-col p-8 border-[#8B5CF6]/30 bg-[#8B5CF6]/5">
            <div className="absolute top-6 left-6 text-sm font-semibold text-white/70 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse"></div>
              XGBoost Risk Monitor
            </div>
            <div className="absolute top-6 right-6 badge-active border-none bg-[#8B5CF6]/20 text-[#8B5CF6]">LIVE</div>
            
            <div className="mt-8 text-center space-y-2">
              <div className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 transition-all duration-300">
                {liveRiskScore.toFixed(1)}
              </div>
              <div className="text-sm text-white/50 uppercase tracking-widest">Index Score</div>
            </div>

            {}
            <div className="mt-8 bg-black/20 rounded-xl p-4 border border-white/5">
               <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Next 7 Days Risk</div>
               <div className="flex justify-between items-end border-b border-white/10 pb-2">
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-1.5 h-3 bg-[#22C55E] rounded-full"></div>
                     <span className="text-[10px] text-white/50">Mon</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-1.5 h-6 bg-[#EAB308] rounded-full"></div>
                     <span className="text-[10px] text-white/50">Tue</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                     <span className="text-base">🌧</span>
                     <div className="w-1.5 h-10 bg-[#EF4444] rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                     <span className="text-[10px] text-white">Wed</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-1.5 h-6 bg-[#EAB308] rounded-full"></div>
                     <span className="text-[10px] text-white/50">Thu</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-1.5 h-3 bg-[#22C55E] rounded-full"></div>
                     <span className="text-[10px] text-white/50">Fri</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-1.5 h-3 bg-[#22C55E] rounded-full"></div>
                     <span className="text-[10px] text-white/50">Sat</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-1.5 h-3 bg-[#22C55E] rounded-full"></div>
                     <span className="text-[10px] text-white/50">Sun</span>
                  </div>
               </div>
            </div>
          </section>
        </div>

        {/* ── Parametric Triggers Section ─────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Parametric Triggers</h2>

            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
              <button
                onClick={() => setIsLiveMode(false)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  !isLiveMode
                    ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                🎮 Simulation
              </button>
              <button
                onClick={() => setIsLiveMode(true)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isLiveMode
                    ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-lg shadow-[#22C55E]/30"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? "bg-white animate-pulse" : "bg-white/40"}`} />
                Live Mode
              </button>
            </div>

            {/* Demo Boost toggle — only visible in Live mode */}
            {isLiveMode && (
              <button
                onClick={() => setDemoBoost((prev) => !prev)}
                className={`px-3 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                  demoBoost
                    ? "bg-[#F97316]/10 border-[#F97316]/40 text-[#F97316] shadow-[0_0_12px_rgba(249,115,22,0.2)]"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                }`}
              >
                🚀 Demo Boost {demoBoost ? "ON" : "OFF"}
              </button>
            )}
          </div>
          
          {/* ── LIVE MODE ──────────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
          {isLiveMode ? (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Live Weather Card */}
              <div className={`glass-card !p-0 overflow-hidden border transition-all duration-500 ${
                liveState === "triggered" || liveState === "processing"
                  ? "border-[#EF4444]/40 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
                  : liveState === "complete"
                  ? "border-[#22C55E]/40 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                  : "border-white/10"
              }`}>
                {/* Header bar */}
                <div className={`px-6 py-3 flex items-center justify-between transition-colors duration-500 ${
                  liveState === "triggered" || liveState === "processing"
                    ? "bg-[#EF4444]/10"
                    : liveState === "complete"
                    ? "bg-[#22C55E]/10"
                    : "bg-white/5"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${
                      liveState === "loading" ? "bg-[#3B82F6]"
                        : liveState === "triggered" || liveState === "processing" ? "bg-[#EF4444]"
                        : liveState === "complete" ? "bg-[#22C55E]"
                        : "bg-[#8B5CF6]"
                    }`} />
                    <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">
                      {liveState === "loading" ? "Fetching Weather Data…"
                        : liveState === "triggered" ? "⚡ TRIGGER DETECTED"
                        : liveState === "processing" ? "⚡ AUTO-PROCESSING CLAIM"
                        : liveState === "complete" ? "✓ CLAIM PROCESSED"
                        : weatherResult?.weather.isLive ? "Live Weather Feed" : "Simulated Weather Feed"
                      }
                    </span>
                  </div>
                  <button
                    onClick={fetchLiveWeather}
                    disabled={liveState === "loading" || liveState === "processing"}
                    className="text-xs text-white/40 hover:text-white transition-colors disabled:opacity-30 flex items-center gap-1"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {/* Weather data body */}
                <div className="p-6">
                  {liveState === "loading" ? (
                    <div className="flex flex-col items-center py-8 gap-4">
                      <div className="w-8 h-8 border-[3px] border-white/10 border-t-[#3B82F6] rounded-full animate-spin" />
                      <div className="text-sm text-white/40">Querying OpenWeatherMap API…</div>
                    </div>
                  ) : weatherResult ? (
                    <div className="space-y-5">
                      {/* Main weather stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-black/30 rounded-2xl p-5 border border-white/5 text-center shadow-inner relative overflow-hidden group">
                          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="text-3xl mb-2 drop-shadow-md">🌧️</div>
                          <div className="text-3xl font-bold text-white font-mono tracking-tight">{weatherResult.weather.rain}<span className="text-sm text-white/40">mm</span></div>
                          <div className="text-[10px] text-blue-400/80 font-bold uppercase tracking-[0.2em] mt-2">Rainfall</div>
                        </div>
                        <div className="bg-black/30 rounded-2xl p-5 border border-white/5 text-center shadow-inner relative overflow-hidden group">
                          <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="text-3xl mb-2 drop-shadow-md">🌡️</div>
                          <div className="text-3xl font-bold text-white font-mono tracking-tight">{weatherResult.weather.temp}<span className="text-sm text-white/40">°C</span></div>
                          <div className="text-[10px] text-orange-400/80 font-bold uppercase tracking-[0.2em] mt-2">Temperature</div>
                        </div>
                        <div className="bg-black/30 rounded-2xl p-5 border border-white/5 text-center shadow-inner relative overflow-hidden group">
                          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="text-3xl mb-2 drop-shadow-md">💧</div>
                          <div className="text-3xl font-bold text-white font-mono tracking-tight">{weatherResult.weather.humidity}<span className="text-sm text-white/40">%</span></div>
                          <div className="text-[10px] text-cyan-400/80 font-bold uppercase tracking-[0.2em] mt-2">Humidity</div>
                        </div>
                        <div className="bg-black/30 rounded-2xl p-5 border border-white/5 text-center shadow-inner relative overflow-hidden group">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: riskColor(weatherResult.riskLevel) }} />
                          <div className="text-3xl mb-2 drop-shadow-md">📊</div>
                          <div className="text-3xl font-bold font-mono tracking-tight" style={{ color: riskColor(weatherResult.riskLevel) }}>
                            {weatherResult.riskScore}
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2" style={{ color: riskColor(weatherResult.riskLevel) }}>
                            {weatherResult.riskLevel}
                          </div>
                        </div>
                      </div>

                      {/* Condition & breakdown */}
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-black/20 rounded-xl p-4 border border-white/5">
                          <div className="text-xs text-white/40 uppercase tracking-widest mb-2 font-semibold">Condition</div>
                          <div className="text-lg font-semibold text-white">{weatherResult.weather.condition}</div>
                          <div className="text-sm text-white/50 capitalize">{weatherResult.weather.description}</div>
                          <div className="text-xs text-white/30 mt-2">
                            {weatherResult.weather.city} • Wind: {weatherResult.weather.windSpeed} m/s
                          </div>
                        </div>

                        <div className="flex-1 bg-black/20 rounded-xl p-4 border border-white/5">
                          <div className="text-xs text-white/40 uppercase tracking-widest mb-3 font-semibold">Trigger Breakdown</div>
                          <div className="space-y-2">
                            {weatherResult.breakdown.map((b) => (
                              <div key={b.factor} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${b.exceeded ? "bg-[#EF4444]" : "bg-[#22C55E]"}`} />
                                  <span className="text-white/70">{b.factor}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-white">{b.value.toFixed(1)}</span>
                                  <span className="text-white/30">/ {b.threshold}</span>
                                  {b.exceeded && <span className="text-[#EF4444] font-bold text-[10px]">EXCEEDED</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs">
                            <span className="text-white/50">Activity Disruption</span>
                            <span className="text-white font-mono font-semibold">{weatherResult.activityDrop}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Trigger status */}
                      {weatherResult.triggered && liveState !== "complete" && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-3 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]"
                        >
                          <span className="text-xl">⚡</span>
                          <div>
                            <div className="text-sm font-bold">
                              {liveState === "processing" ? "Auto-processing claim through pipeline…" : "Parametric trigger threshold exceeded!"}
                            </div>
                            <div className="text-xs opacity-70">
                              {weatherResult.triggerLabel} event detected — ₹{weatherResult.triggerPayout} payout {liveState === "processing" ? "in progress" : "will auto-initiate"}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {liveState === "complete" && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-3 p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]"
                        >
                          <span className="text-xl">✓</span>
                          <div>
                            <div className="text-sm font-bold">Claim processed successfully</div>
                            <div className="text-xs opacity-70">Payout has been initiated to your wallet. View in Claims Ledger.</div>
                          </div>
                        </motion.div>
                      )}

                      {!weatherResult.triggered && liveState === "fetched" && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-sm font-medium">
                          <span>✓</span>
                          <span>No triggers exceeded — conditions within safe thresholds. Monitoring continues.</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-white/20">
                        <span>{weatherResult.weather.isLive ? "🟢 Live API Data" : "🟡 Simulated Data"}</span>
                        <span>Updated: {new Date(weatherResult.evaluatedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/40 text-sm">
                      Failed to fetch weather data. <button onClick={fetchLiveWeather} className="text-[#3B82F6] underline">Retry</button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── SIMULATION MODE ───────────────────────────────────────────────── */
            <motion.div
              key="sim"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {TRIGGERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => !simulating && simulateClaim(t)}
                    disabled={simulating}
                    className="btn-trigger group disabled:opacity-50"
                  >
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{t.icon}</div>
                    <div className="text-sm font-medium text-white">{t.label}</div>
                    <div className="text-xs text-white/40 mt-1">₹{t.payout} Limit</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Pipeline animation (shared between both modes) */}
          <AnimatePresence>
            {activeClaim && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="glass-card overflow-hidden !p-6 border-[#3B82F6]/30 bg-[#3B82F6]/5"
              >
                <div className="font-semibold text-white flex items-center gap-3 mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
                  {isLiveMode ? "Live Execution Pipeline" : "Real-time Execution Pipeline"}
                </div>
                <div className="flex justify-between relative before:absolute before:inset-0 before:top-4 before:-ml-px before:h-0.5 before:w-full before:bg-white/10">
                  {activeClaim.timeline.map((step, i) => (
                    <div key={step} className="relative z-10 flex flex-col items-center text-center flex-1 px-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        i < timelineStep
                          ? i === activeClaim.timeline.length - 1 
                            ? (step.includes("Blocked") ? "bg-[#EF4444] text-[#0B0B12] shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-[#22C55E] text-[#0B0B12] shadow-[0_0_15px_rgba(34,197,94,0.4)]")
                            : "bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                          : "bg-[#0B0B12] text-white/30 border border-white/20"
                      }`}>
                        {i < timelineStep ? (i === activeClaim.timeline.length - 1 ? (step.includes("Blocked") ? "✕" : "✓") : "✓") : i + 1}
                      </div>
                      <span className={`mt-3 text-[10px] md:text-xs font-medium max-w-[100px] transition-colors leading-tight ${
                        i < timelineStep 
                          ? (i === activeClaim.timeline.length - 1 
                             ? (step.includes("Blocked") ? "text-[#EF4444]" : "text-[#22C55E]") 
                             : "text-white") 
                          : "text-white/40"}`}>{step}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-semibold text-white">Resolutions</h2>
            <Link href="/claims" className="text-sm text-[#3B82F6] hover:text-[#60a5fa] transition-colors">
              View Ledger →
            </Link>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {claims.slice(0, 3).map((claim, i) => (
                <motion.div
                  key={`${claim.id || 'claim'}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-xl shadow-inner">
                      {claim.trigger}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white mb-1">{claim.type} Event</div>
                      <div className="flex flex-col gap-1.5">
                        <div className="text-xs text-white/40 font-mono">{claim.id} • {claim.date}</div>
                        {claim.transactionId && (
                           <div className="flex items-center gap-1.5">
                             <div className="px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide uppercase bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 flex items-center justify-center">
                                {claim.gateway}
                             </div>
                             <span className="text-[10px] text-white/50 font-mono tracking-tight">{claim.transactionId}</span>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-lg font-semibold text-[#22C55E]">
                      ₹{claim.payout}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/30 hidden md:block">
                        AI Fraud Index: {claim.fraudScore.toFixed(3)}
                      </span>
                      {claim.status === "Processing..." ? (
                        <span className="badge-active bg-[#3B82F6]/10 text-[#3B82F6] border-none animate-pulse">{claim.status}</span>
                      ) : claim.status === "Rejected" ? (
                        <span className="badge-paid border-none bg-[#EF4444]/10 text-[#EF4444]">{claim.status}</span>
                      ) : (
                        <span className="badge-paid border-none bg-[#22C55E]/10 text-[#22C55E]">{claim.status}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {claims.length === 0 && (
              <div className="text-center py-10 text-white/40 text-sm glass-card border-dashed">
                No recent resolutions found on ledger.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
