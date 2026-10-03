'use client'

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import {
  LayoutDashboard, Building2, Calendar, ClipboardList,
  Box, FileText, ChevronDown, Menu, X,
  ChevronsLeft, ChevronsRight, ShieldAlert, ShieldCheck, HardDrive,
  CreditCard, BarChart3, Settings2, Users, Tag, HelpCircle, BookOpen, CalendarPlus, Bell, MessageSquare, Images,
  AirVent, ArrowLeftRight, Wallet2, CalendarDays
} from "lucide-react";
import { HelpSheet } from "@/components/help/HelpSheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { AuthUser } from "@/backend/auth/auth.types";

type MenuItem = { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; path: string };
type MenuGroup = { group: string; items: MenuItem[] };
type MenuConfig = { groups: MenuGroup[]; showLogs: boolean };

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

const buildingAdminMenu: MenuConfig = {
  groups: [
    {
      group: "Overview",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: ROUTES.buildingAdmin.root },
        { icon: Building2, label: "Room Availability", path: ROUTES.buildingAdmin.roomAvailability },
        { icon: Calendar, label: "Calendar", path: ROUTES.buildingAdmin.calendar },
        { icon: BarChart3, label: "Reports & Analytics", path: ROUTES.buildingAdmin.reports },
      ]
    },
    {
      group: "Communications",
      items: [
        { icon: MessageSquare, label: "Messages", path: ROUTES.buildingAdmin.messages },
        { icon: Bell, label: "Notifications", path: ROUTES.buildingAdmin.notifications },
      ]
    },
    {
      group: "Operations",
      items: [
        { icon: Settings2, label: "Facility Management", path: ROUTES.buildingAdmin.facilityManagement },
        { icon: Images, label: "Facility Brochure", path: ROUTES.buildingAdmin.facilities },
        { icon: ClipboardList, label: "Reservations", path: ROUTES.buildingAdmin.reservations },
        { icon: Wallet2, label: "Payment Management", path: ROUTES.buildingAdmin.paymentManagement },
        { icon: CalendarDays, label: "School Events", path: ROUTES.buildingAdmin.schoolEvents },
        { icon: Box, label: "Equipment", path: ROUTES.buildingAdmin.equipment },
        { icon: AirVent, label: "HVAC Fixtures", path: ROUTES.buildingAdmin.equipmentHvac },
        { icon: ClipboardList, label: "Reports Triage", path: ROUTES.buildingAdmin.equipmentReports },
        { icon: ArrowLeftRight, label: "Assign Requests", path: ROUTES.buildingAdmin.equipmentRequests },
        { icon: Tag, label: "Pricing & Rates", path: ROUTES.buildingAdmin.pricing },
      ]
    },
    {
      group: "Personnel",
      items: [
        { icon: Users, label: "Directory", path: ROUTES.buildingAdmin.directory },
      ]
    },
    {
      group: "Security",
      items: [
        { icon: ShieldAlert, label: "Restricted Users", path: ROUTES.buildingAdmin.restrictedUsers },
      ]
    },
    {
      group: "Resources",
      items: [
        { icon: BookOpen, label: "FAQ Management", path: ROUTES.buildingAdmin.faq },
      ]
    },
    {
      group: "My Account",
      items: [
        { icon: CalendarPlus, label: "Reserve for Myself", path: ROUTES.buildingAdmin.reserve },
        { icon: CreditCard,   label: "My Payments",        path: ROUTES.buildingAdmin.payment },
      ]
    }
  ],
  showLogs: true,
};

// ─── Extracted to module level to give React a stable component identity ──────
interface SidebarContentProps {
  isMobile?: boolean;
  expanded: boolean;
  user: AuthUser | null;
  menu: MenuConfig;
  logsOpen: boolean;
  helpOpen: boolean;
  setLogsOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setMobileOpen: (v: boolean) => void;
  toggleExpanded: () => void;
}

const SidebarContent = ({
  isMobile = false,
  expanded,
  user,
  menu,
  logsOpen,
  helpOpen,
  setLogsOpen,
  setHelpOpen,
  setMobileOpen,
  toggleExpanded,
}: SidebarContentProps) => {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0D0F12]">
      {/* Branding */}
      <div className={cn(
        "flex items-center px-5 h-[70px] border-b border-neutral-200 dark:border-white/5",
        (expanded || isMobile) ? "justify-between" : "justify-center"
      )}>
        {(expanded || isMobile) ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain shrink-0" />
              <h1 className="font-black text-[#050d36] dark:text-white tracking-tighter text-[15px] whitespace-nowrap uppercase leading-none mt-0.5">
                RESERVE<span className="text-yellow-500 dark:text-blue-400">IT</span>
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleExpanded} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hidden lg:block transition-all">
                <ChevronsLeft size={18} />
              </button>
              {isMobile && (
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-all">
                  <X size={18} />
                </button>
              )}
            </div>
          </>
        ) : (
          <button onClick={toggleExpanded} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
            <ChevronsRight size={22} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
        {user && menu.groups.map((group) => (
          <div key={group.group} className="space-y-1">
            {(expanded || isMobile) && (
              <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.path;
              const iconSize = (expanded || isMobile) ? 20 : 24;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={cn(
                    "flex items-center rounded-2xl transition-all duration-300 group relative",
                    (expanded || isMobile) ? "px-4 py-3 gap-3" : "p-3 justify-center",
                    isActive
                      ? "bg-yellow-50 dark:bg-blue-600/10 text-yellow-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 w-1 h-6 rounded-r-full bg-yellow-500 dark:bg-blue-600" />
                  )}
                  <item.icon
                    size={iconSize}
                    className={cn(
                      "shrink-0 transition-all duration-300",
                      isActive ? "text-yellow-500 dark:text-blue-400" : "group-hover:text-foreground"
                    )}
                  />
                  {(expanded || isMobile) && (
                    <span className="text-[12.5px] font-semibold tracking-tight">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {user && menu.showLogs && (
          <div className="space-y-1">
            {(expanded || isMobile) && (
              <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
                Audit Trail
              </p>
            )}
            <button
              onClick={() => setLogsOpen(!logsOpen)}
              className={cn(
                "flex items-center w-full rounded-2xl transition-all duration-300 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200",
                (expanded || isMobile) ? "px-4 py-3 gap-3" : "p-3 justify-center"
              )}
            >
              <FileText size={(expanded || isMobile) ? 20 : 24} className="shrink-0 transition-all" />
              {(expanded || isMobile) && (
                <>
                  <span className="text-[12.5px] font-semibold tracking-tight flex-1 text-left">Logs</span>
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform duration-300 opacity-50", logsOpen && "rotate-180")}
                  />
                </>
              )}
            </button>

            {(expanded || isMobile) && logsOpen && (
              <div className="ml-6 border-l-2 border-slate-200 dark:border-white/10 pl-2 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                <LogSubItem
                  icon={HardDrive}
                  label="Maintenance"
                  href={ROUTES.buildingAdmin.maintenanceLogs}
                  onClick={() => isMobile && setMobileOpen(false)}
                />
                <LogSubItem
                  icon={CreditCard}
                  label="Payments"
                  href={ROUTES.buildingAdmin.paymentLogs}
                  onClick={() => isMobile && setMobileOpen(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Structured Help Section */}
        <div className="pt-2 border-t border-neutral-200 dark:border-white/5 mt-2 space-y-1">
          {(expanded || isMobile) && (
            <p className="px-4 text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-70">
              Support
            </p>
          )}
          <button
            onClick={() => setHelpOpen(true)}
            className={cn(
              "flex items-center w-full rounded-2xl transition-all duration-300 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5",
              (expanded || isMobile) ? "px-4 py-3 gap-3" : "p-3 justify-center"
            )}
          >
            <HelpCircle size={(expanded || isMobile) ? 20 : 24} className="shrink-0" />
            {(expanded || isMobile) && (
              <span className="text-[12.5px] font-semibold tracking-tight">Help Center</span>
            )}
          </button>
        </div>
      </nav>

      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};

export const AdminSidebar = () => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
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

  const menu = buildingAdminMenu;

  const contentProps: SidebarContentProps = {
    expanded, user, menu, logsOpen, helpOpen,
    setLogsOpen, setHelpOpen, setMobileOpen, toggleExpanded,
  };

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 shadow-xl bg-white dark:bg-[#15181E] border-neutral-200 dark:border-white/5"
            >
              <Menu size={18} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 w-72 border-none bg-white dark:bg-[#0D0F12]"
            showCloseButton={false}
          >
            <SidebarContent {...contentProps} isMobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Aside */}
      <aside className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 ease-in-out bg-white dark:bg-[#0D0F12] border-r border-neutral-200 dark:border-white/5",
        expanded ? "w-72" : "w-24"
      )}>
        <SidebarContent {...contentProps} />
      </aside>
    </>
  );
};

const LogSubItem = ({ icon: Icon, label, href, onClick }: any) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold tracking-normal transition-all",
        isActive
          ? "text-yellow-600 dark:text-blue-400"
          : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
      )}
    >
      <Icon size={13} className="shrink-0" /> {label}
    </Link>
  );
};
