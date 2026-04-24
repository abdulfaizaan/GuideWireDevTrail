"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LandingPage() {
  const router = useRouter();


  const features = [
    { icon: "⚡", label: "Instant Payouts", sub: "Automated trigger resolution without paperwork." },
    { icon: "🤖", label: "AI Integration", sub: "Dynamic pricing powered by XGBoost models." },
    { icon: "🛡️", label: "Complete Coverage", sub: "Parametric protection for the gig economy." },
  ];



  return (
    <main className="min-h-screen flex items-center justify-center -mt-10 px-6">
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center space-y-10">
        
        {}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2 backdrop-blur-md"
        >
          <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
          <span className="text-sm text-white/70 tracking-wide">Next-Gen Parametric Platform</span>
        </motion.div>

        {}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight max-w-4xl"
        >
          Your Income Shouldn&apos;t <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]">
            Depend on Weather
          </span>
        </motion.h1>

        {}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-white/50 max-w-2xl font-light leading-relaxed"
        >
          Premium algorithmic insurance tailored for modern professionals. 
          Get paid automatically when disruptions occur, seamlessly.
        </motion.p>

        {}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-5 pt-4"
        >
          <button
            onClick={() => router.push("/register")}
            className="btn-primary text-base px-10 py-4"
          >
            Get Protected
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-secondary text-base px-10 py-4"
          >
            Enter Platform
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="btn-secondary text-base px-10 py-4 opacity-80"
          >
            Admin Portal
          </button>
        </motion.div>

        {}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-16"
        >
          {features.map((item) => (
            <motion.div
              key={item.label}
              className="glass-card text-left flex flex-col gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-inner">
                {item.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.label}</h3>
                <p className="text-sm text-white/50 leading-relaxed font-light">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
