import BottomNav from "@/components/BottomNav";
import { CloudRain, Wind, Thermometer, Clock, CheckCircle2, Banknote } from "lucide-react";

const claims = [
  {
    id: 1,
    type: "Heavy Rain",
    icon: CloudRain,
    date: "15 Mar 2026",
    amount: 350,
    status: "Paid" as const,
    color: "text-info",
  },
  {
    id: 2,
    type: "Poor AQI",
    icon: Wind,
    date: "12 Mar 2026",
    amount: 275,
    status: "Approved" as const,
    color: "text-warning",
  },
  {
    id: 3,
    type: "Heat Wave",
    icon: Thermometer,
    date: "10 Mar 2026",
    amount: 420,
    status: "Processing" as const,
    color: "text-destructive",
  },
  {
    id: 4,
    type: "Heavy Rain",
    icon: CloudRain,
    date: "5 Mar 2026",
    amount: 350,
    status: "Paid" as const,
    color: "text-info",
  },
];

const statusConfig = {
  Processing: { icon: Clock, bg: "bg-warning/10", text: "text-warning" },
  Approved: { icon: CheckCircle2, bg: "bg-success/10", text: "text-success" },
  Paid: { icon: Banknote, bg: "bg-primary/10", text: "text-primary" },
};

const Claims = () => {
  const totalPaid = claims
    .filter((c) => c.status === "Paid")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-bold text-foreground opacity-0 animate-fade-up">Claims & Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1 opacity-0 animate-fade-up" style={{ animationDelay: "80ms" }}>
          Auto-triggered by weather data
        </p>
      </div>

      {/* Summary */}
      <div className="px-5 mb-5 opacity-0 animate-fade-up" style={{ animationDelay: "150ms" }}>
        <div className="gradient-primary rounded-2xl p-5 text-primary-foreground">
          <p className="text-sm opacity-80 mb-1">Total received this month</p>
          <p className="text-3xl font-bold">₹{totalPaid.toLocaleString()}</p>
          <div className="flex gap-4 mt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider opacity-60">Claims</p>
              <p className="text-base font-semibold">{claims.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider opacity-60">Approved</p>
              <p className="text-base font-semibold">
                {claims.filter((c) => c.status !== "Processing").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Claims list */}
      <div className="px-5 space-y-3">
        {claims.map((claim, i) => {
          const sc = statusConfig[claim.status];
          return (
            <div
              key={claim.id}
              className="bg-card rounded-xl shadow-card p-4 flex items-center gap-3 opacity-0 animate-slide-right"
              style={{ animationDelay: `${250 + i * 80}ms` }}
            >
              <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 ${claim.color}`}>
                <claim.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{claim.type}</p>
                <p className="text-xs text-muted-foreground">{claim.date}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">₹{claim.amount}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                  <sc.icon size={10} />
                  {claim.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default Claims;
