import { MapPin, Instagram, Linkedin } from "lucide-react"
import Link from "next/link"

const Footer = () => {
  return (
    <footer className="grid-bg-dark pt-10 lg:pt-16">
      <div className="section-container pb-12 lg:pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1.5fr_1.5fr] gap-x-8 gap-y-12 lg:gap-x-12">
          {/* Brand Column */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-14 h-14 object-contain" />
              <span className="font-bold text-xl text-white tracking-tight font-display">ReserveIT</span>
            </div>
            <p className="text-sm leading-relaxed mb-8 text-slate-text/90 max-w-sm">
              STI College Lucena's facility booking system. Making reservations simple, efficient, and hassle-free for everyone.
            </p>
            <div className="flex gap-4 mt-6">
              {[MapPin, Instagram, Linkedin].map((Icon, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 hover:bg-gold hover:border-gold hover:-translate-y-1 group"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Icon size={18} className="text-slate-text group-hover:text-gold-foreground transition-colors" />
                </div>
              ))}
            </div>
          </div>

          {/* Links Column */}
          <div className="lg:ml-auto">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-gold drop-shadow-sm">LINKS</h4>
            <ul className="space-y-4 list-none p-0">
              {["Home", "About", "Facilities", "Contact"].map((item) => (
                <li key={item}>
                  <a href={`#${item.toLowerCase()}`} className="text-sm no-underline text-slate-text/80 hover:text-gold transition-colors block">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services Column */}
          <div className="lg:ml-auto">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-gold drop-shadow-sm">SERVICES</h4>
            <ul className="space-y-4 list-none p-0">
              {["Facility Booking", "Equipment Rental", "Event Planning", "Support"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm no-underline text-slate-text/80 hover:text-gold transition-colors block">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column */}
          <div className="lg:ml-auto">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-gold drop-shadow-sm">CONTACT</h4>
            <ul className="space-y-4 list-none p-0">
              {[
                { text: "STI College Lucena", href: "#" },
                { text: "Lucena City, Quezon", href: "#" },
                { text: "(042) 710-1234", href: "tel:0427101234" },
                { text: "reserveit@sti-lucena.edu.ph", href: "mailto:reserveit@sti-lucena.edu.ph" }
              ].map((item, i) => (
                <li key={i}>
                  <a href={item.href} className="text-sm no-underline text-slate-text/80 hover:text-gold transition-colors block">{item.text}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="border-t border-white/[0.08] bg-black/20">
        <div className="section-container py-10 lg:py-14 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-text/60">© 2025 ReserveIT — STI College Lucena. All rights reserved.</p>
          <div className="flex gap-6 text-xs text-slate-text/60">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
