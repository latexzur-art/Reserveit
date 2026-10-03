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
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  X,
  CalendarClock,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { HelpSheet } from '@/components/help/HelpSheet';
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const SIDEBAR_COLLAPSED_KEY = 'faculty-sidebar-collapsed';

export const FacultySidebar = ({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) => {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') setExpanded(false);
  }, []);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!next));
  };

  const activeClass = "text-sti-blue";
  const activeBg = "bg-sti-blue/10";
  const logoAccent = "bg-sti-blue";

  const menuGroups = [
    {
      group: "Overview",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/faculty/dashboard" },
      ]
    },
    {
      group: "Reservations",
      items: [
        { icon: ClipboardList, label: "New Reservation", path: "/faculty/form" },
        { icon: Building2, label: "Facilities", path: "/faculty/facilities" },
        { icon: FileText, label: "My Reservations", path: "/faculty/reservations" },
        { icon: CalendarClock, label: "My Schedules", path: "/faculty/schedules" },
      ]
    },
    {
      group: "Scheduling",
      items: [
        { icon: Calendar, label: "Calendar", path: "/faculty/calendar" },
      ]
    },
    {
      group: "Finance",
      items: [
        { icon: CreditCard, label: "Payment", path: "/faculty/payment" },
      ]
    },
    {
      group: "Communication",
      items: [
        { icon: Bell, label: "Notifications", path: "/faculty/notifications" },
      ]
    },
    {
      group: "Account",
      items: [
        { icon: User, label: "Profile", path: "/faculty/profile" },
      ]
    }
  ];

  const sidebarContent = (
    <div className={cn(
      "flex flex-col bg-white dark:bg-[#0D0F12] border-r border-neutral-200 dark:border-white/5 transition-all duration-300 ease-in-out h-full z-40",
      expanded ? "w-64" : "w-20"
    )}>
      {/* Branding */}
      <div className={cn("flex items-center px-5 h-[70px] border-b border-neutral-200 dark:border-white/5 transition-all duration-500", expanded ? "justify-between" : "justify-center")}>
        {expanded ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-10 h-10 object-contain shrink-0" />
              <h1 className="font-black text-[#050d36] dark:text-white tracking-tighter text-[15px] whitespace-nowrap uppercase leading-none mt-0.5">
                RESERVE<span className="text-blue-600 dark:text-blue-400">IT</span>
              </h1>
            </div>
            <button onClick={toggleExpanded} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:block transition-all"><ChevronsLeft size={18} /></button>
            <button onClick={onMobileClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all"><X size={18} /></button>
          </>
        ) : (
          <button onClick={toggleExpanded} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronsRight size={20} /></button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group) => (
          <div key={group.group} className="space-y-2">
            {expanded && <p className="px-3 text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3 opacity-70">{group.group}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.path || (item.path !== '/faculty/dashboard' && pathname.startsWith(item.path + '/'));
                return (
                  <Link key={item.path} href={item.path} onClick={onMobileClose} className={cn(
                    "flex items-center rounded-2xl transition-all duration-300 group relative",
                    expanded ? "px-4 py-3 gap-3" : "p-3 justify-center",
                    isActive 
                      ? `${activeBg} ${activeClass} shadow-sm ring-1 ring-black/5 dark:ring-white/5` 
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}>
                    <item.icon size={20} className={cn("shrink-0 transition-all duration-300", isActive ? activeClass : "group-hover:text-foreground")} />
                    {expanded && <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>}
                    {isActive && (
                      <div className="absolute left-0 w-1 h-6 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {/* Help & FAQ */}
        <div className="pt-2 border-t border-neutral-200 dark:border-white/5 mt-2">
          <button
            onClick={() => setHelpOpen(true)}
            className={cn(
              "flex items-center w-full rounded-2xl transition-all duration-300 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5",
              expanded ? "px-4 py-3 gap-3" : "p-3 justify-center"
            )}
          >
            <HelpCircle size={20} className="shrink-0" />
            {expanded && <span className="text-xs font-bold uppercase tracking-tight">Help & FAQ</span>}
          </button>
        </div>
      </nav>

      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#050d36]/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onMobileClose} />
          <div className="absolute left-0 top-0 h-full w-64 shadow-2xl animate-in slide-in-from-left duration-500 ease-out">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
