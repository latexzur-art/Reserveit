'use client'

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  User,
  FileText,
  Bell,
  CreditCard,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  X,
  Menu,
  HelpCircle,
  Building2
} from 'lucide-react';
import { HelpSheet } from '@/components/help/HelpSheet';
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useClientLayout } from './ClientLayoutContext';
import { ROUTES } from '@/lib/routes'

type MenuItem = { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; path: string };
type MenuGroup = { group: string; items: MenuItem[] };

const SIDEBAR_COLLAPSED_KEY = 'client-sidebar-collapsed';

const clientMenu: MenuGroup[] = [
  {
    group: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: ROUTES.client.dashboard },
      { icon: Calendar, label: "Calendar", path: ROUTES.client.calendar },
      { icon: Bell, label: "Notifications", path: ROUTES.client.notifications },
    ]
  },
  {
    group: "Operations",
    items: [
      { icon: ClipboardList, label: "New Booking", path: ROUTES.client.booking },
      { icon: Building2, label: "Facilities", path: ROUTES.client.facilities },
      { icon: FileText, label: "My Bookings", path: ROUTES.client.bookings },
      { icon: CreditCard, label: "Payment", path: ROUTES.client.payment },
    ]
  },
  {
    group: "Account",
    items: [
      { icon: User, label: "Profile", path: ROUTES.client.profile },
    ]
  }
];

export const ClientSidebar = () => {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Use context instead of local state for mobile
  const { mobileMenuOpen, setMobileMenuOpen } = useClientLayout();

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') setExpanded(false);
  }, []);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!next));
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-card">
      {/* Branding Section */}
      <div className={cn(
        "flex items-center px-5 h-[70px] border-b border-neutral-200 dark:border-white/5 transition-all duration-500",
        (expanded || isMobile) ? "justify-between" : "justify-center"
      )}>
        {(expanded || isMobile) ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain shrink-0" />
              <h1 className="font-black text-sti-navy dark:text-white tracking-tighter text-[15px] whitespace-nowrap uppercase leading-none mt-0.5">
                RESERVE<span className="text-yellow-500 dark:text-yellow-400">IT</span>
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleExpanded} aria-label="Collapse sidebar" className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:flex transition-all">
                <ChevronsLeft size={18} />
              </button>
              {isMobile && (
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all">
                  <X size={18} />
                </button>
              )}
            </div>
          </>
        ) : (
          <button onClick={toggleExpanded} aria-label="Expand sidebar" className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
            <ChevronsRight size={22} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
        {clientMenu.map((group) => (
          <div key={group.group} className="space-y-1">
            {(expanded || isMobile) && (
              <p className="px-4 text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.3em] mb-4 opacity-70">
                {group.group}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.path || (item.path !== ROUTES.client.dashboard && pathname.startsWith(item.path + '/'));
                const iconSize = (expanded || isMobile) ? 20 : 24;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => isMobile && setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center rounded-2xl transition-all duration-300 group relative",
                      (expanded || isMobile) ? "px-4 py-3 gap-3" : "p-3 justify-center",
                      isActive
                        ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                    )}
                  >
                    <item.icon
                      size={iconSize}
                      className={cn(
                        "shrink-0 transition-all duration-300",
                        isActive ? "text-yellow-600 dark:text-yellow-400" : "group-hover:text-foreground"
                      )}
                    />
                    {(expanded || isMobile) && (
                      <span className="text-[11px] font-black uppercase tracking-tight">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Help & FAQ Section */}
        <div className="pt-2 border-t border-neutral-200 dark:border-white/5 mt-2">
          <button
            onClick={() => setHelpOpen(true)}
            className={cn(
              "flex items-center w-full rounded-2xl transition-all duration-300 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5",
              (expanded || isMobile) ? "px-4 py-3 gap-3" : "p-3 justify-center"
            )}
          >
            <HelpCircle size={(expanded || isMobile) ? 20 : 24} />
            {(expanded || isMobile) && <span className="text-[11px] font-black uppercase tracking-tight">Help & FAQ</span>}
          </button>
        </div>
      </nav>

      {/* Sign Out Section */}
      <div className="p-4 border-t border-neutral-200 dark:border-white/5">
        <button
          onClick={() => signOut()}
          className={cn(
            "flex items-center w-full rounded-2xl transition-all duration-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-black uppercase text-[11px] tracking-tight",
            (expanded || isMobile) ? "px-4 py-3 gap-3" : "p-3 justify-center"
          )}
        >
          <LogOut size={(expanded || isMobile) ? 20 : 24} />
          {(expanded || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
      
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 border-none bg-card"
        >
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 ease-in-out bg-card border-r border-neutral-200 dark:border-white/5",
        expanded ? "w-72" : "w-24"
      )}>
        <SidebarContent />
      </aside>
    </>
  );
};