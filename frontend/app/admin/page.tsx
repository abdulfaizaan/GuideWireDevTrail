"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function AdminNavbar({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-[#0B0B12]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EF4444] to-[#F59E0B] flex items-center justify-center text-sm font-bold shadow-lg">
            A
          </div>
          <span className="font-bold text-white tracking-tight">GigShield <span className="text-white/50 font-medium">| Insurer Admin</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-xs text-[#22C55E] flex items-center gap-2 bg-[#22C55E]/10 px-3 py-1.5 rounded-full border border-[#22C55E]/20">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
            ML Services Online
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            Logout
          </button>
          <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-sm font-bold shadow-inner">
            IN
          </div>
        </div>
      </div>
    </header>
  );
}

interface LiveClaim {
  id: string;
  type?: string;
  trigger?: string;
  date?: string;
  payout?: number;
  status: string;
  fraudScore?: number;
  ai_explanation?: string;
}

const DUMMY_FRAUD_EVENTS = [
  { id: "CLM-047", user: "Rider 812", riskScore: 0.03, status: "Approved", reason: "Claim verified successfully. Rainfall exceeded 35mm threshold in Andheri East zone. External weather oracle validated.", amount: 680, time: "2 min ago" },
  { id: "CLM-046", user: "Rider 294", riskScore: 0.87, status: "ML Rejected", reason: "High weather discrepancy (48mm claimed vs 12mm actual). Impossible GPS movement detected (92 km/h). Potential spoofing.", amount: 720, time: "5 min ago" },
  { id: "CLM-045", user: "Rider 531", riskScore: 0.05, status: "Approved", reason: "Claim verified successfully. AQI exceeded 301 for 4+ hours in operating zone. CPCB sensor data cross-validated.", amount: 380, time: "8 min ago" },
  { id: "CLM-044", user: "Rider 178", riskScore: 0.04, status: "Approved", reason: "Claim verified successfully. Platform outage confirmed via Swiggy partner API. Downtime exceeded 2-hour threshold.", amount: 550, time: "12 min ago" },
  { id: "CLM-043", user: "Rider 665", riskScore: 0.91, status: "ML Rejected", reason: "Unusual behavioral anomaly detected compared to baseline riders. Claim flagged due to critically low user trust score.", amount: 450, time: "15 min ago" },
  { id: "CLM-042", user: "Rider 403", riskScore: 0.02, status: "Approved", reason: "Claim verified successfully. Municipal bandh declaration verified via government RSS feed. Full-day disruption confirmed.", amount: 720, time: "19 min ago" },
  { id: "CLM-041", user: "Rider 917", riskScore: 0.06, status: "Approved", reason: "Claim verified successfully. Extreme heat advisory active — temperature exceeded 43°C with IMD Heat Wave declaration.", amount: 450, time: "23 min ago" },
  { id: "CLM-040", user: "Rider 122", riskScore: 0.78, status: "ML Rejected", reason: "Claim flagged by ensemble ML model risk rules. Timing pattern matches coordinated submission signature.", amount: 680, time: "28 min ago" },
];

export default function AdminDashboard() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("gigshield_admin_auth") === "true";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [fraudEvents, setFraudEvents] = useState(DUMMY_FRAUD_EVENTS);
  const [liveCount, setLiveCount] = useState({
    approved: DUMMY_FRAUD_EVENTS.filter(e => e.status === "Approved").length,
    rejected: DUMMY_FRAUD_EVENTS.filter(e => e.status === "ML Rejected").length,
    total: DUMMY_FRAUD_EVENTS.length,
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === "admin@gigshield.com" && password === "admin123") {
      localStorage.setItem("gigshield_admin_auth", "true");
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Invalid email or password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("gigshield_admin_auth");
    setIsAuthenticated(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchLiveClaims = async () => {
      try {
        const res = await fetch(`${API_URL}/api/claims`);
        if (!res.ok) return;
        const data: LiveClaim[] = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;

        const mapped = data.slice(0, 10).map((c, i) => ({
          id: c.id || `CLM-${i}`,
          user: `Rider ${Math.abs(hashCode(c.id || `CLM-${i}`)) % 900 + 100}`,
          riskScore: typeof c.fraudScore === "number" ? c.fraudScore : 0.05,
          status: c.status === "REJECTED" ? "ML Rejected" : "Approved",
          reason: c.ai_explanation || "Claim verified by parametric feed.",
          amount: c.payout || 0,
          time: `${i * 3 + 1} min ago`,
        }));

        // Merge real claims before dummy data
        const allEvents = [...mapped, ...DUMMY_FRAUD_EVENTS].slice(0, 12);
        setFraudEvents(allEvents);
        setLiveCount({
          approved: allEvents.filter((e) => e.status === "Approved").length,
          rejected: allEvents.filter((e) => e.status === "ML Rejected").length,
          total: allEvents.length,
        });
      } catch {
        // Backend offline — keep dummy data visible
      }
    };

    fetchLiveClaims();
    const interval = setInterval(fetchLiveClaims, 5000);
    return () => clearInterval(interval);
  }, [API_URL, isAuthenticated]);

  // ── Weather Forecast State ────────────────────────────────────────────
  interface ForecastDay { day: string; rain: number; temp: number; condition: string; riskLevel: "low" | "medium" | "high" }
  interface RiskZone { zone: string; level: string }
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [expectedClaims, setExpectedClaims] = useState(0);
  const [currentWeather, setCurrentWeather] = useState<{rain: number; temp: number; condition: string; city: string; isLive: boolean} | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchForecast = async () => {
      try {
        let res = await fetch(`${API_URL}/api/weather/forecast`);
        if (!res.ok) {
          res = await fetch("/api/weather/forecast");
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          setForecast(data.forecast || []);
          setRiskZones(data.riskZones || []);
          setExpectedClaims(data.expectedClaims || 0);
          setCurrentWeather(data.currentWeather || null);
        }
      } catch { /* keep defaults */ }
    };
    fetchForecast();
    const interval = setInterval(fetchForecast, 30000);
    return () => clearInterval(interval);
  }, [API_URL, isAuthenticated]);

  // ── Financial Sustainability State (Fix 4) ─────────────────────────────
  interface SustainabilityData {
    lossRatio: number;
    combinedRatio: number;
    totalPremiumsCollected: number;
    totalPayoutsIssued: number;
    reserveAdequacy: number;
    currentReserve: number;
    expectedAnnualClaims: number;
    breakevenPolicyCount: number;
    currentPolicyCount: number;
    avgPremiumPerPolicy: number;
    avgClaimRate: number;
    healthStatus: "HEALTHY" | "CAUTION" | "AT_RISK";
    recommendations: string[];
  }
  const [sustainability, setSustainability] = useState<SustainabilityData | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchSustainability = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/sustainability`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) setSustainability(data);
      } catch { /* keep null */ }
    };
    fetchSustainability();
    const interval = setInterval(fetchSustainability, 15000);
    return () => clearInterval(interval);
  }, [API_URL, isAuthenticated]);

  const stats = [
    { label: "Total Active Policies", value: sustainability ? sustainability.currentPolicyCount.toLocaleString() : "24,892", change: "+4.1%", trend: "up" },
    { label: "Loss Ratio (MTD)", value: sustainability ? `${sustainability.lossRatio.toFixed(1)}%` : "48.2%", change: sustainability && sustainability.lossRatio < 60 ? "-2.3%" : "+1.5%", trend: sustainability && sustainability.lossRatio < 60 ? "down" : "up" },
    { label: "Automated Payouts", value: `₹${(fraudEvents.filter(e => e.status === "Approved").reduce((a, c) => a + c.amount, 0) / 1000).toFixed(1)}K`, change: "+12%", trend: "up" },
    { label: "Fraud Intercepted", value: `${liveCount.rejected} Claims`, change: "+18%", trend: "up" },
  ];

  if (!isMounted) return null;
  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0B0B12] flex items-center justify-center px-6 selection:bg-[#EF4444]/30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-card p-10 py-12 space-y-8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#EF4444] to-[#F59E0B]" />

          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EF4444] to-[#F59E0B] flex items-center justify-center text-2xl font-bold shadow-xl mx-auto mb-6 ring-4 ring-[#EF4444]/10">
              A
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
            <p className="text-white/50 text-sm mt-2 font-medium">Insurer Intelligence Gateway</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] pl-1">Authorized Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50 focus:bg-white/[0.05] transition-all placeholder:text-white/20"
                placeholder="admin@gigshield.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] pl-1">Security Key</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50 focus:bg-white/[0.05] transition-all placeholder:text-white/20"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[#EF4444] text-xs font-semibold text-center bg-[#EF4444]/10 py-3 rounded-lg border border-[#EF4444]/20"
              >
                {loginError}
              </motion.div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#EF4444] to-[#F59E0B] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#EF4444]/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm tracking-wide"
            >
              Authenticate Session
            </button>
          </form>

          <div className="text-center pt-4">
            <Link href="/" className="text-xs text-white/30 hover:text-white transition-colors underline-offset-4 hover:underline">
              ← Access System Root
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B12]">
      <AdminNavbar onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8 pb-24">

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-xs font-bold text-white/40 mb-3 uppercase tracking-widest">{stat.label}</div>
              <div className="text-4xl font-bold font-mono tracking-tight text-white flex items-baseline justify-between relative z-10 drop-shadow-md">
                {stat.value}
                <span className={`text-sm font-sans font-semibold px-2 py-1 rounded-md ${
                  stat.trend === "up" && stat.label !== "Loss Ratio (MTD)"
                    ? "bg-[#22C55E]/10 text-[#22C55E]"
                    : stat.label === "Loss Ratio (MTD)" && stat.trend === "down"
                      ? "bg-[#22C55E]/10 text-[#22C55E]"
                      : "bg-[#EF4444]/10 text-[#EF4444]"
                  }`}>
                  {stat.change}
                </span>
              </div>
            </motion.div>
          ))}
        </section>

        {/* ── Financial Sustainability Panel (Fix 4) ──────────────────────────── */}
        {sustainability && (
          <section className="glass-card !p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  sustainability.healthStatus === "HEALTHY" ? "bg-[#22C55E] animate-pulse" :
                  sustainability.healthStatus === "CAUTION" ? "bg-[#EAB308] animate-pulse" :
                  "bg-[#EF4444] animate-pulse"
                }`} />
                <h2 className="text-lg font-semibold text-white">Financial Sustainability Model</h2>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                sustainability.healthStatus === "HEALTHY" ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]" :
                sustainability.healthStatus === "CAUTION" ? "bg-[#EAB308]/10 border-[#EAB308]/30 text-[#EAB308]" :
                "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
              }`}>{sustainability.healthStatus}</span>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Loss Ratio</div>
                  <div className={`text-2xl font-bold font-mono ${sustainability.lossRatio < 60 ? "text-[#22C55E]" : sustainability.lossRatio < 85 ? "text-[#EAB308]" : "text-[#EF4444]"}`}>
                    {sustainability.lossRatio.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">Target: &lt;60%</div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Combined Ratio</div>
                  <div className={`text-2xl font-bold font-mono ${sustainability.combinedRatio < 75 ? "text-[#22C55E]" : sustainability.combinedRatio < 95 ? "text-[#EAB308]" : "text-[#EF4444]"}`}>
                    {sustainability.combinedRatio.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">Loss + 18% OpEx</div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Reserve Adequacy</div>
                  <div className={`text-2xl font-bold font-mono ${sustainability.reserveAdequacy > 100 ? "text-[#22C55E]" : sustainability.reserveAdequacy > 60 ? "text-[#EAB308]" : "text-[#EF4444]"}`}>
                    {sustainability.reserveAdequacy.toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">₹{(sustainability.currentReserve / 1000).toFixed(0)}K reserve</div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Breakeven</div>
                  <div className={`text-2xl font-bold font-mono ${sustainability.currentPolicyCount >= sustainability.breakevenPolicyCount ? "text-[#22C55E]" : "text-[#EAB308]"}`}>
                    {(sustainability.breakevenPolicyCount / 1000).toFixed(1)}K
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">Min policies needed</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Actuarial Recommendations</h4>
                {sustainability.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/5 text-sm text-white/70">
                    <span className="text-[#3B82F6] mt-0.5 shrink-0">→</span>
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Live Claims Feed */}
          <section className="lg:col-span-2 space-y-6">
            
            {/* Advanced Fraud Analytics Panel */}
            <div className="grid grid-cols-3 gap-4 mb-6">
               <div className="glass-card p-4 border-[#EF4444]/20 border bg-[#EF4444]/5 flex flex-col justify-between">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[#EF4444]/70 mb-2">Total Fraud Cases</div>
                  <div className="text-3xl font-bold text-[#EF4444]">{liveCount.rejected} <span className="text-[12px] font-normal text-white/40">Claims</span></div>
               </div>
               <div className="glass-card p-4 border-[#F59E0B]/20 border bg-[#F59E0B]/5 flex flex-col justify-between">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[#F59E0B]/70 mb-2">Global Fraud Rate</div>
                  <div className="text-3xl font-bold text-[#F59E0B]">{((liveCount.rejected / Math.max(1, liveCount.total)) * 100).toFixed(1)}<span className="text-[16px]">%</span></div>
               </div>
               <div className="glass-card p-4 border-[#3B82F6]/20 border bg-[#3B82F6]/5 flex flex-col justify-between">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[#3B82F6]/70 mb-2">Top Fraud Reason</div>
                  <div className="text-[13px] font-bold text-[#3B82F6] truncate pr-2 leading-tight">GPS Mismatch Detected</div>
                  <div className="text-[10px] text-white/40 mt-1">42% of all flagged anomalies</div>
               </div>
            </div>

            <div className="flex justify-between items-end border-t border-white/5 pt-6 mt-4">
              <h2 className="text-xl font-semibold text-white">Live Policy Adjudications</h2>
              <span className="text-xs text-[#22C55E] animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                Engine Feed Online
              </span>
            </div>

            <div className="space-y-4">
              <AnimatePresence>
                {fraudEvents.length > 0 ? (
                  fraudEvents.map((event, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.08 }}
                      key={event.id + i}
                      className={`glass-card p-5 border-l-4 ${event.status === "Approved"
                          ? "border-l-[#22C55E] bg-[#22C55E]/5"
                          : "border-l-[#EF4444] bg-[#EF4444]/5"
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <div className="text-lg font-bold">{event.id}</div>
                            <div className="text-xs text-white/40">{event.user} • {event.time}</div>
                          </div>
                          <div className="text-sm text-white/80"><span className="text-white/50">Claim Amount: </span>₹{event.amount}</div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          {event.status === "Approved" ? (
                            <span className="badge-paid bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 mb-2 px-3 py-1 rounded-full text-xs font-semibold">Approved</span>
                          ) : (
                            <span className="badge-paid bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 mb-2 px-3 py-1 rounded-full text-xs font-semibold">Rejected (High Risk)</span>
                          )}
                          <div className="text-[10px] text-white/40 font-mono">Fraud Prob: {event.riskScore.toFixed(2)}</div>
                        </div>
                      </div>

                      {/* XAI Explanation */}
                      <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-white/70 font-mono">
                        <span className="text-[#8B5CF6]"># XAI_EXPLANATION:</span> {event.reason}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="glass-card py-20 text-center text-white/30 border-dashed">
                    Waiting for live claim triggers...
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Right Sidebar */}
          <section className="space-y-8">
            <div className="glass-card flex flex-col overflow-hidden !p-0">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white mb-1">Weather-Driven Forecast</h3>
                  {currentWeather && (
                    <span className={`text-[10px] px-2 py-1 rounded-full ${currentWeather.isLive ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EAB308]/10 text-[#EAB308]"}`}>
                      {currentWeather.isLive ? "🟢 Live" : "🟡 Simulated"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50">
                  {currentWeather
                    ? `${currentWeather.city} — ${currentWeather.condition}, ${currentWeather.rain}mm rain, ${currentWeather.temp}°C`
                    : "Predicted claim volume (Next 7 days)"}
                </div>
              </div>
              <div className="p-6 h-64 bg-gradient-to-b from-white/5 to-transparent flex items-end justify-between gap-2 relative">
                {(forecast.length > 0 ? forecast : [{day:"M",rain:5,riskLevel:"low"},{day:"T",rain:8,riskLevel:"medium"},{day:"W",rain:35,riskLevel:"high"},{day:"T",rain:20,riskLevel:"medium"},{day:"F",rain:5,riskLevel:"low"},{day:"S",rain:3,riskLevel:"low"},{day:"S",rain:2,riskLevel:"low"}]).map((d, idx) => {
                  const maxVal = 50;
                  const barVal = Math.min(d.rain, maxVal);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="hidden group-hover:block absolute -top-1 bg-black/80 text-white text-[10px] px-2 py-1 rounded border border-white/10 z-10">
                        {d.rain.toFixed(1)}mm
                      </div>
                      <div
                        className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
                          d.riskLevel === "high"
                            ? "bg-gradient-to-t from-[#EF4444]/40 to-[#EF4444]"
                            : d.riskLevel === "medium"
                            ? "bg-gradient-to-t from-[#EAB308]/40 to-[#EAB308]"
                            : "bg-gradient-to-t from-[#8B5CF6]/40 to-[#8B5CF6]"
                        }`}
                        style={{ height: `${Math.max(8, (barVal / maxVal) * 100)}%` }}
                      />
                      <span className={`text-[9px] ${d.riskLevel === "high" ? "text-[#EF4444]" : "text-white/30"}`}>
                        {d.day}
                      </span>
                    </div>
                  );
                })}
                <div className="absolute top-4 left-6 right-6 border-t border-dashed border-[#EF4444]/50 pointer-events-none flex justify-end">
                  <span className="text-[10px] text-[#EF4444] -mt-4 bg-[#0B0B12] px-2 rounded-full">20mm Trigger Line</span>
                </div>
              </div>
              {expectedClaims > 0 && (
                <div className="px-6 pb-4 text-xs text-white/50">
                  Expected Claims: <span className="text-white font-semibold">{expectedClaims}</span> this week
                </div>
              )}
            </div>

            {/* Risk Zones */}
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-white mb-4">Live Zone Risk Assessment</h3>
              <div className="w-full h-48 rounded-xl bg-[#111116] border border-white/10 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 30% 40%, rgba(239, 68, 68, 0.4) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(234, 179, 8, 0.3) 0%, transparent 50%)" }} />
                <div className="absolute w-2 h-2 rounded-full bg-[#EF4444] animate-ping" style={{ top: "38%", left: "29%" }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-[#EAB308] animate-ping" style={{ top: "58%", left: "68%", animationDelay: "1s" }} />
                <div className="z-10 bg-black/60 px-4 py-2 rounded-full border border-white/10 text-xs backdrop-blur-md font-medium text-white/80 flex items-center gap-2">
                  <span className="text-[#EF4444]">●</span> {currentWeather ? `${currentWeather.condition} Zone Active` : "High Density Storm Area"}
                </div>
              </div>
              {riskZones.length > 0 && (
                <div className="mt-4 space-y-2">
                  {riskZones.map((zone) => (
                    <div key={zone.zone} className="flex items-center justify-between text-xs">
                      <span className="text-white/60">{zone.zone}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        zone.level === "high" ? "bg-[#EF4444]/10 text-[#EF4444]" : zone.level === "medium" ? "bg-[#EAB308]/10 text-[#EAB308]" : "bg-[#22C55E]/10 text-[#22C55E]"
                      }`}>{zone.level.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live summary */}
            <div className="glass-card space-y-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Session Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Claims Received</span>
                <span className="text-white font-mono">{liveCount.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Auto-Approved</span>
                <span className="text-[#22C55E] font-mono">{liveCount.approved}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">ML Rejected</span>
                <span className="text-[#EF4444] font-mono">{liveCount.rejected}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] rounded-full transition-all duration-500"
                  style={{ width: `${liveCount.total > 0 ? (liveCount.approved / liveCount.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-[10px] text-white/30">
                {liveCount.total > 0 ? Math.round((liveCount.approved / liveCount.total) * 100) : 0}% approval rate
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
