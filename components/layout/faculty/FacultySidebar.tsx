// DEPRECATED: This component is unused. The active faculty sidebar is at
// app/faculty/_components/FacultySidebar.tsx (imported by the faculty layout).
// Links in this file point to non-existent pages — do not wire this component up.
'use client'

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Users, FileText, ChevronDown, ChevronsLeft, ChevronsRight, ShieldAlert, BarChart3, Settings2, AcademicCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type MenuItem = { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; path: string };
type MenuGroup = { group: string; items: MenuItem[] };
type MenuConfig = { groups: MenuGroup[]; showLogs: boolean; roleKey: string };

// --- CONFIGURATION START ---

const facultyMenuConfig: MenuConfig = {
  groups: [
    {
      group: "Overview",
      items: [
        { icon: LayoutDashboard, label: "Faculty Dashboard", path: "/faculty/dashboard" },
        { icon: BarChart3, label: "Teaching Load", path: "/faculty/load-report" },
        { icon: BookOpen, label: "Curriculum Planning", path: "/faculty/curriculum-planning" },
      ]
    },
    {
      group: "Student Management",
      items: [
        { icon: Users, label: "Student Directory", path: "/faculty/student-directory" },
        { icon: ShieldAlert, label: "Academic Advising", path: "/faculty/advising-portal" },
        { icon: FileText, label: "Grades & Records", path: "/faculty/grades-records" },
      ]
    },
    {
      group: "Professional Development",
      items: [
        { icon: AcademicCap, label: "Research Profile", path: "/faculty/research-profile" },
        { icon: Settings2, label: "Personal Profile", path: "/faculty/profile" },
      ]
    }
  ],
  showLogs: false, // Faculty typically doesn't need the general 'Audit Trail' link visible here
  roleKey: "faculty_admin"
};

// --- CONFIGURATION END ---

/** 
 * Component to render a sub-item in the logs section (kept for future flexibility)
 */
const LogSubItem = ({ icon: Icon, label, href }: any) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  const activeStyles = "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";

  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
      isActive ? activeStyles : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    )}>
      <Icon size={14} /> {label}
    </Link>
  );
};

export const FacultySidebar = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  // Replicating the state structure from AdminSidebar for consistency
  const [expanded, setExpanded] = useState(true); 
  const [logsOpen, setLogsOpen] = useState(false); // Disabled by default per blueprint

  const activeClass = "text-blue-600 dark:text-blue-400";
  const activeBg = "bg-blue-50 dark:bg-blue-900/20";
  const logoAccent = "bg-blue-600 dark:bg-blue-500";

  // NOTE: Since role logic was complex in AdminSidebar, I'm simplifying here to assume the user has 'faculty_admin' access if they use this sidebar.
  // In a full implementation, role checking would be re-applied here.

  return (
    <aside className={cn(
      "flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out h-screen z-40",
      expanded ? "w-64" : "w-20"
    )}>
      {/* --- HEADER (Branding and Toggle) --- */}
      <div className={cn("flex items-center p-4 h-[70px] border-b border-border", expanded ? "justify-between" : "justify-center")}>
        {expanded ? (
          <>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain shrink-0" />
              <h1 className="font-black text-[#050d36] dark:text-white tracking-tighter text-[15px] whitespace-nowrap uppercase leading-none mt-0.5">
                RESERVE<span className="text-blue-600 dark:text-blue-400">IT</span>
              </h1>
            </div>
            <button onClick={() => setExpanded(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hidden lg:block"><ChevronsLeft size={18} /></button>
          </>
          ) : (
            <button onClick={() => setExpanded(true)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent"><ChevronsRight size={20} /></button>
          )}
      </div>

      {/* --- NAVIGATION --- */}
      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
        {facultyMenuConfig.groups.map((group) => (
          <div key={group.group} className="space-y-2">
            {expanded && <p className="px-3 text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 opacity-50">{group.group}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link key={item.path} href={item.path} className={cn(
                    "flex items-center rounded-xl transition-all duration-200 group relative",
                    expanded ? "px-3 py-2.5 gap-3" : "p-3 justify-center",
                    isActive ? `${activeBg} ${activeClass}` : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}>
                    <item.icon size={20} className={cn(isActive ? activeClass : "group-hover:text-foreground")} />
                    {expanded && <span className="text-[11px] font-black uppercase tracking-tight">{item.label}</span>}
                  </Link>
                );
              })}
            </div >
          </div>
        ))}

        {/* Simplified/Removed the general Audit Trail section as per blueprint */}
      </nav>
    </aside>
  );
};