'use client'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-primary text-primary-foreground py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-10 h-10 object-contain shrink-0" />
              <span className="font-semibold">ReserveIT</span>
            </div>
            <span className="text-primary-foreground/70">|</span>
            <span className="text-sm text-primary-foreground/70">
              &copy; {currentYear} STI Colleges. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="hover:text-secondary transition-colors">Help Center</a>
            <a href="#" className="hover:text-secondary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-secondary transition-colors">Terms of Service</a>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-primary-foreground/20 text-center">
          <p className="text-xs text-primary-foreground/60">
            User Management Module &bull; Part of the ReserveIT Facility Booking System
          </p>
        </div>
      </div>
    </footer>
  )
}
