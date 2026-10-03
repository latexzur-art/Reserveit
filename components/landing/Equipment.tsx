import { Monitor, Volume2, Armchair } from "lucide-react"

const Equipment = () => {
  const equipment = [
    { icon: Monitor, name: "Projectors", description: "High-quality LCD projectors for presentations and screenings", tag: "DISPLAY" },
    { icon: Volume2, name: "Audio Systems", description: "Professional sound systems for events and gatherings", tag: "AUDIO" },
    { icon: Armchair, name: "Furniture", description: "Tables, chairs, and podiums for various event setups", tag: "SEATING" },
  ]

  return (
    <section className="py-24 px-16 text-center" style={{ background: "#f8fafc" }}>
      <div className="max-w-7xl mx-auto">
        <div className="inline-block text-[11px] font-bold uppercase tracking-[1.5px] px-4 py-[5px] rounded-full mb-3"
          style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#374151" }}>ADD-ONS</div>
        <h2 className="text-[clamp(26px,4vw,36px)] font-extrabold leading-[1.15] mb-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0f172a", letterSpacing: "-0.5px" }}>
          Available <span style={{ color: "#1d4ed8" }}>Equipment</span>
        </h2>
        <p className="text-sm mb-12 max-w-xl mx-auto" style={{ color: "#64748b" }}>Request additional equipment alongside your facility booking</p>
        <div className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {equipment.map((item, i) => (
            <div key={i} className="rounded-2xl p-8 text-center" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-center mb-4">
                <item.icon size={30} style={{ color: "#f5c518" }} />
              </div>
              <h4 className="font-bold text-[15px] mb-2" style={{ color: "#0f172a" }}>{item.name}</h4>
              <p className="text-[13px] leading-[1.55] mb-5" style={{ color: "#64748b" }}>{item.description}</p>
              <span className="inline-block text-[10px] font-bold uppercase tracking-[1px] px-3 py-[3px] rounded"
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#64748b" }}>{item.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Equipment
