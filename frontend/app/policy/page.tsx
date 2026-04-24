"use client";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  simulateDPA,
  computeEffectivePremium,
  computeFlexibility,
  PLAN_DEFINITIONS,
  type WeeklyEntry,
  type FlexLabel,
  type BasePlan,
} from "../lib/dpa";
import { loadHistory, addWeeklyContribution } from "../lib/dpa-store";



const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/policy", label: "Policy" },
  { href: "/claims", label: "Claims" },
];

function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 bg-[#0B0B12]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-sm font-bold shadow-lg">G</div>
          <span className="font-bold text-white tracking-tight">GigShield</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`text-sm font-medium transition-colors ${pathname === n.href ? "text-white" : "text-white/50 hover:text-white/80"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col items-end">
          <div className="text-sm font-medium text-white">Partner Portal</div>
          <div className="text-xs text-[#22C55E]">● Connected</div>
        </div>
      </div>
    </header>
  );
}



const TRIGGER_META: Record<string, { icon: string; label: string; color: string }> = {
  rain:   { icon: "🌧️", label: "Heavy Rain",          color: "#3B82F6" },
  heat:   { icon: "🌡️", label: "Thermal Maximum",     color: "#F97316" },
  aqi:    { icon: "😷", label: "Air Quality Crisis",  color: "#F59E0B" },
  outage: { icon: "📵", label: "Platform Interruption", color: "#8B5CF6" },
  bandh:  { icon: "🚫", label: "Civil Containment",   color: "#EF4444" },
};

function flexColor(label: FlexLabel): string {
  return label === "Stable" ? "#22C55E" : label === "Fluctuating" ? "#EAB308" : "#EF4444";
}

function flexBg(label: FlexLabel): string {
  return label === "Stable"
    ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]"
    : label === "Fluctuating"
    ? "bg-[#EAB308]/10 border-[#EAB308]/30 text-[#EAB308]"
    : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]";
}

interface StoredUser {
  plan?: string;
  riskScore?: number;
}

function getInitialPolicyState() {
  const defaultPlan = PLAN_DEFINITIONS.Standard;
  const defaultHistory = typeof window === "undefined" ? [] : loadHistory("Standard");
  const defaultEffective = defaultHistory.length > 0 ? computeEffectivePremium(defaultHistory) : defaultPlan.basePremium;
  const defaultFlex = defaultHistory.length > 0 ? computeFlexibility(defaultHistory) : computeFlexibility([]);

  if (typeof window === "undefined") {
    return {
      user: null as StoredUser | null,
      plan: defaultPlan,
      history: defaultHistory,
      sliderValue: defaultPlan.basePremium,
      currentEffective: defaultEffective,
      currentFlex: defaultFlex,
    };
  }

  const stored = localStorage.getItem("gigshield_user");
  if (!stored) {
    return {
      user: null as StoredUser | null,
      plan: defaultPlan,
      history: defaultHistory,
      sliderValue: defaultPlan.basePremium,
      currentEffective: defaultEffective,
      currentFlex: defaultFlex,
    };
  }

  try {
    const parsed = JSON.parse(stored) as StoredUser;
    const plan = PLAN_DEFINITIONS[parsed.plan ?? "Standard"] ?? defaultPlan;
    const history = loadHistory(parsed.plan ?? "Standard");

    return {
      user: parsed,
      plan,
      history,
      sliderValue: plan.basePremium,
      currentEffective: history.length > 0 ? computeEffectivePremium(history) : plan.basePremium,
      currentFlex: history.length > 0 ? computeFlexibility(history) : computeFlexibility([]),
    };
  } catch {
    return {
      user: null as StoredUser | null,
      plan: defaultPlan,
      history: defaultHistory,
      sliderValue: defaultPlan.basePremium,
      currentEffective: defaultEffective,
      currentFlex: defaultFlex,
    };
  }
}



function HistoryChart({
  history,
  effectivePremium,
}: {
  history: WeeklyEntry[];
  effectivePremium: number;
}) {
  const visible = history.slice(-12); 
  const max = Math.max(...visible.map((e) => e.contribution), effectivePremium) * 1.15;

  return (
    <div className="relative w-full">
      {}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 border-t border-dashed border-white/30" />
        <span className="text-[11px] text-white/40 font-mono">
          Effective ₹{effectivePremium.toFixed(0)}
        </span>
      </div>

      {}
      <div className="relative flex items-end gap-2 h-28">
        {}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-white/20 pointer-events-none"
          style={{ bottom: `${(effectivePremium / max) * 100}%` }}
        />

        {visible.map((entry, i) => {
          const ratio = entry.contribution / effectivePremium;
          const barH = `${Math.max(8, (entry.contribution / max) * 100)}%`;
          const barColor =
            ratio >= 0.95
              ? "bg-[#22C55E]"
              : ratio >= 0.75
              ? "bg-[#EAB308]"
              : "bg-[#EF4444]";
          const isLast = i === visible.length - 1;

          return (
            <motion.div
              key={entry.label}
              className="flex flex-col items-center flex-1 gap-1 group"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              style={{ originY: "bottom" }}
              transition={{ delay: i * 0.04 }}
            >
              {}
              {isLast && (
                <div className="text-[10px] text-white/60 font-mono">
                  ₹{entry.contribution}
                </div>
              )}
              <div
                className={`w-full rounded-t-md ${barColor} relative transition-all duration-300 ${
                  isLast ? "ring-1 ring-white/30" : ""
                }`}
                style={{ height: barH }}
              >
                {}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                  <div className="bg-black/90 border border-white/10 rounded px-2 py-1 text-[10px] text-white font-mono whitespace-nowrap">
                    ₹{entry.contribution}
                  </div>
                  <div className="w-1.5 h-1.5 bg-black/90 rotate-45 -mt-0.5 border-r border-b border-white/10" />
                </div>
              </div>
              <span className="text-[9px] text-white/30 font-mono">{entry.label}</span>
            </motion.div>
          );
        })}
      </div>

      {}
      <div className="flex gap-4 mt-3">
        {[
          { color: "bg-[#22C55E]", label: "≥ 95% of effective" },
          { color: "bg-[#EAB308]", label: "75–95%" },
          { color: "bg-[#EF4444]", label: "< 75%" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${l.color}`} />
            <span className="text-[10px] text-white/30">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}



export default function PolicyPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const initialState = useMemo(() => getInitialPolicyState(), []);
  const [user] = useState<StoredUser | null>(initialState.user);
  const [plan] = useState<BasePlan>(initialState.plan);
  const [history, setHistory] = useState<WeeklyEntry[]>(initialState.history);
  const [sliderValue, setSliderValue] = useState<number>(initialState.sliderValue);
  const [currentEffective, setCurrentEffective] = useState<number>(initialState.currentEffective);
  const [currentFlex, setCurrentFlex] = useState(initialState.currentFlex);
  const [lockedIn, setLockedIn] = useState(false);
  const [lockToast, setLockToast] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  
  const premiumBreakdown = [
    { label: "Base Tier Pricing", value: "₹49", pct: 100, color: "bg-white/20" },
    { label: "Zone Vulnerability", value: "+35%", pct: 35, color: "bg-[#3B82F6]" },
    { label: "Seasonal Dynamics", value: "+25%", pct: 25, color: "bg-[#8B5CF6]" },
    { label: "Algorithmic Profile", value: "+12%", pct: 12, color: "bg-[#6366F1]" },
  ];

  const snapshot = useMemo(() => {
    if (history.length === 0) {
      return null;
    }

    const riskScore = user?.riskScore ?? 65;
    return simulateDPA(history, sliderValue, plan, riskScore);
  }, [history, plan, sliderValue, user?.riskScore]);

  const handleLockIn = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/payment/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: sliderValue }),
      });
      const data = await res.json();

      if (!data.success) {
        alert("Failed to initiate payment");
        return;
      }

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_ScqqkDkAaShrbI",
        amount: data.order.amount,
        currency: "INR",
        name: "GigShield",
        description: "Weekly Premium",
        order_id: data.order.id,
        handler: async function (response: RazorpayResponse) {
          const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            const updated = addWeeklyContribution(history, sliderValue);
            setHistory(updated);
            const eff = computeEffectivePremium(updated);
            setCurrentEffective(eff);
            setCurrentFlex(computeFlexibility(updated));
            setLockedIn(true);
            setLockToast(true);
            if (toastTimeout.current) clearTimeout(toastTimeout.current);
            toastTimeout.current = setTimeout(() => setLockToast(false), 3500);
          } else {
            alert("Payment verification failed. Please try again.");
          }
        },
        theme: { color: "#8B5CF6" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error(e);
      alert("Payment error: " + (e as Error).message);
    }
  }, [API_URL, history, sliderValue]);

  const daysRemaining = 23;
  const currentPlan = user?.plan || "Standard";

  
  const coverageDir =
    snapshot && snapshot.coverage.coverage > plan.baseCoverage
      ? "↑"
      : snapshot && snapshot.coverage.coverage < plan.baseCoverage
      ? "↓"
      : "→";

  if (!isMounted) return null;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10 pb-28">

        {}
        <section className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Policy Settings</h1>
          <p className="text-white/50 text-base">
            Manage your coverage tier and dynamically adjust your weekly contribution.
          </p>
        </section>

        {}
        <section className="glass-card relative overflow-hidden bg-gradient-to-br from-white/5 to-[#3B82F6]/5 !p-8">
          <div className="absolute top-8 right-8 badge-active border-none bg-[#22C55E]/10 text-[#22C55E]">
            Active Policy
          </div>
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-2">
            Current Tier
          </h3>
          <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 mb-10 tracking-tight">
            {currentPlan}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <span className="text-sm text-white/50 font-medium">Coverage Ceiling</span>
              <div className="text-2xl font-bold text-white">
                ₹{(snapshot?.coverage.coverage ?? plan.baseCoverage).toLocaleString()}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm text-white/50 font-medium">Effective Premium</span>
              <div className="text-2xl font-bold text-white">
                ₹{snapshot?.effectivePremium.toFixed(0) ?? plan.basePremium}
                <span className="text-sm text-white/40 font-normal ml-1">/ wk</span>
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="flex justify-between text-sm text-white/50 font-medium">
                <span>Cycle Expiration</span>
                <span className="text-white">{daysRemaining} Days</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(daysRemaining / 30) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB]"
                />
              </div>
            </div>
          </div>
        </section>

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {}
          <section className="glass-card !p-8 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-2">Pricing Intelligence</h3>
            <p className="text-sm text-white/50 mb-8">
              XGBoost factors affecting your current premium tier.
            </p>
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                {premiumBreakdown.map((item, i) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/70">{item.label}</span>
                      <span className="font-semibold text-white">{item.value}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full ${item.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-end">
                <div>
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-widest block mb-1">
                    Index Cost
                  </span>
                  <span className="text-xs text-[#8B5CF6] px-2 py-1 bg-[#8B5CF6]/10 rounded-md block">
                    Multiplier: {((snapshot?.effectivePremium ?? plan.basePremium) / plan.basePremium).toFixed(2)}x
                  </span>
                </div>
                <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">
                  ₹{snapshot?.effectivePremium.toFixed(0) ?? plan.basePremium}{" "}
                  <span className="text-xs text-white/40">/wk</span>
                </div>
              </div>
            </div>
          </section>

          {}
          <section className="space-y-8">
            <div className="glass-card !p-8">
              <h3 className="text-lg font-semibold text-white mb-2">Covered Events</h3>
              <p className="text-sm text-white/50 mb-6">
                Payouts scaled to your effective premium. Adjust below to preview.
              </p>
              <div className="space-y-1">
                {Object.entries(TRIGGER_META).map(([id, meta]) => {
                  const base = plan.triggers[id] ?? 0;
                  const adjusted = snapshot?.triggerPayouts[id]?.payout ?? base;
                  const changed = adjusted !== base;
                  return (
                    <div
                      key={id}
                      className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm shadow-inner shrink-0"
                          style={{ color: meta.color }}
                        >
                          {meta.icon}
                        </div>
                        <span className="text-sm text-white/80 font-medium">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {changed && (
                          <span
                            className={`text-xs font-mono ${
                              adjusted > base ? "text-[#22C55E]" : "text-[#EF4444]"
                            }`}
                          >
                            {adjusted > base ? "+" : ""}
                            {adjusted - base}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-white">
                          ₹{adjusted.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {}

        <section className="space-y-6">
          {}
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                Dynamic Premium Adjustment
                <span className="text-xs font-semibold bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] px-2 py-0.5 rounded-full tracking-wider uppercase">
                  DPA Engine
                </span>
              </h2>
              <p className="text-white/40 text-sm mt-1">
                History-based adaptive model. Past contributions shape your future protection.
              </p>
            </div>
          </div>

          {}
          <div className="glass-card !p-7 space-y-5 border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Contribution History</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  {history.length} weeks on record — recent weeks carry higher weight
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex flex-col items-end">
                  <span className="text-white/40 uppercase tracking-widest text-[10px]">Effective Premium</span>
                  <span className="text-white font-mono font-semibold text-base">
                    ₹{currentEffective.toFixed(0)}
                  </span>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${flexBg(currentFlex.label)}`}>
                  {currentFlex.label}
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <HistoryChart history={history} effectivePremium={currentEffective} />
            )}
          </div>

          {}
          <div className="glass-card !p-7 space-y-7 border-[#8B5CF6]/20 bg-[#8B5CF6]/[0.04]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Contribution Simulator</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Drag to preview impact. Changes are NOT committed until you lock in.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/30">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                Live Preview
              </div>
            </div>

            {}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="text-sm text-white/60 font-medium">Weekly Contribution</label>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">
                    ₹{sliderValue}
                  </span>
                  <span className="text-white/40 text-sm">/wk</span>
                </div>
              </div>
              <div className="relative">
                <input
                  id="dpa-slider"
                  type="range"
                  min={20}
                  max={300}
                  step={5}
                  value={sliderValue}
                  onChange={(e) => {
                    setSliderValue(Number(e.target.value));
                    setLockedIn(false);
                  }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #8B5CF6 0%, #6366F1 ${
                      ((sliderValue - 20) / (300 - 20)) * 100
                    }%, rgba(255,255,255,0.1) ${
                      ((sliderValue - 20) / (300 - 20)) * 100
                    }%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-white/25 mt-1.5 font-mono">
                  <span>₹20</span>
                  <span>₹{plan.basePremium} base</span>
                  <span>₹300</span>
                </div>
              </div>
            </div>

            {}
            {snapshot && (
              <motion.div
                key={sliderValue}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                    Effective Premium
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    ₹{snapshot.effectivePremium.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-white/30">
                    {snapshot.effectivePremium > currentEffective
                      ? `↑ +₹${(snapshot.effectivePremium - currentEffective).toFixed(0)}`
                      : snapshot.effectivePremium < currentEffective
                      ? `↓ -₹${(currentEffective - snapshot.effectivePremium).toFixed(0)}`
                      : "No change"}
                  </div>
                </div>

                {}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                    Coverage {coverageDir}
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    ₹{snapshot.coverage.coverage.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-white/30">
                    {Math.round(snapshot.coverage.ratio * 100)}% of plan max
                  </div>
                </div>

                {}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                    Flex Score
                  </div>
                  <div
                    className="text-xl font-bold font-mono"
                    style={{ color: flexColor(snapshot.flexibility.label) }}
                  >
                    {snapshot.flexibility.score}
                    <span className="text-xs text-white/30 ml-1">/100</span>
                  </div>
                  <div
                    className="text-[10px] font-semibold"
                    style={{ color: flexColor(snapshot.flexibility.label) }}
                  >
                    {snapshot.flexibility.label}
                  </div>
                </div>

                {}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">
                    Payout Factor
                  </div>
                  <div
                    className="text-xl font-bold font-mono"
                    style={{ color: flexColor(snapshot.flexibility.label) }}
                  >
                    {snapshot.flexibility.consistencyFactor.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-white/30">
                    {snapshot.flexibility.consistencyFactor === 1
                      ? "Full payout"
                      : `−${Math.round((1 - snapshot.flexibility.consistencyFactor) * 100)}% penalty`}
                  </div>
                </div>
              </motion.div>
            )}

            {}
            {snapshot && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/40">
                  <span>Reliability Score</span>
                  <span>{snapshot.flexibility.score}/100</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${snapshot.flexibility.score}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded-full"
                    style={{
                      background:
                        snapshot.flexibility.label === "Stable"
                          ? "linear-gradient(to right, #22C55E, #16A34A)"
                          : snapshot.flexibility.label === "Fluctuating"
                          ? "linear-gradient(to right, #EAB308, #CA8A04)"
                          : "linear-gradient(to right, #EF4444, #DC2626)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/20">
                  <span>Risky</span>
                  <span>Fluctuating</span>
                  <span>Stable</span>
                </div>
              </div>
            )}

            {}
            <AnimatePresence mode="sync">
              {snapshot?.warnings.map((w, i) => (
                <motion.div
                  key={w.message}
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-sm font-medium ${
                    w.severity === "warning"
                      ? "bg-[#EF4444]/5 border-[#EF4444]/20 text-[#EF4444]"
                      : w.severity === "success"
                      ? "bg-[#22C55E]/5 border-[#22C55E]/20 text-[#22C55E]"
                      : "bg-[#3B82F6]/5 border-[#3B82F6]/20 text-[#3B82F6]"
                  }`}
                >
                  <span className="text-base mt-0.5">
                    {w.severity === "warning" ? "⚠️" : w.severity === "success" ? "✅" : "ℹ️"}
                  </span>
                  {w.message}
                </motion.div>
              ))}
            </AnimatePresence>

            {}
            {snapshot && (
              <div className="border-t border-white/5 pt-5 space-y-3">
                <div className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                  Projected Trigger Payouts at This Contribution
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(TRIGGER_META).map(([id, meta]) => {
                    const projected = snapshot.triggerPayouts[id]?.payout ?? 0;
                    const base = plan.triggers[id] ?? 0;
                    const delta = projected - base;
                    return (
                      <div
                        key={id}
                        className="bg-black/20 rounded-xl p-3 border border-white/5 text-center space-y-1"
                      >
                        <div className="text-lg">{meta.icon}</div>
                        <div className="text-sm font-bold text-white">₹{projected}</div>
                        <div
                          className={`text-[10px] font-mono ${
                            delta > 0
                              ? "text-[#22C55E]"
                              : delta < 0
                              ? "text-[#EF4444]"
                              : "text-white/30"
                          }`}
                        >
                          {delta === 0 ? "—" : delta > 0 ? `+₹${delta}` : `-₹${Math.abs(delta)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {}
            <div className="flex gap-4 items-center pt-2">
              <button
                id="dpa-lock-btn"
                onClick={handleLockIn}
                disabled={lockedIn}
                className={`flex-1 py-4 rounded-2xl text-sm font-semibold transition-all duration-200 border ${
                  lockedIn
                    ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] cursor-default"
                    : "btn-primary border-transparent"
                }`}
              >
                {lockedIn ? "✓ Contribution Locked In" : "Lock In This Week's Contribution"}
              </button>
            </div>

            {}
            <AnimatePresence>
              {lockToast && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-sm font-medium"
                >
                  <span>✓</span>
                  <span>
                    Contribution of ₹{sliderValue} recorded for this week. Effective premium
                    updated to ₹{currentEffective.toFixed(0)}.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {}
          <div className="glass-card !p-7 border-white/5 bg-white/[0.02]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {}
              <div className="md:col-span-1 space-y-4">
                <h3 className="text-base font-semibold text-white">Why does this matter?</h3>
                <div className="space-y-3 text-sm text-white/50 leading-relaxed">
                  <p>
                    GigShield uses a <span className="text-white/80">weighted history model</span>.
                    Recent weeks count more — but a single spike right before a claim won&apos;t
                    unlock full payouts.
                  </p>
                  <p>
                    Consistent contributors earn a <span className="text-[#22C55E]">1.0× payout multiplier</span>.
                    Erratic patterns reduce this to <span className="text-[#EF4444]">0.82×</span>.
                  </p>
                  <p>
                    The system is designed to be <span className="text-white/80">fair, not exploitable</span>.
                    Build trust over weeks, not hours.
                  </p>
                </div>
              </div>

              {}
              <div className="md:col-span-1 space-y-4">
                <h3 className="text-base font-semibold text-white">Recent Activity</h3>
                <div className="space-y-2">
                  {history.slice(-4).reverse().map((entry, i) => {
                    const prev = history[history.length - 2 - i];
                    const delta = prev ? entry.contribution - prev.contribution : 0;
                    return (
                      <div
                        key={entry.label}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/30 font-mono w-8">{entry.label}</span>
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              delta > 0
                                ? "bg-[#22C55E]"
                                : delta < 0
                                ? "bg-[#EF4444]"
                                : "bg-white/20"
                            }`}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          {delta !== 0 && (
                            <span
                              className={`text-[11px] font-mono ${
                                delta > 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                              }`}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}
                            </span>
                          )}
                          <span className="text-sm font-semibold text-white font-mono">
                            ₹{entry.contribution}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {}
              <div className="md:col-span-1 space-y-4">
                <h3 className="text-base font-semibold text-white">Recommended Band</h3>
                <div className="bg-black/20 rounded-xl p-5 border border-[#8B5CF6]/20 space-y-4">
                  <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">
                      Optimal Range
                    </div>
                    <div className="text-xl font-bold text-white font-mono">
                      ₹{Math.round(plan.basePremium * 0.85)} –{" "}
                      ₹{Math.round(plan.basePremium * 1.20)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Maintains Stable status & full multiplier
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Current Effective</span>
                      <span className="text-white font-mono">₹{currentEffective.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Drops recorded</span>
                      <span
                        className={`font-mono ${
                          currentFlex.dropCount > 2 ? "text-[#EF4444]" : "text-white"
                        }`}
                      >
                        {currentFlex.dropCount} week{currentFlex.dropCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Variability (CV)</span>
                      <span
                        className={`font-mono ${
                          currentFlex.cv > 0.25 ? "text-[#EAB308]" : "text-white"
                        }`}
                      >
                        {(currentFlex.cv * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSliderValue(plan.basePremium);
                      setLockedIn(false);
                    }}
                    className="w-full text-xs py-2 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-colors font-medium"
                  >
                    Reset to Base Plan Premium
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── UPI Autopay Mandate (Fix 8) ──────────────────────────────────── */}
        <section className="glass-card !p-7 space-y-5 border-[#3B82F6]/20 bg-[#3B82F6]/[0.04]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                UPI Auto-Pay Mandate
                <span className="text-[9px] bg-[#3B82F6]/20 text-[#3B82F6] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                  Recurring
                </span>
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Auto-debit your weekly premium via UPI mandate
              </p>
            </div>
            <button
              onClick={() => {
                const current = localStorage.getItem("gigshield_autopay") === "true";
                localStorage.setItem("gigshield_autopay", current ? "false" : "true");
                window.dispatchEvent(new Event("storage"));
                // Force re-render
                setLockedIn(prev => !prev);
                setTimeout(() => setLockedIn(prev => !prev), 0);
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                typeof window !== "undefined" && localStorage.getItem("gigshield_autopay") === "true"
                  ? "bg-[#22C55E]"
                  : "bg-white/10"
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                typeof window !== "undefined" && localStorage.getItem("gigshield_autopay") === "true"
                  ? "translate-x-6"
                  : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {typeof window !== "undefined" && localStorage.getItem("gigshield_autopay") === "true" && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">Mandate Amount</div>
                  <div className="text-xl font-bold text-white font-mono">₹{sliderValue}</div>
                  <div className="text-[10px] text-white/30">Weekly debit</div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-1">Next Debit</div>
                  <div className="text-xl font-bold text-white font-mono">
                    {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </div>
                  <div className="text-[10px] text-white/30">Auto-scheduled</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20">
                <span className="text-[#22C55E]">✓</span>
                <div>
                  <div className="text-sm font-medium text-[#22C55E]">Mandate Active</div>
                  <div className="text-xs text-white/40 font-mono">user@okicici • Razorpay Mandate</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button className="btn-primary py-4 text-sm font-semibold">Modify Plan</button>
          <button className="btn-secondary py-4 text-sm border-white/5 hover:border-[#EF4444]/50 hover:bg-[#EF4444]/10 hover:text-[#EF4444]">
            Cancel Policy
          </button>
        </div>
      </main>

      {}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: white;
          border: 3px solid #8B5CF6;
          box-shadow: 0 0 10px rgba(139,92,246,0.4);
          cursor: pointer;
          transition: box-shadow 0.2s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          box-shadow: 0 0 18px rgba(139,92,246,0.6);
        }
        input[type=range]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: white;
          border: 3px solid #8B5CF6;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
