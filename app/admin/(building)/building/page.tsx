'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useDataStore } from "@/lib/data-store";

// Components
import { TotalBookingsToday } from "@/components/admin/dashboard/TotalBookingsToday";
import { PendingApprovals } from "@/components/admin/dashboard/PendingApprovals";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import { UpcomingMaintenance } from "@/components/admin/dashboard/UpcomingMaintenance";
import { FacilityStatusOverview } from "@/components/admin/dashboard/FacilityStatusOverview";
import { WeeklyUtilization } from "@/components/admin/dashboard/WeeklyUtilization";
import { MiniCalendar } from "@/components/admin/dashboard/MiniCalendar";
import { ClassSchedulesToday } from "@/components/admin/dashboard/ClassSchedulesToday";
import { LiveClock } from "@/components/admin/dashboard/LiveClock";

// Icons
import { Building2, CalendarDays, TrendingUp, Users, CreditCard, Activity } from "lucide-react";
import { ROUTES } from '@/lib/routes'

import { SkeletonLoader } from "@/components/layout/admin/SkeletonLoader";

export default function BuildingPage() {
  const { facilities, bookings, calendarEvents, transactions, syncWithSupabase, loading } = useDataStore();

  // 1. Initial Sync
  useEffect(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);

  // --- DEFENSIVE DATA HANDLING ---
  // Hooks must run unconditionally on every render, so these stay above the
  // loading early-return below (see Rules of Hooks).
  const safeFacilities = useMemo(() => Array.isArray(facilities) ? facilities : [], [facilities]);
  const safeBookings = useMemo(() => Array.isArray(bookings) ? bookings : [], [bookings]);
  const safeEvents = useMemo(() => Array.isArray(calendarEvents) ? calendarEvents : [], [calendarEvents]);
  const safeTransactions = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);

  if (loading) {
    return <SkeletonLoader />;
  }

  const activeFacilities = safeFacilities.filter(f => !f.deleted);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 2. ADVANCED AVAILABILITY LOGIC
  const trulyAvailableRooms = activeFacilities.filter(facility => {
    // Check for active Reservations
    const hasActiveBooking = safeBookings.some(booking => {
      if (!booking?.date || !booking?.startTime) return false;
      const start = new Date(`${booking.date}T${booking.startTime}`);
      const end = new Date(`${booking.date}T${booking.endTime}`);
      return (
        booking.facility === facility.roomNumber && 
        now >= start && 
        now <= end && 
        (booking.status === "approved" || booking.status === "auto_approved")
      );
    });

    // Check for active Class Schedules
    const hasActiveClass = safeEvents.some(event => {
      if (!event?.date || !event?.startTime) return false;
      const start = new Date(`${event.date}T${event.startTime}`);
      const end = new Date(`${event.date}T${event.endTime}`);
      return (
        event.facility === facility.roomNumber && 
        event.type === "class" && 
        now >= start && 
        now <= end
      );
    });

    return !hasActiveBooking && !hasActiveClass && facility.status === "Available";
  }).length;

  // 3. INTEGRATED STATS CALCULATION
  const bookingsTodayCount = safeBookings.filter(b => b.date === todayStr).length;
  const classesTodayCount = safeEvents.filter(e => e.date === todayStr && e.type === "class").length;
  
  const failedPayments = safeTransactions.filter(t => t.status === "Failed").length;

  const occupiedCount = activeFacilities.length - trulyAvailableRooms;
  const utilizationRate = activeFacilities.length > 0 
    ? Math.round((occupiedCount / activeFacilities.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Brand Header & Live Date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Management <span className="text-accent-brand">Console</span></h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Facility Oversight &amp; Resource Analytics — STI College Lucena
          </p>
        </div>

        <LiveClock />
      </div>

      {/* Analytics Overviews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Live Availability" 
          value={String(trulyAvailableRooms)} 
          subtitle={`of ${activeFacilities.length} rooms free`} 
          icon={Building2} 
          variant="primary" 
          href={ROUTES.buildingAdmin.roomAvailability} 
        />
        <StatsCard 
          title="Total Activity" 
          value={String(bookingsTodayCount + classesTodayCount)} 
          subtitle={`${classesTodayCount} Classes | ${bookingsTodayCount} Res`} 
          icon={Activity} 
          variant="success" 
          href={ROUTES.buildingAdmin.reservations}
        />
        <StatsCard 
          title="Utilization Rate" 
          value={`${utilizationRate}%`} 
          subtitle="Real-time occupancy" 
          icon={TrendingUp} 
          variant="warning" 
          href={ROUTES.buildingAdmin.reports}
        />
        <StatsCard 
          title="Revenue Alert" 
          value={String(failedPayments)} 
          subtitle={failedPayments > 0 ? "Failed External Payments" : "Payments Synced"} 
          icon={CreditCard} 
          variant={failedPayments > 0 ? "destructive" : "default"}
          href={ROUTES.buildingAdmin.paymentLogs}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PendingApprovals />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UpcomingMaintenance />
            <FacilityStatusOverview />
          </div>
          <WeeklyUtilization />
        </div>
        <div className="space-y-6">
          <TotalBookingsToday />
          <ClassSchedulesToday />
          <MiniCalendar />
        </div>
      </div>
    </div>
  );
}