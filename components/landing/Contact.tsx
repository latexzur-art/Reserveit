"use client"

import { MapPin, Phone, Mail, Clock } from "lucide-react"

const Contact = () => {
  const contactInfo = [
    { icon: MapPin, label: "Address", value: "STI College Lucena, Lucena City, Quezon Province" },
    { icon: Phone, label: "Phone", value: "(042) 710-1234" },
    { icon: Mail, label: "Email", value: "reserveit@sti-lucena.edu.ph" },
    { icon: Clock, label: "Hours", value: "Mon – Fri, 8:00 AM – 5:00 PM" },
  ]

  return (
    <section id="contact" className="py-24 px-16" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[11px] font-bold uppercase tracking-[2.5px] mb-3" style={{ color: "#1d4ed8" }}>GET IN TOUCH</div>
          <h2 className="text-[clamp(26px,4vw,36px)] font-extrabold leading-[1.15] mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0f172a", letterSpacing: "-0.5px" }}>
            Contact <span style={{ color: "#1d4ed8" }}>Us</span>
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: "#64748b" }}>Have questions? Send us a message and we'll respond as soon as possible.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-8">
          <div>
            {contactInfo.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-4"
                style={{ borderBottom: i < contactInfo.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: "#eff6ff" }}>
                  <item.icon size={15} style={{ color: "#2563eb" }} />
                </div>
                <div>
                  <p className="font-bold text-[13px] mb-[2px]" style={{ color: "#0f172a" }}>{item.label}</p>
                  <p className="text-[13px]" style={{ color: "#64748b" }}>{item.value}</p>
                </div>
              </div>
            ))}
            <div className="mt-4 rounded-xl flex flex-col items-center justify-center gap-2 text-[13px]"
              style={{ background: "#f1f5f9", height: 200, color: "#94a3b8" }}>
              <MapPin size={22} style={{ color: "#94a3b8" }} />
              Map Location
            </div>
          </div>

          <div className="rounded-2xl p-8" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
            <h3 className="font-bold text-[16px] mb-6" style={{ color: "#0f172a" }}>Send a Message</h3>
            <form className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-[5px]">
                  <label className="text-[12px] font-semibold" style={{ color: "#374151" }}>Full Name</label>
                  <input type="text" placeholder="Your name" className="rounded-lg px-3 py-[10px] text-sm outline-none w-full" style={{ border: "1px solid #e2e8f0", color: "#0f172a" }} />
                </div>
                <div className="flex flex-col gap-[5px]">
                  <label className="text-[12px] font-semibold" style={{ color: "#374151" }}>Email</label>
                  <input type="email" placeholder="you@example.com" className="rounded-lg px-3 py-[10px] text-sm outline-none w-full" style={{ border: "1px solid #e2e8f0", color: "#0f172a" }} />
                </div>
              </div>
              <div className="flex flex-col gap-[5px]">
                <label className="text-[12px] font-semibold" style={{ color: "#374151" }}>Subject</label>
                <select className="rounded-lg px-3 py-[10px] text-sm outline-none w-full" style={{ border: "1px solid #e2e8f0", color: "#94a3b8" }}>
                  <option value="" disabled>Select a subject</option>
                  <option>Facility Booking</option>
                  <option>Equipment Rental</option>
                  <option>Event Planning</option>
                  <option>Support</option>
                </select>
              </div>
              <div className="flex flex-col gap-[5px]">
                <label className="text-[12px] font-semibold" style={{ color: "#374151" }}>Message</label>
                <textarea placeholder="How can we help you?" rows={4} className="rounded-lg px-3 py-[10px] text-sm outline-none w-full resize-none"
                  style={{ border: "1px solid #e2e8f0", color: "#0f172a" }} />
              </div>
              <button type="submit" className="w-full py-3 rounded-lg text-[15px] font-bold cursor-pointer border-none"
                style={{ background: "#f5c518", color: "#0d1b3e" }}>
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact
