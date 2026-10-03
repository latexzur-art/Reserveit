'use client'

import React from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { useUI } from "@/contexts/UIContext";
import { cn } from "@/lib/utils";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { textSizeEnlarged } = useUI();

  return (
    <div
      className={cn(
        "flex h-screen w-full bg-[#f8fafc] dark:bg-[#0D0F12] overflow-hidden font-sans transition-all duration-200",
        textSizeEnlarged && "text-enlarged"
      )}
    >
      {/* Background radial glow for Dark Mode depth */}
      <div className="fixed inset-0 z-[-1] pointer-events-none opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,114,188,0.04),transparent_50%)]" />

      {/* Sidebar - Desktop */}
      <AdminSidebar />

      {/* Main Content Wrapper */}
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        
        {/* Header containing Profile/Actions */}
        <AdminHeader />

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/50 dark:bg-transparent">
          <div className="max-w-[1600px] mx-auto p-4 sm:p-8 lg:p-12">
            {children}
            {/* Spacer to prevent fixed floating actions from overlapping bottom content */}
            <div className="h-24 shrink-0" aria-hidden="true" />
          </div>
        </main>
      </div>
    </div>
  );
};