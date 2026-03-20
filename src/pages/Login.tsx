import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, Bike } from "lucide-react";

const platforms = ["Zomato", "Swiggy", "Dunzo", "Blinkit", "Zepto", "Other"];

const Login = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [platform, setPlatform] = useState("");
  const [city, setCity] = useState("");

  const canProceedStep0 = name.trim().length > 1 && phone.trim().length >= 10;
  const canProceedStep1 = platform.length > 0;
  const canFinish = city.trim().length > 1;

  const handleSubmit = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero */}
      <div className="gradient-hero px-6 pt-14 pb-10 text-primary-foreground">
        <div className="flex items-center gap-3 mb-6 opacity-0 animate-fade-up">
          <div className="w-11 h-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">GigShield</h1>
            <p className="text-sm opacity-80">Insurance for delivery heroes</p>
          </div>
        </div>
        <p className="text-base leading-relaxed opacity-90 max-w-[280px] opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
          Weather disruptions shouldn't disrupt your income. Get covered in 2 minutes.
        </p>
      </div>

      {/* Form area */}
      <div className="flex-1 px-5 -mt-4">
        <div className="bg-card rounded-2xl shadow-card p-5 opacity-0 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {/* Progress */}
          <div className="flex gap-2 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i <= step ? "gradient-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Your details</h2>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ravi Kumar"
                  className="w-full h-12 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Phone number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  type="tel"
                  className="w-full h-12 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
              <Button
                size="full"
                disabled={!canProceedStep0}
                onClick={() => setStep(1)}
                className="mt-2"
              >
                Continue <ChevronRight size={18} />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Delivery platform</h2>
              <p className="text-sm text-muted-foreground">Which platform do you deliver for?</p>
              <div className="grid grid-cols-2 gap-3">
                {platforms.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`h-12 rounded-xl border-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                      platform === p
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/30"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Button
                size="full"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="mt-2"
              >
                Continue <ChevronRight size={18} />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Your city</h2>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">City / Area</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru, Koramangala"
                  className="w-full h-12 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
              <Button size="full" disabled={!canFinish} onClick={handleSubmit} className="mt-2">
                Get started <Bike size={18} />
              </Button>
            </div>
          )}
        </div>

        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground mx-auto block transition-colors"
          >
            ← Go back
          </button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground py-6 px-4">
        By continuing you agree to our Terms & Privacy Policy
      </p>
    </div>
  );
};

export default Login;
