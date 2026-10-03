import { LogIn, Search, CalendarCheck, CheckCircle } from "lucide-react"

const HowItWorks = () => {
  const steps = [
    { icon: LogIn, step: "STEP 01", title: "Log In", description: "Sign in with your STI College credentials" },
    { icon: Search, step: "STEP 02", title: "Browse", description: "Check available facilities and time slots" },
    { icon: CalendarCheck, step: "STEP 03", title: "Reserve", description: "Select your preferred facility and submit" },
    { icon: CheckCircle, step: "STEP 04", title: "Approved", description: "Receive confirmation from facility admin" },
  ]

  return (
    <section id="how-it-works" className="py-24 px-16 text-center" style={{ background: "#f1f5f9" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-[11px] font-bold uppercase tracking-[2.5px] mb-3" style={{ color: "#1d4ed8" }}>HOW IT WORKS</div>
        <h2 className="text-[clamp(26px,4vw,36px)] font-extrabold leading-[1.15] mb-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0f172a", letterSpacing: "-0.5px" }}>
          Book in <span style={{ color: "#1d4ed8" }}>4 Simple Steps</span>
        </h2>
        <p className="text-sm mb-12 max-w-xl mx-auto" style={{ color: "#64748b" }}>Our streamlined process makes facility booking quick and hassle-free</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <div key={i} className="rounded-2xl p-8 text-center" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
              <div className="text-[11px] font-bold uppercase tracking-[2px] mb-5" style={{ color: "#94a3b8" }}>{step.step}</div>
              <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-5" style={{ background: "#0f172a" }}>
                <step.icon size={24} style={{ color: "#f5c518" }} strokeWidth={2} />
              </div>
              <h4 className="font-bold text-[15px] mb-2" style={{ color: "#0f172a" }}>{step.title}</h4>
              <p className="text-[13px] leading-[1.55]" style={{ color: "#64748b" }}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
