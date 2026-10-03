"use client"

import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import {
  Building2, Users, Search, MapPin, Clock, ArrowLeft,
  CheckCircle2, Wrench, ChevronDown, ChevronUp, CalendarDays,
  Layers, X, ChevronRight, Monitor, LayoutGrid, List, CreditCard
} from "lucide-react";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import { cn } from "@/lib/utils";

// Components & Store
import { useDataStore, FLOORS, Facility, Booking, ClassSchedule } from "@/lib/data-store";
import { ReservationForm } from "@/components/layout/shared/ReservationForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from '@/lib/routes'
import { getMergedActivity, MergedActivity } from "@/hooks/admin/useAvailabilityGrid";
import { RoomInfoCard } from "./_components/RoomInfoCard";
import { AvailabilityGrid } from "./_components/AvailabilityGrid";

const ACTIVITY_CONFIG = {
  class: { color: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-500/10", label: "Published Schedule" },
  booking: { color: "bg-[#0072bc]", text: "text-[#0072bc]", light: "bg-[#0072bc]/10", label: "Reserved Room" },
  maintenance: { color: "bg-amber-500", text: "text-amber-600", light: "bg-amber-500/10", label: "Maintenance" },
  hold: { color: "bg-slate-500", text: "text-slate-600", light: "bg-slate-500/10", label: "Admin Block" },
};

const TYPES = ["Classroom", "Laboratory", "Multi-Purpose Hall", "Gymnasium", "Library", "Specialty"];

export default function RoomAvailabilityPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list" | "stack" | "cards">("list");
  const { facilities, bookings, classSchedules, maintenance, loading } = useDataStore();

  // --- STATE ---
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Facility | null>(null);
  const [roomEquipment, setRoomEquipment] = useState<any[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const [modalTab, setModalTab] = useState("today");

  // --- AVAILABILITY STATE ---
  const [blockedRanges, setBlockedRanges] = useState<{ start: string; end: string; reason?: string }[]>([])

  // --- FORM STATE ---
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    purpose: "",
    eventName: "",
    dateOfEvent: "",
    timeStart: "",
    timeEnd: "",
    attendees: "",
    facility: "",
    agreeTerms: false,
    period: "AM",
    hours: "1",
    useSoundSystem: false,
    useLED: false,
    org: "",
    contact: "",
    address: "",
    dateRequested: "",
    isRecurring: false,
    broughtEquipment: "",
    needPersonnel: false,
    department: "",
    dateOfRequest: new Date().toISOString().split('T')[0],
    equipmentNeeded: "",
    equipmentQty: "0"
  });

  // Fetch availability when room + form date changes
  useEffect(() => {
    const isGym = selectedRoom?.roomNumber === "GYM"
    const date = isGym ? formState.dateRequested : formState.dateOfEvent
    if (!selectedRoom?.id || !date) { setBlockedRanges([]); return }
    fetch(`/api/facilities/${selectedRoom.id}/availability?date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBlockedRanges(d?.blocked_ranges ?? []))
      .catch(() => setBlockedRanges([]))
  }, [selectedRoom?.id, selectedRoom?.roomNumber, formState.dateOfEvent, formState.dateRequested])

  // --- LOGIC HELPERS ---
  const getActivity = (room: Facility, targetDate: string): MergedActivity[] =>
    getMergedActivity(room, targetDate, { bookings, classSchedules, maintenance });

  // --- FILTER LOGIC ---
  const filtered = useMemo(() => {
    const baseRooms = (facilities || [])
      .filter((r: Facility) => {
        const name = r.name?.toLowerCase() || "";
        const type = r.type?.toLowerCase() || "";
        return name !== "conference room" && type !== "conference room";
      });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return baseRooms.filter((r: Facility) => {
      const dailyActivity = getActivity(r, todayStr);
      const currentStatus = r.status?.toLowerCase() || "";
      const isCurrentlyOccupied = currentStatus === "occupied" || dailyActivity.some(act => {
        if (!act.date || !act.startTime || !act.endTime) return false;
        const start = new Date(`${act.date}T${act.startTime}`);
        const end = new Date(`${act.date}T${act.endTime}`);
        return now >= start && now <= end;
      });
      
      const matchesSearch = search === "" || 
        (r.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (r.roomNumber?.toLowerCase() || "").includes(search.toLowerCase());

      const matchesFloor = floorFilter === "all" || r.floor === floorFilter;
      const matchesType = typeFilter === "all" || (r.type || "").includes(typeFilter);
      
      let matchesStatus = statusFilter === "all";
      if (statusFilter === "Available") {
        matchesStatus = !isCurrentlyOccupied && currentStatus === "available";
      } else if (statusFilter === "Occupied") {
        matchesStatus = isCurrentlyOccupied;
      } else if (statusFilter === "Maintenance") {
        matchesStatus = currentStatus === "maintenance";
      }

      return matchesSearch && matchesFloor && matchesType && matchesStatus;
    });
  }, [facilities, search, floorFilter, typeFilter, statusFilter, bookings, classSchedules, maintenance]);

  const handleBookNow = (room: Facility) => {
    router.push(`${ROUTES.buildingAdmin.reserve}?facility_id=${room.id}&facility_name=${encodeURIComponent(room.name ?? room.roomNumber)}&locked=1`);
  };

  const handleRoomClick = (room: Facility) => {
    setSelectedRoom(room);
    setModalTab("today");
    setShowScheduleModal(true);
  };

  React.useEffect(() => {
    if (selectedRoom) {
      const fetchEquipment = async () => {
        try {
          const res = await fetch(`/api/admin/building/facilities/${selectedRoom.id}/equipment`);
          const data = await res.json();
          setRoomEquipment(data.equipment || []);
        } catch (err) {
          console.error("Failed to fetch room equipment", err);
        }
      };
      fetchEquipment();
    } else {
      setRoomEquipment([]);
    }
  }, [selectedRoom]);

  // --- STATS ---
  const { totalRooms, availableRooms, occupiedRooms, maintenanceRooms, activityTodayRooms } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    const available: Facility[] = [];
    const occupied: Facility[] = [];
    const maintenance: Facility[] = [];
    const activityToday: Facility[] = [];

    (facilities || []).forEach((room: Facility) => {
      const activity = getActivity(room, today);
      const currentStatus = room.status?.toLowerCase() || "";
      const isMaintenance = currentStatus === "maintenance";
      
      const isCurrentlyOccupied = currentStatus === "occupied" || activity.some(act => {
        if (!act.date || !act.startTime || !act.endTime) return false;
        const start = new Date(`${act.date}T${act.startTime}`);
        const end = new Date(`${act.date}T${act.endTime}`);
        return now >= start && now <= end;
      });

      if (isCurrentlyOccupied) {
        occupied.push(room);
      } else if (currentStatus === "available") {
        available.push(room);
      }
      
      if (isMaintenance) {
        maintenance.push(room);
      }
      
      if (activity.length > 0) {
        activityToday.push(room);
      }
    });

    return {
      totalRooms: facilities || [],
      availableRooms: available,
      occupiedRooms: occupied,
      maintenanceRooms: maintenance,
      activityTodayRooms: activityToday
    };
  }, [facilities, bookings, classSchedules, maintenance]);

  const [statsModalData, setStatsModalData] = useState<{title: string, rooms: Facility[]} | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-[#0072bc]/20 border-t-[#0072bc] rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Infrastructure...</p>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-20">
      <div className={cn("space-y-8 transition-all duration-500", showForm ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100")}>

        {/* ── HEADER ── */}
        <div className="flex justify-between items-end px-1 pt-4 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Room <span className="text-accent-brand">Availability</span>
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Real-time occupancy tracking and facility allocation
            </p>
          </div>
          <Button 
            onClick={() => router.push(ROUTES.buildingAdmin.calendar)}
            className="font-bold text-xs h-10 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Full Calendar & Sync
          </Button>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatsCard title="Total Rooms" value={totalRooms.length} icon={Building2} variant="primary" onClick={() => setStatsModalData({ title: "Total Rooms", rooms: totalRooms })} />
          <StatsCard title="Available" value={availableRooms.length} icon={CheckCircle2} variant="success" onClick={() => setStatsModalData({ title: "Available Rooms", rooms: availableRooms })} />
          <StatsCard title="Occupied" value={occupiedRooms.length} icon={Users} variant="destructive" onClick={() => setStatsModalData({ title: "Occupied Rooms", rooms: occupiedRooms })} />
          <StatsCard title="Maintenance" value={maintenanceRooms.length} icon={Wrench} variant="warning" onClick={() => setStatsModalData({ title: "Rooms Under Maintenance", rooms: maintenanceRooms })} />
          <StatsCard title="Activity Today" value={activityTodayRooms.length} icon={CalendarDays} variant="primary" onClick={() => setStatsModalData({ title: "Rooms with Activity Today", rooms: activityTodayRooms })} />
        </div>

        {/* ── FILTERS & VIEWS ── */}
        <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card border border-border/40 p-2 rounded-2xl shadow-sm">
          
          <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto flex-1">
            <div className="relative flex-1 w-full max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search by Room Number or Name..."
                className="w-full pl-11 pr-4 h-11 bg-transparent border-none font-medium text-sm outline-none focus:ring-0 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="hidden md:block w-px h-6 bg-border/50 self-center mx-2" />
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-[120px] shrink-0 border-none bg-slate-50 dark:bg-slate-900 rounded-xl font-medium text-sm h-11 focus:ring-0">
                  <SelectValue placeholder="Floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {FLOORS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] shrink-0 border-none bg-slate-50 dark:bg-slate-900 rounded-xl font-medium text-sm h-11 focus:ring-0">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] shrink-0 border-none bg-slate-50 dark:bg-slate-900 rounded-xl font-medium text-sm h-11 focus:ring-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Occupied">Occupied</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-1 shrink-0 w-full xl:w-auto justify-center xl:justify-start">
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-10 h-9 rounded-lg px-0 transition-colors", viewMode === "grid" && "bg-white dark:bg-[#15181E] shadow-sm text-[#0072bc]")}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-10 h-9 rounded-lg px-0 transition-colors", viewMode === "list" && "bg-white dark:bg-[#15181E] shadow-sm text-[#0072bc]")}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-10 h-9 rounded-lg px-0 transition-colors", viewMode === "stack" && "bg-white dark:bg-[#15181E] shadow-sm text-[#0072bc]")}
              onClick={() => setViewMode("stack")}
              title="Stack View"
            >
              <Layers className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-10 h-9 rounded-lg px-0 transition-colors", viewMode === "cards" && "bg-white dark:bg-[#15181E] shadow-sm text-[#0072bc]")}
              onClick={() => setViewMode("cards")}
              title="Cards View"
            >
              <CreditCard className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── ROOM GRID ── */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-border/40 rounded-[2.5rem] bg-card/30">
            <Building2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No rooms match your filters</p>
          </div>
        ) : (
          <div className={cn(
            (viewMode === "grid" || viewMode === "cards") 
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
              : "flex flex-col gap-3"
          )}>
            {filtered.map((room: Facility) => {
              const now = new Date();
              const today = now.toISOString().split("T")[0];
              const dailyActivity = getActivity(room, today);
              const currentStatus = room.status?.toLowerCase() || "";
              const isMaintenance = currentStatus === "maintenance";
              const isOccupied = currentStatus === "occupied" || dailyActivity.some(act => {
                if (!act.date || !act.startTime || !act.endTime) return false;
                const start = new Date(`${act.date}T${act.startTime}`);
                const end = new Date(`${act.date}T${act.endTime}`);
                return now >= start && now <= end;
              });
              return (
                <RoomInfoCard
                  key={room.id}
                  room={room}
                  dailyActivity={dailyActivity}
                  isOccupied={isOccupied}
                  isMaintenance={isMaintenance}
                  isExpanded={expandedSchedules.has(room.id)}
                  onToggleExpand={(roomId) => {
                    const next = new Set(expandedSchedules);
                    if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
                    setExpandedSchedules(next);
                  }}
                  onRoomClick={handleRoomClick}
                  onBookNow={handleBookNow}
                  layout={viewMode}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── RESERVATION FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto animate-in slide-in-from-right">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 p-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button variant="ghost" className="text-sm font-semibold gap-2 rounded-xl" onClick={() => setShowForm(false)}>
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <h2 className="text-xl font-bold">Manual <span className="text-[#0072bc]">Reservation</span></h2>
            </div>
            <Button
              variant="ghost"
              className="text-sm font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel
            </Button>
          </header>
          <main className="max-w-4xl mx-auto py-12 px-6">
            <ReservationForm
              type={selectedRoom?.roomNumber === "GYM" ? "gym" : "facility"}
              form={formState}
              setForm={setFormState}
              onSubmit={() => { setShowForm(false); }}
              onCancel={() => setShowCancelDialog(true)}
              facilities={facilities}
              blockedRanges={blockedRanges}
            />
          </main>
        </div>
      )}

      {/* ── STATS MODAL ── */}
      <Dialog open={!!statsModalData} onOpenChange={(open) => !open && setStatsModalData(null)}>
        <DialogContent className="max-w-2xl p-6 rounded-[2.5rem] bg-background border-border/40 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {statsModalData?.title} <span className="text-muted-foreground text-lg">({statsModalData?.rooms.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-3">
            {statsModalData?.rooms.map(room => (
              <div
                key={room.id}
                role="button"
                tabIndex={0}
                className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/40 hover:border-sti-blue/50 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => { setStatsModalData(null); handleRoomClick(room); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatsModalData(null); handleRoomClick(room); } }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-bold text-base">{room.roomNumber}</p>
                    <p className="text-xs text-muted-foreground font-medium">{room.name || room.type}</p>
                  </div>
                </div>
                <Badge className={cn("text-xs font-semibold px-2 py-1", room.status === 'occupied' ? 'bg-red-500 text-white' : room.status === 'maintenance' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white')}>{room.status || "Available"}</Badge>
              </div>
            ))}
            {statsModalData?.rooms.length === 0 && (
              <div className="py-12 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No rooms found in this category.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DISCARD ALERT ── */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">All progress will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold text-sm">Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 rounded-xl font-semibold text-sm"
              onClick={() => { setShowForm(false); setShowCancelDialog(false); }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

{/* ── ROOM SCHEDULE MODAL ── */}
      <Dialog open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-2xl bg-background border-border/40 h-[90vh] md:h-[80vh] flex flex-col">
          {selectedRoom && (
            <>
              {/* Modal Header */}
              <div className="p-8 bg-gradient-to-br from-[#050d36] to-[#0a1854] text-white relative shrink-0">
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <DialogTitle className="text-4xl font-bold tracking-tight text-white">
                        {selectedRoom.roomNumber}
                      </DialogTitle>
                      <Badge className="bg-amber-400 text-black font-semibold text-xs rounded-lg border-none">
                        {selectedRoom.type}
                      </Badge>
                    </div>
                    {/* Fixed data mismatch: only display name if it differs from type and exists */}
                    {(selectedRoom.name && selectedRoom.name !== selectedRoom.type) && (
                      <p className="text-sm font-medium opacity-80">{selectedRoom.name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-8 relative z-10">
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold opacity-60 mb-1">Location</p>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-400" /> {selectedRoom.floor}
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold opacity-60 mb-1">Capacity</p>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400" /> {selectedRoom.capacity} Students
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold opacity-60 mb-1">Status</p>
                    <p className="text-sm font-bold flex items-center gap-2">
                      {(() => {
                        const now = new Date();
                        const dailyActivity = getActivity(selectedRoom, now.toISOString().split('T')[0]);
                        const currentStatus = selectedRoom.status?.toLowerCase() || "";
                        const isMaintenance = currentStatus === "maintenance";
                        const isOccupied = currentStatus === "occupied" || dailyActivity.some(act => {
                          if (!act.date || !act.startTime || !act.endTime) return false;
                          const start = new Date(`${act.date}T${act.startTime}`);
                          const end = new Date(`${act.date}T${act.endTime}`);
                          return now >= start && now <= end;
                        });
                        
                        if (isMaintenance) return (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full animate-pulse bg-amber-500" />
                            Maintenance
                          </>
                        );
                        
                        return (
                          <>
                            <span className={cn(
                              "w-2.5 h-2.5 rounded-full animate-pulse",
                              isOccupied ? "bg-red-500" : "bg-emerald-500"
                            )} />
                            {isOccupied ? "Currently Occupied" : "Available Now"}
                          </>
                        );
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-0 bg-background/50">
                <AvailabilityGrid
                  selectedRoom={selectedRoom}
                  roomEquipment={roomEquipment}
                  modalTab={modalTab}
                  onModalTabChange={setModalTab}
                  getActivity={getActivity}
                  onExternalCalendar={() => router.push(`${ROUTES.buildingAdmin.calendar}?facilityId=${selectedRoom.id}`)}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}