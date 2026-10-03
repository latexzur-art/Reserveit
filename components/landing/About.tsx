import { Clock, CalendarCheck, Shield, Settings } from "lucide-react"

const About = () => {
  const features = [
    { icon: Clock, title: "Real-time Availability", description: "Check facility availability instantly and avoid scheduling conflicts." },
    { icon: CalendarCheck, title: "Easy Booking", description: "Book facilities with just a few clicks through our intuitive interface." },
    { icon: Shield, title: "Secure Access", description: "Role-based access ensures only authorized users can book specific facilities." },
    { icon: Settings, title: "Full Management", description: "Complete control over bookings, approvals, and facility management." },
  ]

  return (
    <section id="about" className="min-h-screen flex flex-col justify-center grid-bg-dark py-16">
      <div className="section-container grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="flex flex-col justify-center">
          <div className="section-label text-gold">ABOUT US</div>
          <h2 className="section-title text-gold">
            Simplifying Campus<br />Facility Reservations
          </h2>
          <p className="text-[14px] leading-[1.75] mb-8 text-slate-text max-w-[480px]">
            ReserveIT is STI College Lucena's dedicated facility booking system designed to simplify
            the process of reserving campus spaces — from gymnasiums and computer labs to classrooms and multi-purpose halls.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: "hsl(46 93% 53% / 0.12)" }}>
                  <f.icon size={18} className="text-gold" />
                </div>
                <h4 className="font-bold text-white text-sm mb-1">{f.title}</h4>
                <p className="text-xs leading-relaxed text-slate-text">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="relative w-[320px] h-[320px]">
            <div className="absolute inset-0 rounded-full border border-white/[0.07]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-2xl flex flex-col items-center justify-center text-center" style={{ background: "hsl(46 93% 53% / 0.15)", border: "1px solid hsl(46 93% 53% / 0.3)" }}>
              <CalendarCheck size={22} className="text-gold mb-1" />
              <div className="text-3xl font-extrabold leading-none font-display text-gold">98%</div>
              <div className="text-[10px] mt-1 text-slate-text">Utilization</div>
            </div>
            {[
              { label: "3", sub: "Halls", pos: { top: "-18px", left: "50%", transform: "translateX(-50%)" } },
              { label: "12", sub: "Rooms", pos: { top: "50%", left: "-36px", transform: "translateY(-50%)" } },
              { label: "6", sub: "Labs", pos: { top: "50%", right: "-36px", transform: "translateY(-50%)" } },
              { label: "1", sub: "Gym", pos: { bottom: "-18px", left: "20%", transform: "translateX(-50%)" } },
              { label: "500+", sub: "Monthly Bookings", pos: { bottom: "-18px", right: "0%", transform: "translateX(0)" } },
            ].map((node, i) => (
              <div key={i} className="absolute flex items-center gap-2 px-3 py-2 rounded-xl" style={{ ...node.pos, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" } as React.CSSProperties}>
                <div className="text-base font-extrabold font-display text-white/90">{node.label}</div>
                <div className="text-[10px] text-slate-text">{node.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default About
