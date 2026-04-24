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
    <main className="min-h-screen flex items-center justify-center -mt-10 px-6 relative overflow-hidden">
      {/* Ambient background glows specific to landing page */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-brand-purple/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center space-y-12 relative z-10">
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-full px-5 py-2.5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
        >
          <div className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
          <span className="text-sm text-white/80 font-medium tracking-wide">Next-Gen Parametric Platform</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-[5rem] font-bold tracking-tight text-white leading-[1.1] max-w-4xl drop-shadow-2xl"
        >
          Your Income Shouldn&apos;t <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple via-[#A78BFA] to-brand-blue relative">
            Depend on Weather
            <span className="absolute -inset-1 blur-2xl bg-gradient-to-r from-brand-purple to-brand-blue opacity-30 z-[-1]" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-white/60 max-w-2xl font-light leading-relaxed"
        >
          Premium algorithmic insurance tailored for modern professionals. 
          Get paid automatically when disruptions occur, seamlessly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-5 pt-6 w-full sm:w-auto"
        >
          <button
            onClick={() => router.push("/register")}
            className="btn-primary text-base px-10 py-4 w-full sm:w-auto text-lg"
          >
            Get Protected
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-secondary text-base px-10 py-4 w-full sm:w-auto text-lg"
          >
            Enter Platform
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="btn-secondary text-base px-10 py-4 w-full sm:w-auto text-lg opacity-80"
          >
            Admin Portal
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-20"
        >
          {features.map((item, i) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -5 }}
              className="glass-card glass-card-interactive text-left flex flex-col gap-5 relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-2xl shadow-inner relative">
                {item.icon}
                <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-shadow" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-semibold text-white mb-2">{item.label}</h3>
                <p className="text-sm text-white/50 leading-relaxed font-light">{item.sub}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
