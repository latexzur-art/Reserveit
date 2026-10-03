'use client'

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  History,
  Settings,
  BookOpen,
  Upload,
  ClipboardCheck,
  Calendar,
  Building2,
  CalendarClock,
  FileEdit,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
  ListChecks,
  CreditCard,
  ClipboardList,
  X,
  HelpCircle,
  TableProperties,
  Layers,
  Bell,
  UserCheck,
} from 'lucide-react';
import { HelpSheet } from '@/components/help/HelpSheet';
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from '@/lib/routes'

type MenuItem = { 
  icon: React.ComponentType<{ size?: number; className?: string }>; 
  label: string; 
  path: string;
  roles?: string[];
};
type MenuGroup = { group: string; items: MenuItem[] };

const SIDEBAR_COLLAPSED_KEY = 'academic-sidebar-collapsed';
const MESSAGING_ENABLED = false;

export const AcademicHeadSidebar = ({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) => {
  const pathname = usePathname();
  const { user } = useAuth();
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

  const activeClass = "text-yellow-600 dark:text-blue-400";
  const activeBg = "bg-yellow-50 dark:bg-blue-600/10";
  const logoBg = "bg-yellow-400 dark:bg-blue-600";

  const userRoleNames = (user?.roles ?? []).map(r => r.name);

  const menuGroups: MenuGroup[] = [
    {
      group: "Overview",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: ROUTES.academic.dashboard },
        { icon: CalendarDays, label: "Facility Reservations", path: ROUTES.academic.reservations },
        { icon: CalendarClock, label: "All Schedules", path: ROUTES.academic.mySchedules },
        { icon: Bell, label: "Notifications", path: ROUTES.academic.notifications },
        ...(MESSAGING_ENABLED ? [{ icon: MessageSquare, label: "Messages", path: ROUTES.academic.messages } as MenuItem] : []),
      ]
    },
    {
      group: "Operations",
      items: [
        { icon: CalendarDays, label: "Reserve Room", path: ROUTES.academic.reserve },
        { icon: Building2, label: "Facilities", path: ROUTES.academic.facilities },
        { icon: ClipboardList, label: "My Reservations", path: ROUTES.academic.myReservations },
        { icon: CreditCard, label: "Payment", path: ROUTES.academic.payment },
      ]
    },
    {
      group: "Schedules",
      items: [
        { icon: TableProperties, label: "Schedule Directory", path: ROUTES.academic.schedulesAll },
        { icon: Upload, label: "Uploads", path: ROUTES.academic.schedulesUploads },
        { icon: ClipboardCheck, label: "Review Queue", path: ROUTES.academic.schedulesReview },
        { icon: UserCheck, label: "Professor Lineups", path: ROUTES.academic.schedulesAssignments },
        { icon: FileEdit, label: "Change Requests", path: ROUTES.academic.schedulesChangeRequests },
        { icon: Calendar, label: "Calendar", path: ROUTES.academic.schedulesCalendar },
        { icon: CalendarDays, label: "School Events", path: ROUTES.academic.schedulesEvents },
        { icon: CalendarClock, label: "Academic Terms", path: ROUTES.academic.schedulesTerms },
        { icon: History, label: "Schedule History", path: ROUTES.academic.schedulesHistory },
      ]
    },
    {
      group: "Curriculum",
      items: [
        { icon: BookOpen, label: "Course Catalog", path: ROUTES.academic.curriculumCourseCatalog },
        { icon: ListChecks, label: "Approval Queue", path: ROUTES.academic.curriculumApprovalQueue, roles: ['academic_head'] },
        { icon: History, label: "Course History", path: ROUTES.academic.curriculumUploadHistory },
        { icon: Layers, label: "Sections", path: ROUTES.academic.academicSections },
      ]
    },
    {
      group: "Personnel",
      items: [
        { icon: Users, label: "Departments", path: ROUTES.academic.departments },
      ]
    },
    {
      group: "Management",
      items: [
        // { icon: Building2, label: "Facility Aliases", path: ROUTES.academic.schedulesAliases }, // Hidden per project requirements (preserved for future use)
        { icon: Settings, label: "Settings", path: ROUTES.academic.settings },
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0D0F12]">
      {/* Branding Header */}
      <div className={cn(
        "flex items-center px-5 h-[70px] border-b border-neutral-200 dark:border-white/5", 
        expanded ? "justify-between" : "justify-center"
      )}>
        {expanded ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain shrink-0" />
              <h1 className="font-black text-[#050d36] dark:text-white tracking-tighter text-[15px] whitespace-nowrap uppercase leading-none mt-0.5">
                RESERVE<span className={cn("transition-colors", activeClass)}>IT</span>
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleExpanded} 
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:block transition-all"
              >
                <ChevronsLeft size={18} />
              </button>
            </div>
          </>
        ) : (
          <button 
            onClick={toggleExpanded} 
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:block transition-all"
          >
            <ChevronsRight size={22} />
          </button>
        )}
        
        {/* Mobile Close Button (Always visible on mobile when open) */}
        <button 
          onClick={onMobileClose} 
          className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-7 overflow-y-auto custom-scrollbar">
        {user && menuGroups.map((group) => {
          const visibleItems = group.items.filter(item => !item.roles || item.roles.some(role => userRoleNames.includes(role)));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="space-y-1">
              {expanded && (
                <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
                  {group.group}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.path;
                  const iconSize = expanded ? 20 : 24;
                  return (
                    <Link 
                      key={item.path} 
                      href={item.path} 
                      onClick={onMobileClose} 
                      className={cn(
                        "flex items-center rounded-2xl transition-all duration-300 group relative",
                        expanded ? "px-4 py-3 gap-3" : "p-3 justify-center",
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
          );
        })}
        
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
      {/* Desktop View */}
      <aside className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 ease-in-out bg-white dark:bg-[#0D0F12] border-r border-neutral-200 dark:border-white/5",
        expanded ? "w-72" : "w-24"
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile View */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-[#050d36]/40 backdrop-blur-md animate-in fade-in duration-300" 
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