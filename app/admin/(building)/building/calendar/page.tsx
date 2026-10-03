'use client'

import React, { useState, useMemo, useCallback, Fragment, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, Clock, Plus,
  Calendar as CalendarIcon, MapPin, ListFilter,
  BookOpen, UserCheck, PartyPopper, Wrench, HelpCircle,
  FileSpreadsheet, Image as ImageIcon, Upload, Loader2, X,
  User, CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuildingCalendar } from "@/hooks/admin/building";
import { parseExcelRows } from '@/lib/excel';
import { toast } from "@/hooks/use-toast";

const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

export default function CalendarPageRoute() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>}>
      <CalendarPage />
    </Suspense>
  )
}

function CalendarPage() {
  const searchParams = useSearchParams();
  const today = new Date();
  
  // Calculate initial year range
  const currentYear = today.getFullYear();
  const ds = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const initialStart = ds(new Date(currentYear, 0, 1));
  const initialEnd = ds(new Date(currentYear, 11, 31));

  const { events, facilities, facilityFilter, setFacilityFilter, createEvent, loading, setMonthStart, setMonthEnd } = useBuildingCalendar(initialStart, initialEnd);

  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "week" | "day" | "year">("week");
  const [filter, setFilter] = useState("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    // Ponytail UX: Fetch the entire academic year instead of just the visible month.
    // This allows instant navigation between months without any network stutter,
    // since the data is already in memory.
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31); // Dec 31
    setMonthStart(ds(start));
    setMonthEnd(ds(end));
  }, [year, setMonthStart, setMonthEnd]);

  useEffect(() => {
    const fid = searchParams.get('facilityId');
    if (fid) setFacilityFilter(fid);
  }, [searchParams, setFacilityFilter]);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    startTime: "08:00",
    endTime: "09:00",
    type: "reservation" as any,
    facilityId: ""
  });

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const getDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const formatTime = (t: string | null | undefined) => {
    if (!t) return "—";
    const [h, m] = t.split(":").map(Number);
    return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  // --- REFINED THEME CONFIG ---
  const typeMapping: Record<string, string> = {
    "class_schedule": "class",
    "booking": "reservation",
    "paid_reservation": "paid_reservation",
    "maintenance": "maintenance",
    "pending_event": "pending_event",
    "awaiting_reschedule": "awaiting_reschedule",
  };

  const eventConfig: Record<string, { color: string; icon: any; label: string }> = {
    class: { color: "bg-sti-blue/10 text-sti-blue dark:bg-sti-blue/20 dark:text-blue-300", icon: BookOpen, label: "Class Schedule" },
    reservation: { color: "bg-slate-500/10 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300", icon: UserCheck, label: "Internal Reservation" },
    paid_reservation: { color: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", icon: CreditCard, label: "Paid Reservation" },
    event: { color: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", icon: PartyPopper, label: "School Event" },
    maintenance: { color: "bg-zinc-500/10 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300", icon: Wrench, label: "Maintenance" },
    pending_event: { color: "bg-blue-500/5 text-blue-700 dark:text-blue-300 border border-dashed border-sti-blue/30", icon: PartyPopper, label: "Pending Event" },
    awaiting_reschedule: { color: "bg-slate-500/5 text-slate-700 dark:text-slate-300 border border-dashed border-slate-500/30", icon: UserCheck, label: "Awaiting Reschedule" },
  };

  const fallbackConfig = { color: "bg-slate-500 text-white", icon: HelpCircle, label: "Other" };

  const getDisplayType = (apiType: string) => typeMapping[apiType] || apiType;

  const eventsByDate = useMemo(() => {
    const eventList = Array.isArray(events) ? events : [];
    const grouped = new Map<string, any[]>();
    
    for (const e of eventList) {
      const displayType = getDisplayType(e.type);
      if (filter === "all" || displayType === filter) {
        if (!grouped.has(e.date)) {
          grouped.set(e.date, []);
        }
        grouped.get(e.date)!.push(e);
      }
    }
    return grouped;
  }, [events, filter]);

  const getEventsForDate = useCallback((dateStr: string) => {
    return eventsByDate.get(dateStr) || [];
  }, [eventsByDate]);

  const prev = () => {
    if (view === "month") setCurrentDate(new Date(year, month - 1, 1));
    else if (view === "week") setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    else if (view === "day") setCurrentDate(new Date(currentDate.getTime() - 86400000));
    else setCurrentDate(new Date(year - 1, 0, 1));
  };

  const next = () => {
    if (view === "month") setCurrentDate(new Date(year, month + 1, 1));
    else if (view === "week") setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    else if (view === "day") setCurrentDate(new Date(currentDate.getTime() + 86400000));
    else setCurrentDate(new Date(year + 1, 0, 1));
  };

  const goToday = () => {
    const d = new Date();
    setCurrentDate(d);
    setSelectedDate(todayStr);
  };

  const handleAddEvent = async () => {
    const targetDate = newEvent.date || selectedDate || todayStr;
    if (!targetDate || !newEvent.title) {
      toast({ title: "Error", description: "Title and date are required", variant: "destructive" });
      return;
    }
    if (!newEvent.facilityId) {
      toast({ title: "Error", description: "Please select a facility for this event", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await createEvent({
        title: newEvent.title,
        date: targetDate,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        facilityId: newEvent.facilityId || undefined,
        type: newEvent.type
      });
      setAddDialogOpen(false);
      setNewEvent({ title: "", date: "", startTime: "08:00", endTime: "09:00", type: "reservation", facilityId: "" });
      toast({ title: "Success", description: "Event created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create event", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await parseExcelRows(file);

      let successCount = 0;
      for (const item of data as any[]) {
        try {
          await createEvent({
            title: item.Title || item.Event || "Bulk Event",
            date: item.Date || todayStr,
            startTime: item.StartTime || "08:00",
            endTime: item.EndTime || "17:00",
            facilityId: item.Facility || undefined,
          });
          successCount++;
        } catch (itemErr) {
          console.error('Error creating event from bulk upload:', itemErr);
        }
      }

      setBulkDialogOpen(false);
      toast({ title: "Success", description: `${successCount} of ${data.length} events uploaded successfully.` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to parse file. Ensure it matches the template.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const getHeaderLabel = () => {
    if (view === "month") return `${monthNames[month]} ${year}`;
    if (view === "year") return String(year);
    if (view === "day") return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (view === "week") {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
      }
      return `${monthNames[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    }
    return "WEEKLY VIEW";
  };

  // --- RENDERERS ---

  const monthView = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    
    for (let i = 0; i < firstDay; i++)
      cells.push(<div key={`empty-${i}`} className="min-h-[110px] border-r border-b border-border/40 bg-muted/5" />);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = getDateStr(year, month, d);
      const dayEvents = getEventsForDate(dateStr);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      cells.push(
        <div key={dateStr} onClick={() => setSelectedDate(dateStr)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDate(dateStr); } }}
          aria-label={`View schedule for ${dateStr}`}
          className={cn("min-h-[110px] p-2 border-r border-b border-border/40 hover:bg-primary/5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
            isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/30", isToday && "bg-primary/5")}>

          <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all",
            isToday ? "bg-sti-blue dark:bg-amber-500 text-white shadow-md scale-110" : "text-muted-foreground")}>
            {d}
          </span>

          <div className="mt-2 space-y-1">
            {dayEvents.slice(0, 3).map(ev => {
              const displayType = getDisplayType(ev.type);
              const config = eventConfig[displayType] || fallbackConfig;
              return (
                <div key={ev.id} className={cn("text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium", config.color)} title={`${ev.title}${ev.bookerName ? ` — ${ev.bookerName}` : ''}`}>
                  {ev.title}
                </div>
              );
            })}
            {dayEvents.length > 3 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); }}
                className="text-xs text-primary font-medium px-1 hover:underline block w-full text-left"
              >
                + {dayEvents.length - 3} more
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-7 border-t border-l border-border/40">
        {dayNames.map(d => <div key={d} className="p-3 text-[10px] font-black text-muted-foreground border-r border-b border-border/40 bg-muted/20 text-center uppercase tracking-widest">{d}</div>)}
        {cells}
      </div>
    );
  }, [year, month, selectedDate, todayStr, eventsByDate, getEventsForDate]);

  const dayView = useMemo(() => {
    const dateStr = getDateStr(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const dayEvents = getEventsForDate(dateStr);
    return (
      <div className="overflow-auto max-h-[600px]">
        <div className="grid grid-cols-[80px_1fr] border-t border-l border-border/40">
          {HOURS.map(h => {
            const hourEvents = dayEvents.filter(e => e.startTime && parseInt(e.startTime.split(":")[0]) === h);
            return (
              <Fragment key={h}>
                <div className="border-r border-b border-border/40 p-4 text-xs font-medium text-muted-foreground text-right bg-muted/10">{h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}</div>
                <div className="border-b border-border/40 min-h-[80px] p-2 relative">
                  {hourEvents.map(ev => {
                    const displayType = getDisplayType(ev.type);
                    const config = eventConfig[displayType] || fallbackConfig;
                    const Icon = config.icon;
                    return (
                      <div key={ev.id} className={cn("text-xs p-2.5 rounded-lg mb-2 font-medium", config.color)}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{ev.title}</span>
                          </div>
                          <span className="opacity-80 text-[10px] font-medium whitespace-nowrap">{formatTime(ev.startTime)} - {formatTime(ev.endTime)}</span>
                        </div>
                        {ev.bookerName && (
                          <div className="flex items-center gap-1.5 mt-1 opacity-75">
                            <User className="w-3 h-3" />
                            <span className="text-[11px]">{ev.bookerName}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  }, [currentDate, eventsByDate, getEventsForDate]);

  const weekView = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });

    return (
      <div className="overflow-auto max-h-[600px] w-full">
        {/* Header row */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(120px,1fr))] border-t border-l border-border/40 min-w-[900px]">
          <div className="border-r border-b border-border/40 bg-muted/20" />
          {weekDates.map(d => {
            const dateStr = getDateStr(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className="p-3 border-r border-b border-border/40 bg-muted/20 text-center flex flex-col items-center justify-center gap-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{dayNames[d.getDay()]}</span>
                <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all", isToday ? "bg-sti-blue dark:bg-amber-500 text-white shadow-md scale-110" : "text-foreground")}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body rows */}
        <div className="min-w-[900px]">
          {HOURS.map(h => (
            <div key={h} className="grid grid-cols-[60px_repeat(7,minmax(120px,1fr))] border-l border-border/40">
              <div className="border-r border-b border-border/40 p-2 text-xs font-medium text-muted-foreground text-center bg-muted/10 flex items-center justify-center">
                {h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}
              </div>
              {weekDates.map(d => {
                const dateStr = getDateStr(d.getFullYear(), d.getMonth(), d.getDate());
                const dayEvents = getEventsForDate(dateStr).filter(e => e.startTime && parseInt(e.startTime.split(":")[0]) === h);
                return (
                  <div key={dateStr}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDate(dateStr); } }}
                    aria-label={`View schedule for ${dateStr}`}
                    className="border-r border-b border-border/40 min-h-[90px] p-1.5 relative group hover:bg-muted/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    onClick={() => setSelectedDate(dateStr)}>
                    {dayEvents.map(ev => {
                      const displayType = getDisplayType(ev.type);
                      const config = eventConfig[displayType] || fallbackConfig;
                      const Icon = config.icon;
                      return (
                        <div key={ev.id} className={cn("text-[10px] p-1.5 rounded-md mb-1.5 font-medium flex flex-col gap-0.5 shadow-xs", config.color)} title={`${ev.title}${ev.bookerName ? ` — ${ev.bookerName}` : ''}`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{ev.title}</span>
                          </div>
                          {ev.bookerName && (
                            <div className="flex items-center gap-1 truncate opacity-75">
                              <User className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{ev.bookerName}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }, [currentDate, eventsByDate, getEventsForDate, todayStr]);

  const yearView = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 p-8 border-t border-border/40">
      {Array.from({ length: 12 }, (_, mi) => {
        const dim = new Date(year, mi + 1, 0).getDate();
        const fd = new Date(year, mi, 1).getDay();
        return (
          <div key={mi} className="space-y-3">
            <h4 className="font-semibold text-xs text-accent-brand uppercase tracking-wide border-b border-border/40 pb-2">{monthNames[mi]}</h4>
            <div className="grid grid-cols-7 gap-1 text-[10px] font-medium text-muted-foreground/60">
              {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-center">{d}</div>)}
              {Array.from({ length: fd }, (_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: dim }, (_, i) => {
                const ds = getDateStr(year, mi, i + 1);
                const hasE = (events || []).some(e => (e.date) === ds);
                return <div key={ds} className={cn("text-center py-1 rounded-sm transition-colors", ds === todayStr ? "bg-sti-blue dark:bg-amber-500 text-white" : hasE ? "text-accent-brand font-semibold" : "")}>{i + 1}</div>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  ), [year, events, todayStr]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* HEADER */}
      <div className="px-1 flex items-center justify-between flex-wrap gap-4 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Schedule <span className="text-accent-brand">Calendar</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
            Centralized schedule synchronization &amp; room timeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setBulkDialogOpen(true)} variant="outline" className="border-dashed font-semibold text-xs h-10 px-6 rounded-xl shadow-sm">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Bulk Events
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="bg-sti-blue hover:bg-sti-blue-dark dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-sti-navy font-semibold text-xs h-10 px-6 rounded-xl shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Create Event
          </Button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
                <ListFilter className="w-3 h-3 text-primary" />
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{view.toUpperCase()} VIEW</p>
            </div>
            <div className="flex items-center bg-card border border-border/60 rounded-xl p-1 shadow-sm">
                <Button variant="ghost" size="icon" onClick={prev} className="h-10 w-10"><ChevronLeft className="w-4 h-4 text-primary" /></Button>
                <span className="text-xs font-semibold px-4 min-w-[140px] text-center">{getHeaderLabel()}</span>
                <Button variant="ghost" size="icon" onClick={next} className="h-10 w-10"><ChevronRight className="w-4 h-4 text-primary" /></Button>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="flex flex-1 gap-1.5 p-1.5 bg-card border border-border/60 rounded-xl w-full shadow-sm">
            {[
              { label: "All", v: "all" },
              { label: "Published (Classes)", v: "class" },
              { label: "Internal Bookings", v: "reservation" },
              { label: "Paid Reservations", v: "paid_reservation" },
              { label: "School Events", v: "event" },
              { label: "Maintenance", v: "maintenance" }
            ].map(tab => (
                <button key={tab.v} onClick={() => setFilter(tab.v)}
                  className={cn("flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                    filter === tab.v ? "bg-slate-800 text-white shadow-md" : "text-muted-foreground hover:bg-muted")}>
                  {tab.label}
                </button>
            ))}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Select value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectTrigger className="w-full md:w-44 h-10 rounded-xl font-medium text-xs border border-border/60 bg-card px-4">
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-medium">All Facilities</SelectItem>
                {facilities?.map(f => (
                  <SelectItem key={f.id} value={f.id} className="font-medium">{f.roomNumber} - {f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={view} onValueChange={v => setView(v as any)}>
              <SelectTrigger className="w-full md:w-32 h-10 rounded-xl font-medium text-xs border border-border/60 bg-card px-4"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="day" className="font-medium">Day</SelectItem>
                <SelectItem value="week" className="font-medium">Week</SelectItem>
                <SelectItem value="month" className="font-medium">Month</SelectItem>
                <SelectItem value="year" className="font-medium">Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={goToday} className="h-10 px-6 rounded-xl font-medium text-xs border border-border/60 bg-card">Today</Button>
          </div>
        </div>
      </div>

      {/* CALENDAR BODY */}
      <Card className="border-border/50 bg-card rounded-xl overflow-hidden shadow-sm">
        {view === "month" && monthView}
        {view === "day" && dayView}
        {view === "year" && yearView}
        {view === "week" && weekView}
      </Card>

      {/* SELECTED DATE DETAILS - SHEET DRAWER */}
      <Sheet open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><CalendarIcon className="w-5 h-5 text-primary" /></div>
              <span className="font-black uppercase tracking-tighter text-xl text-sti-navy dark:text-white">
                {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ""}
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-5">
            {!selectedDate || getEventsForDate(selectedDate).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground font-medium text-xs border border-dashed border-border/40 rounded-xl">No schedules.</div>
            ) : getEventsForDate(selectedDate).map(ev => {
              const displayType = getDisplayType(ev.type);
              const config = eventConfig[displayType] || fallbackConfig;
              const Icon = config.icon;
              const bookingTypeLabel = ev.bookingType === 'external_paid' ? 'External (Paid)' : ev.bookingType === 'internal_paid' ? 'Internal (Paid)' : ev.bookingType === 'internal_free' ? 'Internal (Free)' : null;
              const bookingTypeColor = ev.bookingType === 'external_paid' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ev.bookingType === 'internal_paid' ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
              return (
                <div key={ev.id} className="flex flex-col p-6 rounded-xl bg-card border border-border/40 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{config.label}</span>
                    {bookingTypeLabel && (
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", bookingTypeColor)}>{bookingTypeLabel}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-sti-navy dark:text-white leading-relaxed mb-4">{ev.title}</p>
                  <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border/40">
                    {ev.bookerName && (
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><User className="w-3.5 h-3.5 text-primary" /> {ev.bookerName}</div>
                    )}
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock className="w-3.5 h-3.5 text-primary" /> {formatTime(ev.startTime)} - {formatTime(ev.endTime)}</div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><MapPin className="w-3.5 h-3.5 text-primary" /> {ev.facilityName || "N/A"}</div>
                    {ev.status && (
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                        <span className="capitalize">{ev.status.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* CREATE MODAL */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-xl p-8 bg-card border-none max-w-md shadow-xl">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">New Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="calendar-event-title" className="text-xs font-semibold uppercase text-muted-foreground">Title</Label>
              <Input id="calendar-event-title" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs" disabled={isSubmitting} placeholder="Event or Class title" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="calendar-event-date" className="text-xs font-semibold uppercase text-muted-foreground">Date</Label>
              <Input id="calendar-event-date" type="date" value={newEvent.date || selectedDate || todayStr} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs" disabled={isSubmitting} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <Label htmlFor="calendar-event-start" className="text-xs font-semibold uppercase text-muted-foreground">Start</Label>
                 <Input id="calendar-event-start" type="time" value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs" disabled={isSubmitting} />
               </div>
               <div className="space-y-1">
                 <Label htmlFor="calendar-event-end" className="text-xs font-semibold uppercase text-muted-foreground">End</Label>
                 <Input id="calendar-event-end" type="time" value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs" disabled={isSubmitting} />
               </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="calendar-event-type" className="text-xs font-semibold uppercase text-muted-foreground">Type</Label>
              <Select value={newEvent.type} onValueChange={v => setNewEvent({ ...newEvent, type: v })} disabled={isSubmitting}>
                <SelectTrigger id="calendar-event-type" className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="class" className="text-xs font-medium">Class Schedule</SelectItem>
                  <SelectItem value="reservation" className="text-xs font-medium">Reservation</SelectItem>
                  <SelectItem value="event" className="text-xs font-medium">School Event</SelectItem>
                  <SelectItem value="maintenance" className="text-xs font-medium">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="calendar-event-facility" className="text-xs font-semibold uppercase text-muted-foreground">Facility</Label>
              <Select value={newEvent.facilityId} onValueChange={v => setNewEvent({ ...newEvent, facilityId: v })} disabled={isSubmitting}>
                <SelectTrigger id="calendar-event-facility" className="h-10 rounded-xl bg-muted/30 border-none font-medium text-xs"><SelectValue placeholder="Assign Room" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="" className="text-xs font-medium">None</SelectItem>
                  {facilities?.map(f => <SelectItem key={f.id} value={f.id} className="text-xs font-medium">{f.name || f.roomNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddEvent} disabled={isSubmitting} className="w-full bg-primary h-10 rounded-xl font-semibold text-xs">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Publish Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK UPLOAD MODAL */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="rounded-xl p-8 bg-card border-none max-w-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-sti-blue">Bulk Schedule Synchronization</DialogTitle>
            <p className="text-xs font-medium text-muted-foreground">Import events via Excel spreadsheets or Image OCR</p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
            {/* EXCEL UPLOAD */}
            <div className="flex flex-col p-6 rounded-xl bg-muted/30 border-2 border-dashed border-border/60 hover:border-sti-blue/40 transition-all group relative">
              <div className="p-3 bg-emerald-500/10 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-black uppercase text-sm mb-2">Excel Import</h3>
              <p className="text-xs text-muted-foreground font-medium mb-6 leading-relaxed">
                Upload .xlsx or .csv files. Use columns: <span className="text-emerald-600 font-bold">Title, Date (YYYY-MM-DD), StartTime, EndTime, Type, Facility</span>.
              </p>
              <div className="mt-auto">
                <input type="file" id="excel-upload" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 rounded-xl font-semibold text-xs">
                  <label htmlFor="excel-upload" className="cursor-pointer flex items-center justify-center gap-2">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Choose File
                  </label>
                </Button>
              </div>
            </div>

            {/* IMAGE/OCR UPLOAD */}
            <div className="flex flex-col p-6 rounded-xl bg-slate-50 dark:bg-muted/30 border-2 border-dashed border-slate-200 dark:border-border/60 hover:border-blue-500/40 transition-all group relative">
              <div className="p-3 bg-blue-500/10 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-black uppercase text-sm mb-2">Image Recognition</h3>
              <p className="text-xs text-muted-foreground font-medium mb-6 leading-relaxed">
                Upload screenshots or photos of physical schedules. Our <span className="text-blue-600 font-bold">AI OCR</span> will extract events automatically.
              </p>
              <div className="mt-auto">
                <input type="file" id="image-upload" className="hidden" accept="image/*" disabled aria-disabled="true" />
                <Button asChild disabled aria-disabled="true" className="w-full bg-blue-600 hover:bg-blue-700 h-10 rounded-xl font-semibold text-xs opacity-80 cursor-not-allowed pointer-events-none">
                  <label htmlFor="image-upload" aria-disabled="true" className="flex items-center justify-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    OCR Disabled
                  </label>
                </Button>
              </div>
              <div className="absolute top-4 right-4 bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 text-[10px] font-bold px-2 py-0.5 rounded-full">BETA</div>
            </div>
          </div>

          <div className="bg-sti-blue/10 dark:bg-amber-500/10 p-4 rounded-xl border border-sti-blue/20 dark:border-amber-500/20">
            <p className="text-xs font-semibold text-accent-brand text-center">
              Warning: Bulk events will override any existing conflicting reservations for the specified facilities and times.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}