'use client'

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Download,
  CalendarDays,
  Clock,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Loader2
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import { FacilityHeatmap } from "@/components/admin/dashboard/FacilityHeatmap";
import { DepartmentDistributionChart } from "@/components/admin/dashboard/DepartmentDistributionChart";
import { YieldAnalyzerChart } from "@/components/admin/dashboard/YieldAnalyzerChart";
import { ForecastLineChart } from "@/components/admin/dashboard/ForecastLineChart";
import { MaintenanceGauge } from "@/components/admin/dashboard/MaintenanceGauge";
import { InsightsFeedPanel } from "@/components/admin/dashboard/InsightsFeedPanel";
import { toast } from "@/hooks/use-toast";
import { useBuildingReports } from "@/hooks/admin/building";

const Reports = () => {
  const { stats, chartData, analytics, loading } = useBuildingReports();

  // --- STYLING CONFIGS (RETAINED) ---
  const customTooltipStyle = {
    backgroundColor: "var(--card)",
    backdropFilter: "blur(12px)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "12px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  };

  const labelStyle = {
    color: "var(--foreground)",
    fontWeight: "700",
    fontSize: "11px",
    marginBottom: "4px",
  };

  const renderColorfulLegendText = (value: string) => (
    <span className="text-foreground font-medium text-xs ml-1">
      {value}
    </span>
  );

  // --- DATA FROM HOOK ---
  const bookingTrends = chartData?.bookingTrends || [];
  const revenueTrends = chartData?.revenueTrends || [];
  const peakHours = chartData?.peakHours || [];
  const facilityUtilization = chartData?.facilityUtilization || [];
  const facilityTypes = chartData?.facilityTypes || [];
  const bookingTypeDistribution = chartData?.bookingTypeDistribution || [];

  const hasBookings = stats.totalBookings > 0;
  const completionData = [
    { name: "Completion Rate", value: stats.completionRate, color: "var(--sti-blue)" },
    { name: "Pending", value: hasBookings ? Math.max(0, 100 - stats.completionRate) : 0, color: "var(--destructive)" }
  ];

  const statusDistribution = [
    { name: "Available", value: Math.round(100 - stats.avgUtilization) },
    { name: "Occupied", value: stats.avgUtilization },
    { name: "Maintenance", value: 0 }
  ];

  const getStatusColor = (name: string) => {
    switch (name) {
      case "Available": return "#22c55e";
      case "Occupied": return "var(--destructive)";
      case "Maintenance": return "#eab308";
      default: return "#6366f1";
    }
  };

  const ASSET_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#06b6d4", "#f97316", "#14b8a6"];

  const handleExportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push("Metric,Value");
    lines.push(`${esc("Avg Utilization (%)")},${esc(stats.avgUtilization)}`);
    lines.push(`${esc("Completion Rate (%)")},${esc(stats.completionRate)}`);
    lines.push(`${esc("Total Bookings")},${esc(stats.totalBookings)}`);
    lines.push(`${esc("Total Revenue (PHP)")},${esc(stats.totalRevenue)}`);
    if (facilityUtilization.length) {
      lines.push("");
      lines.push("Facility,Bookings");
      facilityUtilization.forEach((f: { name: string; bookings: number }) => lines.push(`${esc(f.name)},${esc(f.bookings)}`));
    }
    if (bookingTrends.length) {
      lines.push("");
      lines.push("Period,Internal,External,Total");
      bookingTrends.forEach((t: { name: string; internal: number; external: number; total: number }) =>
        lines.push(`${esc(t.name)},${esc(t.internal)},${esc(t.external)},${esc(t.total)}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reserveit-system-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported", description: "CSV downloaded successfully" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 p-2 lg:p-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            System <span className="text-accent-brand">Analytics</span>
          </h1>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Admin & Academic Head Oversight Console
          </p>
        </div>
        <Button
          className="bg-sti-navy dark:bg-sti-blue font-semibold text-xs h-10 px-6 rounded-xl shadow-lg text-white hover:opacity-90"
          onClick={handleExportCsv}
          disabled={loading}
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV Data
        </Button>
      </div>

      {/* NEW STATS CARDS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-card rounded-2xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Avg Utilization" value={`${stats.avgUtilization}%`} icon={Activity} variant="primary" subtitle="All Facilities" />
          <StatsCard title="Completion Rate" value={`${stats.completionRate}%`} icon={CheckCircle2} variant="success" subtitle="Fulfilled Bookings" />
          <StatsCard title="Total Volume" value={String(stats.totalBookings)} icon={CalendarDays} variant="warning" subtitle="System Load" />
          <StatsCard title="Total Revenue" value={`₱${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} variant="primary" subtitle="All Payments" />
        </div>
      )}

      {/* ADVANCED ANALYTICS SUITE — Phases 1-4 */}
      {!loading && analytics && (
        <>
          {/* Phase 4: Prescriptive insights surfaced first */}
          <InsightsFeedPanel data={analytics.insights} />

          {/* Phase 3.1: Capacity forecast at top for trajectory awareness */}
          <ForecastLineChart data={analytics.forecast} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Phase 1.1: Heatmap */}
            <FacilityHeatmap data={analytics.heatmap} />
            {/* Phase 1.2: Departmental donut */}
            <DepartmentDistributionChart data={analytics.departmental} />
          </div>

          {/* Phase 2: Yield analyzer */}
          <YieldAnalyzerChart data={analytics.yield} />

          {/* Phase 3.2: Maintenance gauges */}
          <MaintenanceGauge data={analytics.maintenance} />
        </>
      )}

      {/* NEW GRAPH FOR WORKLOAD AND CONFLICTS */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          <Card className="p-8 rounded-xl border-border bg-card/50 dark:bg-sti-navy/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sti-blue" />
                <h3 className="text-sm font-semibold text-foreground">Completion Rate Overview</h3>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sti-blue" /><span className="text-xs font-medium text-muted-foreground">Completed</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /><span className="text-xs font-medium text-muted-foreground">Pending</span></div>
              </div>
            </div>
            <div className="h-[200px] w-full">
              {hasBookings ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }} />
                    <YAxis hide />
                    <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
                      {completionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground font-black text-sm uppercase">No booking data</div>
              )}
            </div>
            <p className="text-xs font-medium text-center text-muted-foreground mt-4">Booking completion tracking across the system</p>
          </Card>
        </div>
      )}

      {/* Trends */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6">
          <Card className="p-8 rounded-xl border-border bg-card/50 dark:bg-sti-navy/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-8">
              <TrendingUp className="w-4 h-4 text-accent-brand" />
              <h3 className="text-sm font-semibold text-foreground">Booking Volume Trends</h3>
            </div>
            <div className="h-[300px] w-full">
              {bookingTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bookingTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }} />
                    <Tooltip contentStyle={customTooltipStyle} labelStyle={labelStyle} />
                    <Legend verticalAlign="top" align="right" formatter={renderColorfulLegendText} />
                    <Line type="monotone" dataKey="internal" name="Internal" stroke="var(--sti-blue)" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="external" name="External" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="total" name="Total Volume" stroke="var(--accent-light)" strokeWidth={4} dot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground font-black text-sm uppercase">No booking data</div>
              )}
            </div>
          </Card>

          <Card className="p-8 rounded-xl border-border bg-card/50 dark:bg-sti-navy/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-8">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Revenue Collection Trends</h3>
            </div>
            <div className="h-[300px] w-full">
              {revenueTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }} />
                    <Tooltip contentStyle={customTooltipStyle} labelStyle={labelStyle} />
                    <Legend verticalAlign="top" align="right" formatter={renderColorfulLegendText} />
                    <Line type="monotone" dataKey="revenue" name="Revenue (₱)" stroke="#22c55e" strokeWidth={4} dot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground font-black text-sm uppercase">No revenue data</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Distribution Section */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-8 rounded-xl border-border bg-card/50 dark:bg-sti-navy/20 backdrop-blur-md shadow-lg flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-6 self-start text-foreground">Room Availability</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" stroke="none">
                  {statusDistribution.map((entry, i) => <Cell key={i} fill={getStatusColor(entry.name)} />)}
                </Pie>
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend verticalAlign="bottom" formatter={renderColorfulLegendText} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-8 rounded-xl border-border bg-card/50 dark:bg-sti-navy/20 backdrop-blur-md shadow-lg flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-6 self-start text-foreground">Asset Distribution</h3>
            {facilityTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={facilityTypes} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" stroke="none">
                    {facilityTypes.map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend verticalAlign="bottom" formatter={renderColorfulLegendText} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground font-black text-sm uppercase">No facility types</div>
            )}
          </Card>

          <Card className="p-8 rounded-xl border-border bg-card/50 dark:bg-sti-navy/20 backdrop-blur-md shadow-lg flex flex-col items-center">
            <h3 className="text-sm font-semibold mb-6 self-start text-foreground">User Segments</h3>
            {bookingTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={bookingTypeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" stroke="none">
                    <Cell fill="var(--sti-blue)" />
                    <Cell fill="var(--accent-light)" />
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend verticalAlign="bottom" formatter={renderColorfulLegendText} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground font-black text-sm uppercase">No booking data</div>
            )}
          </Card>
        </div>
      )}

      {/* Usage Analytics Section */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-8 rounded-xl border-border bg-card/40 dark:bg-sti-navy/10 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-4 h-4 text-accent-brand" />
              <h3 className="text-sm font-semibold text-foreground">Peak Usage Hours</h3>
            </div>
            {peakHours.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: "currentColor" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: "currentColor" }} />
                  <Tooltip cursor={{ fill: 'var(--foreground)', fillOpacity: 0.05 }} contentStyle={customTooltipStyle} labelStyle={labelStyle} />
                  <Bar dataKey="usage" name="Activity" fill="currentColor" className="text-accent-brand" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground font-black text-sm uppercase">No usage data</div>
            )}
          </Card>

          <Card className="p-8 rounded-xl border-border bg-card/40 dark:bg-sti-navy/10 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-4 h-4 text-accent-brand" />
              <h3 className="text-sm font-semibold text-foreground">Most Utilized Facilities</h3>
            </div>
            {facilityUtilization.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={facilityUtilization} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 900, fill: "currentColor" }}
                    width={110}
                  />
                  <Tooltip cursor={{ fill: 'var(--foreground)', fillOpacity: 0.05 }} contentStyle={customTooltipStyle} labelStyle={labelStyle} />
                  <Bar dataKey="bookings" fill="var(--sti-blue)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground font-black text-sm uppercase">No facility data</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Reports;