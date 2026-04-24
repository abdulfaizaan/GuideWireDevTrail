import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "GigShield — Parametric Fintech",
  description: "Premium automated insurance platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen relative text-white font-sans selection:bg-brand-purple/30 selection:text-white" suppressHydrationWarning>
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/15 blur-[120px] rounded-full animate-blob mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#6366F1]/15 blur-[120px] rounded-full animate-blob animation-delay-2000 mix-blend-screen" />
          <div className="absolute top-[20%] left-[40%] w-[40%] h-[40%] bg-[#22C55E]/10 blur-[120px] rounded-full animate-blob animation-delay-4000 mix-blend-screen" />
        </div>
        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
