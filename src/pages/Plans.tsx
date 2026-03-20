import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Shield, Check, Zap, Star } from "lucide-react";

const plans = [
  {
    name: "Basic",
    price: 29,
    coverage: 750,
    icon: Shield,
    features: ["Rain disruption cover", "Up to ₹750/week", "Auto-trigger claims", "SMS notifications"],
    popular: false,
  },
  {
    name: "Standard",
    price: 49,
    coverage: 1500,
    icon: Zap,
    features: ["Rain + pollution cover", "Up to ₹1,500/week", "Auto-trigger claims", "Priority payouts", "Earnings protection"],
    popular: true,
  },
  {
    name: "Pro",
    price: 79,
    coverage: 3000,
    icon: Star,
    features: ["Rain + pollution + heat", "Up to ₹3,000/week", "Instant auto-claims", "Same-day payouts", "Full earnings shield", "Accident add-on"],
    popular: false,
  },
];

const Plans = () => {
  const [selected, setSelected] = useState(1);

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-bold text-foreground opacity-0 animate-fade-up">Choose your plan</h1>
        <p className="text-sm text-muted-foreground mt-1 opacity-0 animate-fade-up" style={{ animationDelay: "80ms" }}>
          Weekly plans · Cancel anytime
        </p>
      </div>

      <div className="px-5 space-y-4 pb-6">
        {plans.map((plan, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={plan.name}
              onClick={() => setSelected(i)}
              className={`w-full text-left rounded-2xl p-5 transition-all duration-300 opacity-0 animate-fade-up active:scale-[0.98] ${
                isSelected
                  ? "bg-card shadow-card-hover ring-2 ring-primary"
                  : "bg-card shadow-card ring-1 ring-transparent hover:shadow-card-hover"
              }`}
              style={{ animationDelay: `${150 + i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <plan.icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">Up to ₹{plan.coverage.toLocaleString()}/wk</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-foreground">₹{plan.price}</p>
                  <p className="text-[11px] text-muted-foreground">/week</p>
                </div>
              </div>

              {plan.popular && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider gradient-accent text-accent-foreground px-2.5 py-0.5 rounded-full mb-3">
                  Most popular
                </span>
              )}

              <div className="space-y-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check
                      size={14}
                      className={isSelected ? "text-primary" : "text-muted-foreground"}
                    />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-6 opacity-0 animate-fade-up" style={{ animationDelay: "550ms" }}>
        <Button size="full">
          Buy {plans[selected].name} · ₹{plans[selected].price}/week
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Plans;
