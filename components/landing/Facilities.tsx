"use client"

import { Users } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const Facilities = () => {
  const { openAuthModal } = useAuth()

  const facilities = [
    { name: "Gymnasium", tag: "Sports", description: "Spacious indoor sports facility for basketball, volleyball, and large events.", capacity: "500 pax" },
    { name: "Multi-Purpose Hall", tag: "Events", description: "Versatile venue ideal for seminars, conferences, and gatherings.", capacity: "300 pax" },
    { name: "Computer Labs", tag: "Tech", description: "Modern laboratories equipped with the latest hardware and software.", capacity: "50 pax" },
    { name: "Classrooms", tag: "Academic", description: "Well-ventilated rooms with multimedia facilities for activities.", capacity: "40 pax" },
  ]

  return (
    <section id="facilities" className="py-24 px-16 text-center" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-[11px] font-bold uppercase tracking-[2.5px] mb-3" style={{ color: "#1d4ed8" }}>OUR SPACES</div>
        <h2 className="text-[clamp(26px,4vw,36px)] font-extrabold leading-[1.15] mb-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0f172a", letterSpacing: "-0.5px" }}>
          Campus <span style={{ color: "#1d4ed8" }}>Facilities</span>
        </h2>
        <p className="text-sm mb-12 max-w-xl mx-auto" style={{ color: "#64748b" }}>Discover the range of facilities available for booking at STI College Lucena</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          {facilities.map((fac, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e2e8f0", background: "#fff" }}>
              <div className="h-44 flex items-center justify-center relative" style={{ background: "#f1f5f9" }}>
                <span className="absolute top-3 left-3 text-[11px] font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.92)", color: "#374151" }}>{fac.tag}</span>
                <Users size={36} style={{ color: "#cbd5e1" }} strokeWidth={1.5} />
              </div>
              <div className="p-5">
                <h4 className="font-bold text-[15px] mb-1" style={{ color: "#0f172a" }}>{fac.name}</h4>
                <p className="text-[13px] leading-[1.5] mb-3" style={{ color: "#64748b" }}>{fac.description}</p>
                <div className="flex items-center gap-[5px] mb-4 text-[12px]" style={{ color: "#94a3b8" }}>
                  <Users size={13} />{fac.capacity}
                </div>
                <button onClick={() => openAuthModal("signin")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-semibold cursor-pointer border-none"
                  style={{ background: "#0f172a", color: "#f5c518", fontFamily: "'Inter', sans-serif" }}>
                  Book Now →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Facilities
