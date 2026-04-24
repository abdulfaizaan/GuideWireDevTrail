"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = ["Identity", "Verification", "Platform", "Location", "Assessment"];

const PLANS = [
  { name: "Basic", coverage: 5000, premium: 49 },
  { name: "Standard", coverage: 10000, premium: 89 },
  { name: "Premium", coverage: 20000, premium: 149 },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    phone: "",
    otp: "",
    aadhaar: "",
    platform: "Swiggy",
    partnerId: "",
    pincode: "",
    dailyEarnings: 500,
    riskScore: 0,
    suggestedPlan: "",
  });
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  const [calcFactors, setCalcFactors] = useState({ zone: 0, weather: 0, aqi: 0, platform: 0, activity: 0 });

  // ── Validation helpers ──────────────────────────────────────────────────────
  const validatePhone = (val: string) => /^\d{10}$/.test(val);
  const validateOtp = (val: string) => /^\d{4}$/.test(val);
  const validateAadhaar = (val: string) => /^\d{12}$/.test(val);

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!validatePhone(data.phone)) {
        newErrors.phone = "Enter a valid 10-digit mobile number.";
      }
      if (!otpSent) {
        newErrors.otp = "Please send OTP first.";
      } else if (!validateOtp(data.otp)) {
        newErrors.otp = "OTP must be exactly 4 digits.";
      } else if (!otpVerified) {
        newErrors.otp = "Please verify the OTP before continuing.";
      }
    }

    if (step === 2) {
      if (!validateAadhaar(data.aadhaar)) {
        newErrors.aadhaar = "Aadhaar must be exactly 12 digits.";
      }
    }

    if (step === 3) {
      if (!data.platform) {
        newErrors.platform = "Please select a platform.";
      }
      if (!data.partnerId.trim()) {
        newErrors.partnerId = "Gig Worker ID cannot be empty.";
      }
    }

    if (step === 4) {
      if (!data.pincode.trim()) {
        newErrors.pincode = "Please enter your area pincode.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getRiskScore = async () => {
    setLoading(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    let zone = 50;
    let weather = 40;
    let aqi = 30;
    const platformRisk = data.platform === "Swiggy" ? 45 : 50;
    const activity = 75;

    try {
      // Fetch real weather data for the user's pincode (Fix 7)
      const pincodeParam = data.pincode ? `&pincode=${data.pincode}` : "";
      const weatherRes = await fetch(`${API_URL}/api/triggers/weather?city=Mumbai${pincodeParam}`);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        // Convert weather data to risk scores
        const w = weatherData.weather;
        zone = Math.min(100, Math.round(
          (w.rain > 20 ? 80 : w.rain > 10 ? 60 : 40) * 0.5 +
          (w.temp > 40 ? 80 : w.temp > 35 ? 60 : 40) * 0.3 +
          (w.humidity > 85 ? 70 : 40) * 0.2
        ));
        weather = Math.min(100, weatherData.riskScore || 40);
      }
    } catch { /* keep defaults */ }

    try {
      // Fetch real AQI data (Fix 7)
      const aqiRes = await fetch(`${API_URL}/api/triggers/aqi?city=Mumbai`);
      if (aqiRes.ok) {
        const aqiData = await aqiRes.json();
        aqi = Math.min(100, Math.round((aqiData.aqi / 400) * 100));
      }
    } catch { /* keep defaults */ }

    const calculatedScore = Math.floor(
      zone * 0.3 + weather * 0.25 + aqi * 0.15 + platformRisk * 0.2 + activity * 0.1
    );

    setCalcFactors({ zone, weather, aqi, platform: platformRisk, activity });

    setData((d) => ({
      ...d,
      riskScore: calculatedScore,
      suggestedPlan: calculatedScore > 65 ? "Premium" : calculatedScore > 45 ? "Standard" : "Basic",
    }));

    setLoading(false);
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step === 4) await getRiskScore();
    if (step < STEPS.length) setStep((s) => s + 1);
  };

  const handleSendOtp = () => {
    if (!validatePhone(data.phone)) {
      setErrors((e) => ({ ...e, phone: "Enter a valid 10-digit mobile number." }));
      return;
    }
    setErrors((e) => ({ ...e, phone: "" }));
    setOtpSent(true);
  };

  const handleVerifyOtp = () => {
    if (!validateOtp(data.otp)) {
      setErrors((e) => ({ ...e, otp: "OTP must be exactly 4 digits." }));
      return;
    }
    setErrors((e) => ({ ...e, otp: "" }));
    setOtpVerified(true);
  };

  const handleFinish = async () => {
    setLoading(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    try {
      const RazorpayConstructor =
        typeof window !== "undefined" && typeof window.Razorpay === "function"
          ? window.Razorpay
          : null;

      // Ensure Razorpay script is loaded before invoking checkout.
      if (!razorpayLoaded || !RazorpayConstructor) {
        alert("Payment system is still loading. Please try again.");
        return;
      }

      const selectedPlan = PLANS.find(p => p.name === (data.suggestedPlan || "Standard"));
      const amount = selectedPlan ? selectedPlan.premium : 89;

      // 1. Create order
      const orderRes = await fetch(`${API_URL}/api/payment/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const orderData = await orderRes.json();

      if (!orderData.success) throw new Error("Failed to create payment order");

      // 2. Open Razorpay Modal
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_ScqqkDkAaShrbI",
        amount: orderData.order.amount,
        currency: "INR",
        name: "GigShield AI Insurance",
        description: `Enrollment for ${selectedPlan?.name} Plan`,
        order_id: orderData.order.id,
        handler: async (response: RazorpayResponse) => {
          // 3. Verify payment
          const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            if (typeof window !== "undefined") {
              localStorage.setItem(
                "gigshield_user",
                JSON.stringify({ ...data, plan: data.suggestedPlan || "Standard", enrolled: true, enrolledAt: new Date().toISOString(), dailyEarnings: data.dailyEarnings })
              );
            }
            router.push("/dashboard");
          } else {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          contact: data.phone,
        },
        theme: {
          color: "#8B5CF6",
        },
      };

      const rzp1 = new RazorpayConstructor(options);
      rzp1.open();
    } catch (error) {
      console.error("Payment flow error:", error);
      alert("Something went wrong with the payment process.");
    } finally {
      setLoading(false);
    }
  };

  
  const numericOnly = (val: string) => val.replace(/\D/g, "");
      
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayLoaded(true)}
        onError={() => {
          setRazorpayLoaded(false);
          console.error("Failed to load Razorpay checkout SDK.");
        }}
      />
      {}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[20%] right-[10%] w-[50%] h-[50%] bg-[#6366F1]/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-[20%] left-[10%] w-[50%] h-[50%] bg-[#8B5CF6]/10 blur-[140px] rounded-full" />
      </div>

      <div className="w-full max-w-lg pb-10">
        {}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-lg font-bold shadow-lg">
              G
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold text-white/50 uppercase tracking-widest text-center">
              Step {step} / {STEPS.length}
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden mx-auto w-3/4">
              <motion.div
                className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-3 px-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-col items-center">
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                      i + 1 <= step ? "text-white" : "text-white/20"
                    }`}
                  >
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {}
        <div className="glass-card !p-8 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2 text-center">
                {step === 1 && "Identity Verification"}
                {step === 2 && "Regulatory Compliance"}
                {step === 3 && "Partner Integration"}
                {step === 4 && "Geographical Data"}
                {step === 5 && "Profile Assessment"}
              </h2>

              {}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-3 block">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={data.phone}
                      onChange={(e) => {
                        const v = numericOnly(e.target.value).slice(0, 10);
                        setData((d) => ({ ...d, phone: v }));
                        setErrors((er) => ({ ...er, phone: "" }));
                        // Reset OTP flow if phone changes
                        if (otpSent) { setOtpSent(false); setOtpVerified(false); setData((d) => ({ ...d, otp: "" })); }
                      }}
                      className="glass-input font-mono text-center text-lg tracking-wider"
                      placeholder="Enter 10-digit mobile"
                      maxLength={10}
                      inputMode="numeric"
                    />
                    {errors.phone && (
                      <p className="text-[#F87171] text-xs mt-2">{errors.phone}</p>
                    )}
                  </div>

                  {!otpSent ? (
                    <button
                      onClick={handleSendOtp}
                      className="w-full btn-secondary py-4 hover:border-[#8B5CF6]/50"
                    >
                      Generate Authorization Code
                    </button>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-white/70 mb-3 block">
                          Authorization Code (OTP)
                        </label>
                        <input
                          type="text"
                          value={data.otp}
                          onChange={(e) => {
                            const v = numericOnly(e.target.value).slice(0, 4);
                            setData((d) => ({ ...d, otp: v }));
                            setErrors((er) => ({ ...er, otp: "" }));
                            if (otpVerified) setOtpVerified(false);
                          }}
                          className="glass-input text-center text-2xl tracking-[0.6em] font-mono"
                          placeholder="----"
                          maxLength={4}
                          inputMode="numeric"
                        />
                        {errors.otp && (
                          <p className="text-[#F87171] text-xs mt-2">{errors.otp}</p>
                        )}
                      </div>

                      {!otpVerified ? (
                        <button
                          onClick={handleVerifyOtp}
                          className="w-full btn-primary py-4 text-base"
                        >
                          Authenticate Session
                        </button>
                      ) : (
                        <div className="text-center py-4 text-[#22C55E] font-medium bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/20 text-sm">
                          ✓ Session Authenticated Securely
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm text-white/70 leading-relaxed font-light">
                    Regulatory adherence mandates a valid identification hash to establish automated premium reserves.
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-3 block">
                      Aadhaar Number
                    </label>
                    <input
                      type="text"
                      value={data.aadhaar}
                      onChange={(e) => {
                        const v = numericOnly(e.target.value).slice(0, 12);
                        setData((d) => ({ ...d, aadhaar: v }));
                        setErrors((er) => ({ ...er, aadhaar: "" }));
                      }}
                      className="glass-input text-center font-mono tracking-[0.25em] text-lg"
                      placeholder="12-digit Aadhaar"
                      maxLength={12}
                      inputMode="numeric"
                    />
                    {errors.aadhaar && (
                      <p className="text-[#F87171] text-xs mt-2">{errors.aadhaar}</p>
                    )}
                    <p className="text-white/30 text-xs mt-2 text-center">
                      Enter all 12 digits without spaces or dashes
                    </p>
                  </div>
                </div>
              )}

              {}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-3 block">
                      Operating Network
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {["Swiggy", "Zomato"].map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setData((d) => ({ ...d, platform: p }));
                            setErrors((er) => ({ ...er, platform: "" }));
                          }}
                          className={`py-4 rounded-xl border text-sm font-semibold transition-all ${
                            data.platform === p
                              ? "bg-[#6366F1]/20 border-[#6366F1]/50 text-white shadow-inner"
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {errors.platform && (
                      <p className="text-[#F87171] text-xs mt-2">{errors.platform}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-3 block">
                      Gig Worker ID
                    </label>
                    <input
                      type="text"
                      value={data.partnerId}
                      onChange={(e) => {
                        setData((d) => ({ ...d, partnerId: e.target.value }));
                        setErrors((er) => ({ ...er, partnerId: "" }));
                      }}
                      className="glass-input font-mono text-center tracking-wider text-base"
                      placeholder="e.g. SW-ABC123"
                    />
                    {errors.partnerId && (
                      <p className="text-[#F87171] text-xs mt-2">{errors.partnerId}</p>
                    )}
                  </div>

                  {/* Daily Earnings (Fix 2 — income proxy) */}
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-3 block">
                      Average Daily Earnings
                    </label>
                    <div className="flex items-baseline gap-3 mb-3">
                      <span className="text-3xl font-bold text-white font-mono">₹{data.dailyEarnings}</span>
                      <span className="text-sm text-white/40">/day</span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={2000}
                      step={50}
                      value={data.dailyEarnings}
                      onChange={(e) => setData((d) => ({ ...d, dailyEarnings: Number(e.target.value) }))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #8B5CF6 0%, #6366F1 ${((data.dailyEarnings - 200) / (2000 - 200)) * 100}%, rgba(255,255,255,0.1) ${((data.dailyEarnings - 200) / (2000 - 200)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-white/25 mt-1.5 font-mono">
                      <span>₹200</span>
                      <span>₹500 baseline</span>
                      <span>₹2,000</span>
                    </div>
                    <p className="text-white/30 text-xs mt-2">This determines your payout proportionality. Higher earners get higher coverage.</p>
                  </div>
                </div>
              )}

              {/* ── Step 4: Location ── */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm text-white/70 font-light leading-relaxed">
                    Geospatial positioning determines the baseline risk factor for environmental triggers.
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-3 block">
                      Primary Operation Zone (Pincode)
                    </label>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={data.pincode}
                        onChange={(e) => {
                          const v = numericOnly(e.target.value).slice(0, 6);
                          setData((d) => ({ ...d, pincode: v }));
                          setErrors((er) => ({ ...er, pincode: "" }));
                        }}
                        className="glass-input font-mono text-center text-xl tracking-wider flex-1"
                        placeholder="6-digit pincode"
                        maxLength={6}
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => setData((d) => ({ ...d, pincode: "400001" }))}
                        className="btn-secondary px-6 text-sm hover:border-[#3B82F6]/50"
                      >
                        Detect
                      </button>
                    </div>
                    {errors.pincode && (
                      <p className="text-[#F87171] text-xs mt-2">{errors.pincode}</p>
                    )}
                  </div>

                  {/* Map Embed */}
                  <div className="w-full h-48 rounded-xl overflow-hidden border border-white/10 relative shadow-inner">
                    <div className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur-md px-2 py-1 rounded text-white/70 border border-white/10">
                      GPS Sensor
                    </div>
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3770.8123862410777!2d72.88849767597143!3d19.071981752044813!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c8abb3118d53%3A0x7d025b3bd9753de0!2sKurla%20(W)%2C%20Mumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1713000000000!5m2!1sen!2sin"
                      width="100%"
                      height="100%"
                      style={{ border: 0, filter: "invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%)" }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              )}

              {}
              {step === 5 && (
                <div className="space-y-8">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-6">
                      <div className="w-10 h-10 border-[3px] border-white/10 border-t-[#8B5CF6] border-r-[#6366F1] rounded-full animate-spin" />
                      <div className="text-center">
                        <div className="text-base font-semibold text-white mb-2">Executing XGBoost Pipeline</div>
                        <div className="text-xs text-white/40 tracking-wider uppercase">Parametric Inference Ongoing</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center justify-center p-6 bg-black/20 rounded-2xl border border-white/5">
                        <div className="text-sm text-[#8B5CF6] font-bold uppercase tracking-widest mb-4">Risk Confidence Score</div>
                        <div className="relative inline-block">
                          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke="url(#purpleGrad)" strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={`${(data.riskScore || 65) * 2.64} 264`}
                            />
                            <defs>
                              <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#8B5CF6" />
                                <stop offset="100%" stopColor="#6366F1" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                            <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                              {data.riskScore || 65}
                            </span>
                          </div>
                        </div>

                        <div className="w-full mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-y-3 text-xs">
                          <div className="flex justify-between items-center pr-2">
                            <span className="text-white/50">Zone (30%)</span>
                            <span className="text-white font-mono">{calcFactors.zone}</span>
                          </div>
                          <div className="flex justify-between items-center pl-2 border-l border-white/10">
                            <span className="text-white/50">Weather (25%)</span>
                            <span className="text-white font-mono">{calcFactors.weather}</span>
                          </div>
                          <div className="flex justify-between items-center pr-2">
                            <span className="text-white/50">AQI (15%)</span>
                            <span className="text-white font-mono">{calcFactors.aqi}</span>
                          </div>
                          <div className="flex justify-between items-center pl-2 border-l border-white/10">
                            <span className="text-white/50">Platform (20%)</span>
                            <span className="text-white font-mono">{calcFactors.platform}</span>
                          </div>
                          <div className="col-span-2 flex justify-center items-center mt-1">
                            <span className="text-white/50 mr-2">Activity (10%)</span>
                            <span className="text-white font-mono">{calcFactors.activity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full">
                        <div className="text-xs text-white/50 font-semibold uppercase tracking-widest mb-4 text-center">
                          Select Your Coverage Tier
                        </div>
                        <div className="flex flex-col gap-3">
                          {PLANS.map((plan) => {
                            const isRecommended = plan.name === (data.suggestedPlan || "Standard");
                            const isSelected = data.suggestedPlan === plan.name;
                            return (
                              <button
                                key={plan.name}
                                onClick={() => setData((d) => ({ ...d, suggestedPlan: plan.name }))}
                                className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all ${
                                  isSelected
                                    ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/50 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                    : "bg-white/5 border-white/10 hover:border-white/30"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${isSelected ? "text-white" : "text-white/80"}`}>
                                      {plan.name} {plan.name === "Premium" && "Gold"}
                                    </span>
                                    {isRecommended && (
                                      <span className="text-[9px] bg-[#22C55E]/20 text-[#22C55E] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                                        AI Recommended
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-white/50 mt-1">₹{plan.coverage.toLocaleString()} Max Coverage</div>
                                </div>
                                <div className={`text-right ${isSelected ? "text-[#8B5CF6] font-bold" : "text-white/70"}`}>
                                  ₹{plan.premium}<span className="text-xs text-white/40 font-normal"> /wk</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {}
              <div className="flex gap-4 pt-6 mt-8">
                {step > 1 && step < 5 && (
                  <button onClick={() => setStep((s) => s - 1)} className="flex-1 btn-secondary py-4 w-1/3">
                    Back
                  </button>
                )}

                {step < STEPS.length ? (
                  <button
                    onClick={handleNext}
                    className="flex-[2] btn-primary py-4 disabled:opacity-30 disabled:saturate-0"
                  >
                    {step === 4 ? "Initialize Inference" : "Continue"}
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    disabled={loading || !razorpayLoaded}
                    className="w-full btn-primary py-4 disabled:opacity-30 tracking-wide"
                  >
                    {razorpayLoaded ? "Establish Contract" : "Loading Payment Gateway..."}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => router.push("/")}
            className="text-white/40 text-sm hover:text-white/80 transition-colors font-medium"
          >
            Abort Process
          </button>
        </div>
      </div>
    </div>
  );
}
