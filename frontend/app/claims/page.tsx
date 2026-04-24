"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { loadClaims, saveClaims } from "../lib/claim-store";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/policy", label: "Policy" },
  { href: "/claims", label: "Claims" },
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
  ai_explanation?: string;
}

const FALLBACK_CLAIMS: Claim[] = [
  {
    id: "CLM-001", trigger: "🌧️", type: "Heavy Rain", date: "2024-03-28",
    payout: 680, status: "Settled", fraudScore: 0.03,
    timeline: ["Data Feed Evaluated", "Risk Trigger Met", "Settlement Initiated"],
    reasons: ["Rainfall > 25mm threshold", "4+ hrs aggregate disruption", "Located in high-risk zone (Tier B)"]
  },
  {
    id: "CLM-002", trigger: "🚫", type: "Bandh", date: "2024-03-15",
    payout: 720, status: "Settled", fraudScore: 0.05,
    timeline: ["Data Feed Evaluated", "Risk Trigger Met", "Settlement Initiated"],
    reasons: ["Municipal lockdown declared", "Total gig halt verified > 6 hrs", "Partner API confirmed zero activity"]
  },
];

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

export default function ClaimsPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const [claims, setClaims] = useState<Claim[]>(() => loadClaims(FALLBACK_CLAIMS));
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const fetchClaims = async () => {
      try {
        const res = await fetch(`${API_URL}/api/claims`);
        if (res.ok) {
          const data: Claim[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Enrich backend claims with reasons from ai_explanation
            const enriched = data.map((c) => ({
              ...c,
              reasons: c.ai_explanation
                ? [c.ai_explanation]
                : ["Claim verified by parametric oracle feed."],
            }));
            setClaims(enriched);
            saveClaims(enriched);
          }
        }
      } catch {
        // Backend offline – keep fallback claims visible
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, []);

  useEffect(() => {
    saveClaims(claims);
  }, [claims]);

  const totalPaid = claims
    .filter((c) => c.status === "Settled" || c.status === "APPROVED" || c.status === "Transferred")
    .reduce((a, c) => a + c.payout, 0);

  const aiCleared = claims.filter(
    (c) => c.status === "Settled" || c.status === "APPROVED" || c.status === "Transferred"
  ).length;

  if (!isMounted) return null;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12 pb-24">
        {/* Header */}
        <section className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Ledger</h1>
          <p className="text-white/50 text-base">Complete history of parametric event resolutions.</p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="glass-card flex flex-col justify-center">
            <span className="text-xs text-white/50 uppercase tracking-widest mb-2 font-semibold">Volume</span>
            <div className="text-3xl font-bold text-white">{loading ? "—" : claims.length}</div>
          </div>
          <div className="glass-card flex flex-col justify-center col-span-2">
            <span className="text-xs text-white/50 uppercase tracking-widest mb-2 font-semibold">Total Liquidity Deployed</span>
            <div className="text-3xl font-bold text-[#22C55E]">₹{loading ? "—" : totalPaid.toLocaleString()}</div>
          </div>
          <div className="glass-card flex flex-col justify-center items-center text-center">
            <span className="text-xs text-white/50 uppercase tracking-widest mb-2 font-semibold">AI Audit</span>
            <div className="text-sm text-[#3B82F6] font-medium bg-[#3B82F6]/10 px-3 py-1 rounded-full border border-[#3B82F6]/20">
              {loading ? "—" : `${aiCleared}/${claims.length} Cleared`}
            </div>
          </div>
        </section>

        {/* Claims List */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-white mb-6">Historical Resolutions</h2>

          {loading ? (
            <div className="flex flex-col items-center py-16 gap-4">
              <div className="w-8 h-8 border-[3px] border-white/10 border-t-[#8B5CF6] rounded-full animate-spin" />
              <span className="text-white/40 text-sm">Fetching ledger from chain…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {claims.map((claim, i) => (
                <motion.div
                  key={`${claim.id || 'claim'}-${i}`}
                  onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                  className="glass-card glass-card-interactive cursor-pointer overflow-hidden p-0"
                >
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner shrink-0">
                        {claim.trigger}
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white mb-1.5">{claim.type} Event</div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-white/40 font-mono tracking-wide">{claim.id}</span>
                          <span className="text-white/20">•</span>
                          <span className="text-white/40">{claim.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="text-2xl font-bold text-[#22C55E] tracking-tight">
                        ₹{claim.payout}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/30 hidden md:block">
                          AI Fraud Index: {typeof claim.fraudScore === "number" ? claim.fraudScore.toFixed(3) : "0.050"}
                        </span>
                        <span
                          className={`badge-paid border-none px-3 py-1 rounded-full text-xs font-semibold ${
                            claim.status === "REJECTED"
                              ? "bg-[#EF4444]/10 text-[#EF4444]"
                              : "bg-[#22C55E]/10 text-[#22C55E]"
                          }`}
                        >
                          {claim.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {expandedClaim === claim.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-black/20 border-t border-white/5"
                      >
                        <div className="p-6">
                          <div className="flex flex-col md:flex-row justify-between gap-10">
                            {/* Reasons */}
                            <div className="flex-[1.5]">
                              <h4 className="text-sm font-semibold text-white mb-4">Why this outcome?</h4>
                              <ul className="space-y-3">
                                {(claim.reasons || ["Claim verified by parametric oracle feed."]).map((r, idx) => (
                                  <li key={idx} className="flex items-start gap-3 text-sm text-white/70">
                                    <span className="text-[#3B82F6] mt-0.5">•</span>
                                    {r}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Timeline */}
                            <div className="flex-1">
                              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Execution Pathway</h4>
                              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
                                {(claim.timeline || ["Incident Detected", "Fraud Check", "Settlement"]).map((step, j) => (
                                  <div key={j} className="relative flex items-center gap-4">
                                    <div className="w-3 h-3 rounded-full bg-[#8B5CF6] ring-4 ring-[#8B5CF6]/20 z-10" />
                                    <span className="text-sm text-white/70">{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Contract Data */}
                            <div className="flex-1 bg-[#3B82F6]/5 p-5 rounded-xl border border-[#3B82F6]/20 text-sm flex flex-col gap-2 h-fit">
                              <h4 className="text-xs font-semibold text-[#3B82F6] uppercase tracking-widest mb-1">Contract Data</h4>
                              <div className="flex justify-between text-white/70"><span>Policy Hash</span><span className="font-mono text-white/30 truncate max-w-[100px]" title="0x8a92b3c4d5e6f7a8">0x8a92...</span></div>
                              <div className="flex justify-between text-white/70"><span>Oracle Feed</span><span className="font-mono text-white/30">Validated</span></div>
                              <div className="flex justify-between text-white/70">
                                <span>Final State</span>
                                <span className={claim.status === "REJECTED" ? "text-[#EF4444]" : "text-[#22C55E]"}>
                                  {claim.status === "REJECTED" ? "Rejected" : "Cleared"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {!loading && claims.length === 0 && (
                <div className="text-center py-10 text-white/40 text-sm glass-card border-dashed">
                  No resolutions on ledger yet.
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
