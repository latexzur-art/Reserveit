'use client'

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  User,
  FileText,
  Bell,
  CreditCard,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  X,
  CalendarClock,
  Upload,
  CheckCircle2,
  GraduationCap,
  Calendar,
  HelpCircle,
  BookOpen,
  History,
  UserCheck,
  Layers,
  Contact,
  Building2
} from 'lucide-react';
import { HelpSheet } from '@/components/help/HelpSheet';
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = 'programhead-sidebar-collapsed';

export const FacultySidebar = ({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) => {
  const pathname = usePathname();
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
  const logoBg = "bg-sti-blue shadow-lg shadow-sti-blue/20";

  const menuGroups = [
    {
      group: "Overview",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/program/dashboard" },
        { icon: CalendarClock, label: "My Schedules", path: "/program/schedules" },
        { icon: Bell, label: "Notifications", path: "/program/notifications" },
      ]
    },
    {
      group: "Operations",
      items: [
        { icon: ClipboardList, label: "New Reservation", path: "/program/form" },
        { icon: Building2, label: "Facilities", path: "/program/facilities" },
        { icon: FileText, label: "My Reservations", path: "/program/reservations" },
        { icon: Calendar, label: "Calendar", path: "/program/calendar" },
        { icon: CreditCard, label: "Payment", path: "/program/payment" },
      ]
    },
    {
      group: "Management",
      items: [
        { icon: Contact, label: "Faculty Directory", path: "/program/faculty" },
        { icon: CheckCircle2, label: "Approved Schedules", path: "/program/approved-schedules" },
        { icon: Upload, label: "Schedule Uploads", path: "/program/schedules/uploads" },
        { icon: UserCheck, label: "Professor Assignments", path: "/program/schedules/assignments" },
        { icon: GraduationCap, label: "Curriculum", path: "/program/curriculum" },
        { icon: BookOpen, label: "Courses", path: "/program/courses" },
        { icon: Layers, label: "Sections", path: "/program/sections" },
        { icon: History, label: "Upload History", path: "/program/history" },
      ]
    },
    {
      group: "Account",
      items: [
        { icon: User, label: "Profile", path: "/program/profile" },
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0D0F12] border-r border-neutral-200 dark:border-white/5">
      {/* Branding Header */}
      <div className={cn(
        "flex items-center px-5 h-[70px] border-b border-neutral-200 dark:border-white/5 transition-all duration-500", 
        expanded ? "justify-between" : "justify-center"
      )}>
        {expanded ? (
          <>
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-10 h-10 object-contain shrink-0" />
              <div className="flex flex-col">
                <h1 className="font-black text-[#050d36] dark:text-white tracking-tighter text-[15px] whitespace-nowrap uppercase leading-none mt-0.5">
                  RESERVE<span className={cn("transition-colors", activeClass)}>IT</span>
                </h1>
              </div>
            </div>
            <button
              onClick={toggleExpanded}
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:block transition-all"
            >
              <ChevronsLeft size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={toggleExpanded}
            aria-label="Expand sidebar"
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:block transition-all"
          >
            <ChevronsRight size={22} />
          </button>
        )}

        <button
          onClick={onMobileClose}
          aria-label="Close menu"
          className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-7 overflow-y-auto no-scrollbar">
        {menuGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            {expanded && (
              <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                const iconSize = expanded ? 20 : 24;
                return (
                  <Link 
                    key={item.path} 
                    href={item.path} 
                    onClick={onMobileClose} 
                    className={cn(
                      "flex items-center rounded-2xl transition-all duration-300 group relative",
                      expanded ? "px-4 py-3 gap-3" : "p-3 justify-center mb-1",
                      isActive 
                        ? `${activeBg} ${activeClass} shadow-sm ring-1 ring-black/5 dark:ring-white/5` 
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                    )}
                  >
                    <item.icon size={iconSize} className={cn("shrink-0 transition-all duration-300", isActive ? activeClass : "group-hover:text-foreground")} />
                    {expanded && (
                      <span className="text-[11px] font-black uppercase tracking-tight">
                        {item.label}
                      </span>
                    )}
                    {isActive && (
                      <div className={cn("absolute left-0 w-1 h-6 rounded-r-full", logoBg)} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Support Group */}
        <div className="pt-2 border-t border-neutral-200 dark:border-white/5 mt-2 space-y-1">
          {expanded && (
            <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
              Support
            </p>
          )}
          <button
            onClick={() => setHelpOpen(true)}
            className={cn(
              "flex items-center w-full rounded-2xl transition-all duration-300 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5",
              expanded ? "px-4 py-3 gap-3" : "p-3 justify-center"
            )}
          >
            <HelpCircle size={expanded ? 20 : 24} className="shrink-0" />
            {expanded && <span className="text-[11px] font-black uppercase tracking-tight">Help Center</span>}
          </button>
        </div>
      </nav>

      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );

  return (
    <>
      <aside className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 ease-in-out bg-card border-r border-neutral-200 dark:border-white/5",
        expanded ? "w-72" : "w-24"
      )}>
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-sti-navy/40 backdrop-blur-md animate-in fade-in duration-300"
            onClick={onMobileClose} 
          />
          <div className="absolute left-0 top-0 h-full w-72 shadow-2xl animate-in slide-in-from-left duration-500 ease-out">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};