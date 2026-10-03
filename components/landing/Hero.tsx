"use client"

import { useAuth } from "@/contexts/AuthContext"
import { MapPin, Clock, Users, Calendar } from "lucide-react"
import Image from "next/image"
import BuildingHero from "@/public/landing/3D_STI.png"

const Hero = () => {
  return (
    <section id="home" className="min-h-screen flex flex-col justify-center grid-bg-dark relative overflow-hidden">
      {/* Grid Tile Effect Overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />

      <div className="section-container grid lg:grid-cols-2 items-center gap-12 lg:gap-16 relative z-10" style={{ paddingTop: "calc(68px + 48px)", paddingBottom: "48px" }}>
        {/* LEFT */}
        <div className="flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-[7px] text-[13px] font-medium mb-6 w-fit border border-white/[0.14]" style={{ background: "rgba(255,255,255,0.08)", color: "#c0d0e8" }}>
            <MapPin size={14} className="text-gold" />
            STI College Lucena
          </div>

          <h1 className="text-[clamp(36px,5vw,66px)] font-extrabold leading-[1.02] mb-2 font-display italic text-gold tracking-tight">
            Streamline Your<br />Facility Booking
          </h1>

          <svg viewBox="0 0 500 28" fill="none" preserveAspectRatio="none" className="block w-full mb-5 -mt-1" style={{ maxWidth: 500, height: 28 }}>
            <path d="M8 20 C 60 12, 150 8, 250 10 C 350 12, 440 14, 492 18" stroke="hsl(46 93% 53%)" strokeWidth="7" strokeLinecap="round" opacity="0.55" fill="none" />
            <path d="M12 20 C 70 13, 160 9, 250 11 C 340 13, 430 15, 490 18" stroke="hsl(46 93% 53%)" strokeWidth="3" strokeLinecap="round" opacity="0.25" fill="none" />
          </svg>

          <p className="text-[15px] leading-[1.75] mb-8 text-slate-text max-w-[420px]">
            Book and manage campus facilities with ease. Check availability, reserve spaces, and track approvals — all in one platform.
          </p>

          <div className="flex gap-4 mb-8 flex-wrap">
            <a href="#facilities" className="flex items-center gap-2 px-7 py-[13px] rounded-lg text-[15px] font-bold bg-gold text-gold-foreground no-underline">
              Start Booking
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </a>
            <a href="#about" className="px-7 py-[13px] rounded-lg text-[15px] font-semibold text-slate-light border border-white/[0.22] no-underline hover:text-white transition-colors" style={{ background: "transparent" }}>
              Learn More
            </a>
          </div>

          <div className="flex gap-7 flex-wrap text-[13px] text-slate-text">
            {[
              { icon: <Clock size={15} />, label: "Easy Scheduling" },
              { icon: <Users size={15} />, label: "Multi-user Access" },
              { icon: <Calendar size={15} />, label: "Real-time Updates" },
            ].map(({ icon, label }) => (
              <span key={label} className="flex items-center gap-2">{icon}{label}</span>
            ))}
          </div>
        </div>

        {/* RIGHT: 3D Building */}
        <div className="relative flex items-center justify-center h-[340px] md:h-[460px]">
          <Image
          src={BuildingHero}
          alt="STI College Lucena 3D"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: "screen" }} />

          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 460" fill="none" preserveAspectRatio="none">
            <line x1="148" y1="310" x2="195" y2="340" stroke="rgba(245,197,24,0.6)" strokeWidth="1.5" strokeDasharray="4 3"/>
            <circle cx="195" cy="340" r="3" fill="#f5c518" opacity="0.9"/>
            <line x1="510" y1="92" x2="430" y2="148" stroke="rgba(245,197,24,0.6)" strokeWidth="1.5" strokeDasharray="4 3"/>
            <circle cx="430" cy="148" r="3" fill="#f5c518" opacity="0.9"/>
            <line x1="510" y1="210" x2="445" y2="235" stroke="rgba(245,197,24,0.6)" strokeWidth="1.5" strokeDasharray="4 3"/>
            <circle cx="445" cy="235" r="3" fill="#f5c518" opacity="0.9"/>
          </svg>

          <div className="glass-badge absolute" style={{ top: "62%", left: "8%" }}>
            <span className="badge-dot" /> Gymnasium
          </div>
          <div className="glass-badge absolute" style={{ top: "12%", right: "2%" }}>
            <span className="badge-dot" /> Laboratory
          </div>
          <div className="glass-badge absolute" style={{ top: "38%", right: "2%" }}>
            <span className="badge-dot" /> Classroom
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
