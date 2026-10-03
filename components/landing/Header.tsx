"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface NavLink {
  name: string
  href: string
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { openAuthModal } = useAuth()

  const navLinks: NavLink[] = [
    { name: "Home", href: "#home" },
    { name: "About", href: "#about" },
    { name: "Facilities", href: "#facilities" },
    { name: "Contact", href: "#contact" },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[68px] border-b border-white/[0.06] grid-bg-dark">
      <div className="section-container h-full flex items-center justify-between">
        <a href="#home" className="flex items-center gap-2.5 no-underline">
          <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain" />
          <span className="font-bold text-[17px] text-white tracking-tight font-display">ReserveIT</span>
        </a>

        <nav className="hidden md:flex items-center gap-9">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="text-slate-light text-sm font-medium no-underline hover:text-white transition-colors">
              {link.name}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex">
          <button onClick={() => openAuthModal("signin")} className="px-[22px] py-[9px] rounded-[7px] text-sm font-bold bg-gold text-gold-foreground">
            Get Started
          </button>
        </div>

        <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="absolute top-[68px] left-0 right-0 flex flex-col gap-4 p-6 md:hidden border-t border-white/10 grid-bg-dark">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="text-slate-light text-sm font-medium no-underline" onClick={() => setIsMenuOpen(false)}>
              {link.name}
            </a>
          ))}
          <button onClick={() => { setIsMenuOpen(false); openAuthModal("signin") }} className="px-5 py-2 rounded-[7px] text-sm font-bold w-fit bg-gold text-gold-foreground">
            Get Started
          </button>
        </div>
      )}
    </header>
  )
}

export default Header
