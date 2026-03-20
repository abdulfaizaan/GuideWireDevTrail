import BottomNav from "@/components/BottomNav";
import { Shield, CloudRain, Wind, Thermometer, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const alerts = [
  { icon: CloudRain, label: "Heavy rain", detail: "Expected 4–8 PM today", severity: "high" as const, color: "text-info" },
  { icon: Wind, label: "Poor AQI", detail: "AQI 285 · Unhealthy", severity: "medium" as const, color: "text-warning" },
  { icon: Thermometer, label: "Heat wave", detail: "42°C forecasted tomorrow", severity: "low" as const, color: "text-destructive" },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="gradient-hero px-5 pt-12 pb-8">
        <div className="flex items-center justify-between mb-5 opacity-0 animate-fade-up">
          <div>
            <p className="text-primary-foreground/70 text-sm">Good evening,</p>
            <h1 className="text-xl font-bold text-primary-foreground">Ravi 👋</h1>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center text-primary-foreground active:scale-95 transition-transform"
          >
            R
          </button>
        </div>

        {/* Active Plan Card */}
        <div
          className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-4 border border-primary-foreground/10 opacity-0 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-primary-foreground" />
            <span className="text-sm font-semibold text-primary-foreground">Standard Plan · Active</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-primary-foreground/60 uppercase tracking-wide">Premium</p>
              <p className="text-lg font-bold text-primary-foreground">₹49<span className="text-xs font-normal">/wk</span></p>
            </div>
            <div>
              <p className="text-[11px] text-primary-foreground/60 uppercase tracking-wide">Coverage</p>
              <p className="text-lg font-bold text-primary-foreground">₹1,500</p>
            </div>
            <div>
              <p className="text-[11px] text-primary-foreground/60 uppercase tracking-wide">Protected</p>
              <p className="text-lg font-bold text-primary-foreground">₹847</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-3 space-y-5">
        {/* Claim notification */}
        <div
          className="bg-card rounded-2xl shadow-card p-4 flex items-center gap-3 opacity-0 animate-fade-up"
          style={{ animationDelay: "200ms" }}
        >
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Rain claim approved!</p>
            <p className="text-xs text-muted-foreground">₹350 payout · 15 Mar</p>
          </div>
          <button
            onClick={() => navigate("/claims")}
            className="text-primary active:scale-95 transition-transform"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Disruption Alerts */}
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">Disruption alerts</h2>
            <AlertTriangle size={16} className="text-warning" />
          </div>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={alert.label}
                className="bg-card rounded-xl shadow-card p-3.5 flex items-center gap-3 opacity-0 animate-slide-right"
                style={{ animationDelay: `${400 + i * 80}ms` }}
              >
                <div className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${alert.color}`}>
                  <alert.icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{alert.label}</p>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    alert.severity === "high"
                      ? "bg-info/10 text-info"
                      : alert.severity === "medium"
                      ? "bg-warning/10 text-warning"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "600ms" }}>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/plans")}
              className="bg-card rounded-xl shadow-card p-4 text-left active:scale-[0.97] transition-all hover:shadow-card-hover"
            >
              <Shield size={20} className="text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Upgrade plan</p>
              <p className="text-xs text-muted-foreground">Get more coverage</p>
            </button>
            <button
              onClick={() => navigate("/claims")}
              className="bg-card rounded-xl shadow-card p-4 text-left active:scale-[0.97] transition-all hover:shadow-card-hover"
            >
              <CheckCircle2 size={20} className="text-success mb-2" />
              <p className="text-sm font-semibold text-foreground">View claims</p>
              <p className="text-xs text-muted-foreground">Track payouts</p>
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
