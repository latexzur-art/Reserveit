"use client"

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Layers, Clock, Wrench, Wind } from "lucide-react";
import { getEquipmentIcon, hasHvacSystem } from "@/lib/equipment/equipment-icons";
import { Facility } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { MergedActivity } from "@/hooks/admin/useAvailabilityGrid";
import { useRouter } from "next/navigation";

const formatTime12Hour = (timeStr?: string) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
};

const ACTIVITY_CONFIG = {
  class: { color: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-500/10", label: "Published Schedule" },
  booking: { color: "bg-sti-blue", text: "text-sti-blue", light: "bg-sti-blue/10", label: "Reserved Room" },
  maintenance: { color: "bg-amber-500", text: "text-amber-600", light: "bg-amber-500/10", label: "Maintenance" },
  hold: { color: "bg-slate-500", text: "text-slate-600", light: "bg-slate-500/10", label: "Admin Block" },
};

interface RoomInfoCardProps {
  room: Facility;
  dailyActivity: MergedActivity[];
  isOccupied: boolean;
  isMaintenance: boolean;
  isExpanded: boolean;
  onToggleExpand: (roomId: string) => void;
  onRoomClick: (room: Facility) => void;
  onBookNow: (room: Facility) => void;
  layout?: "grid" | "list" | "stack" | "cards";
}

export function RoomInfoCard({
  room,
  dailyActivity,
  isOccupied,
  isMaintenance,
  isExpanded,
  onToggleExpand,
  onRoomClick,
  onBookNow,
  layout = "cards",
}: RoomInfoCardProps) {
  const router = useRouter();
  const visibleActivities = isExpanded ? dailyActivity : dailyActivity.slice(0, 1);
  const hasHvac = hasHvacSystem(room);

  if (layout === "list") {
    return (
    <div
          key={room.id}
          role="button"
          tabIndex={0}
          onClick={() => onRoomClick(room)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoomClick(room); } }}
          className={cn(
            "group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "bg-card border-slate-200 dark:border-white/[0.06] hover:shadow-md",
            isMaintenance
              ? "hover:border-amber-500/50"
              : isOccupied
              ? "hover:border-red-500/50"
              : "hover:border-emerald-500/50"
          )}
        >
          <div className="flex items-center gap-4 min-w-[250px] shrink-0">
            <div className={cn(
              "w-3 h-3 rounded-full shrink-0 shadow-sm",
              isMaintenance ? "bg-amber-500 shadow-amber-500/40" : isOccupied ? "bg-red-500 shadow-red-500/40" : "bg-emerald-500 shadow-emerald-500/40"
            )} />
            <div>
              <h3 className="text-lg font-bold text-card-foreground group-hover:text-sti-blue transition-colors flex items-center gap-2 flex-wrap">
                {room.roomNumber}
                <Badge variant="outline" className={cn(
                  "text-xs font-semibold px-2 py-0 border-none rounded-md",
                  isMaintenance
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : isOccupied
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}>
                  {isOccupied ? "Occupied" : room.status || "Available"}
                </Badge>
                {!hasHvac && (
                  <Badge
                    variant="outline"
                    title="No Air Conditioning System Installed"
                    className="text-xs font-semibold px-2 py-0.5 border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 rounded-md flex items-center gap-1 shrink-0"
                  >
                    <Wind className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                    <span>No HVAC</span>
                  </Badge>
                )}
              </h3>
              <p className="text-sm font-medium text-muted-foreground">{room.name || room.type}</p>
            </div>
          </div>
    
          {/* Meta Info */}
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground shrink-0 min-w-[180px]">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 opacity-50" /> {room.floor}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 opacity-50" /> {room.capacity} Cap
            </span>
          </div>
    
          {/* Agenda Summary */}
          <div className="hidden xl:flex items-center text-sm shrink-0 min-w-[180px]">
             {dailyActivity.length > 0 ? (
               <div className="flex items-center gap-2">
                 <Clock className="w-4 h-4 opacity-50" />
                 <span className="font-medium text-slate-700 dark:text-slate-300">
                   {dailyActivity.length} event{dailyActivity.length !== 1 && "s"} today
                 </span>
               </div>
             ) : (
               <span className="text-muted-foreground italic text-sm">No events today</span>
             )}
          </div>
    
          {/* Action Button */}
          <div className="flex items-center justify-end w-full md:w-auto shrink-0 md:min-w-[140px]">
            {!isMaintenance ? (
              <Button
                size="sm"
                className={cn(
                  "text-sm font-semibold px-6 h-9 rounded-lg transition-all w-full md:w-auto",
                  !isOccupied
                    ? "bg-sti-blue hover:bg-sti-blue-dark text-white shadow-sm"
                    : room.status?.toLowerCase() === "occupied"
                      ? "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                      : "bg-slate-100 dark:bg-white/5 text-muted-foreground hover:bg-slate-200 dark:hover:bg-white/10"
                )}
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  if (room.status?.toLowerCase() === "occupied") {
                    try {
                      await fetch(`/api/admin/building/facilities/${room.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'available' })
                      });
                      router.refresh();
                    } catch (err) {
                      console.error(err);
                    }
                  } else {
                    onBookNow(room); 
                  }
                }}
              >
                {!isOccupied 
                  ? "Book Now" 
                  : room.status?.toLowerCase() === "occupied"
                    ? "Remove Hold"
                    : "Privileged Booking"}
              </Button>
            ) : (
              <Badge variant="outline" className="h-9 px-4 rounded-lg text-sm font-semibold border-dashed border-amber-300 text-amber-600 bg-amber-50 flex items-center justify-center w-full md:w-auto">
                <Wrench className="w-4 h-4 mr-1.5" /> Maintenance
              </Badge>
            )}
          </div>
        </div>
    );
  }

  if (layout === "grid") {
    return (
      <div
        key={room.id}
        role="button"
        tabIndex={0}
        onClick={() => onRoomClick(room)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoomClick(room); } }}
        className={cn(
          "group flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "bg-card border-slate-200 dark:border-white/[0.06] hover:shadow-md",
          isMaintenance ? "hover:border-amber-500/50" : isOccupied ? "hover:border-red-500/50" : "hover:border-sti-blue/50"
        )}
      >
        <div className={cn(
          "w-12 h-12 rounded-full mb-3 flex items-center justify-center shadow-sm",
          isMaintenance ? "bg-amber-100 text-amber-600" : isOccupied ? "bg-red-100 text-red-600" : "bg-blue-50 text-sti-blue"
        )}>
          {isMaintenance ? <Wrench className="w-5 h-5" /> : isOccupied ? <Users className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
        </div>
        <h3 className="text-xl font-bold text-card-foreground group-hover:text-sti-blue transition-colors">{room.roomNumber}</h3>
        <p className="text-sm text-muted-foreground mb-4">{room.name || room.type}</p>
        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1">
          <Badge variant="outline" className={cn(
            "text-xs font-semibold px-3 py-1 border-none rounded-full",
            isMaintenance ? "bg-amber-500/10 text-amber-600" : isOccupied ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-sti-blue"
          )}>
            {isOccupied ? "Occupied" : room.status || "Available"}
          </Badge>
          {!hasHvac && (
            <Badge
              variant="outline"
              title="No Air Conditioning System Installed"
              className="text-xs font-semibold px-2.5 py-0.5 border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 rounded-full flex items-center gap-1"
            >
              <Wind className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
              <span>No HVAC</span>
            </Badge>
          )}
        </div>
      </div>
    );
  }

  if (layout === "stack") {
    return (
      <Card
        key={room.id}
        role="button"
        tabIndex={0}
        onClick={() => onRoomClick(room)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoomClick(room); } }}
        className={cn(
          "p-0 flex flex-col md:flex-row relative overflow-hidden cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "rounded-2xl border transition-all duration-300 shadow-sm",
          "bg-card border-slate-200 dark:border-white/[0.06] hover:shadow-md",
          isMaintenance ? "hover:border-amber-500/50" : isOccupied ? "hover:border-red-500/50" : "hover:border-sti-blue/50"
        )}
      >
        <div className="flex flex-col p-6 flex-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold text-card-foreground group-hover:text-sti-blue transition-colors flex items-center gap-2">
                {room.roomNumber}
              </h3>
              <p className="text-sm font-medium text-muted-foreground">{room.name || room.type}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant="outline" className={cn(
                "text-xs font-semibold px-2.5 py-0.5 border-none rounded-md",
                isMaintenance ? "bg-amber-500/10 text-amber-600" : isOccupied ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-sti-blue"
              )}>
                {isOccupied ? "Occupied" : room.status || "Available"}
              </Badge>
              {!hasHvac && (
                <Badge
                  variant="outline"
                  title="No Air Conditioning System Installed"
                  className="text-xs font-semibold px-2.5 py-0.5 border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 rounded-md flex items-center gap-1"
                >
                  <Wind className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                  <span>No HVAC</span>
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5 text-sm font-medium text-slate-500 mb-6">
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {room.floor}</span>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {room.capacity} Cap</span>
          </div>
          
          <div className="mt-auto">
             {!isMaintenance ? (
              <Button
                size="sm"
                className={cn(
                  "text-sm font-semibold px-6 h-10 rounded-xl transition-all w-full md:w-auto",
                  !isOccupied
                    ? "bg-sti-blue hover:bg-sti-blue-dark text-white shadow-sm"
                    : room.status?.toLowerCase() === "occupied"
                      ? "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                      : "bg-slate-100 dark:bg-white/5 text-muted-foreground hover:bg-slate-200 dark:hover:bg-white/10"
                )}
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  if (room.status?.toLowerCase() === "occupied") {
                    try {
                      await fetch(`/api/admin/building/facilities/${room.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'available' }) });
                      router.refresh();
                    } catch (err) {}
                  } else { onBookNow(room); }
                }}
              >
                {!isOccupied ? "Book Now" : room.status?.toLowerCase() === "occupied" ? "Remove Hold" : "Privileged Booking"}
              </Button>
            ) : (
              <Badge variant="outline" className="h-10 px-4 rounded-xl text-sm font-semibold border-dashed border-amber-300 text-amber-600 bg-amber-50 w-full md:w-auto flex items-center justify-center">
                <Wrench className="w-4 h-4 mr-1.5" /> Maintenance
              </Badge>
            )}
          </div>
        </div>
        <div className="flex-1 p-6 bg-slate-50 dark:bg-card">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-sti-blue" /> Today&apos;s Agenda
          </p>
          {dailyActivity.length > 0 ? (
            <div className="space-y-3">
              {dailyActivity.map((act: MergedActivity, idx: number) => {
                const config = ACTIVITY_CONFIG[act.type];
                return (
                  <div key={idx} className={cn("p-3 rounded-xl flex items-center justify-between border border-transparent shadow-sm", config.light)}>
                    <div className="flex flex-col truncate pr-4">
                      <span className={cn("text-sm font-bold truncate", config.text)}>{act.title}</span>
                      <span className="text-xs font-medium opacity-70 truncate">{act.subtitle}</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-bold shrink-0 text-xs bg-white dark:bg-black/20 px-2 py-1 rounded-md shadow-sm">{formatTime12Hour(act.startTime)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
             <p className="text-sm text-muted-foreground italic bg-white dark:bg-black/20 p-4 rounded-xl border border-slate-100 dark:border-white/5">No activities scheduled today</p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      key={room.id}
      role="button"
      tabIndex={0}
      onClick={() => onRoomClick(room)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoomClick(room); } }}
      className={cn(
        "p-6 flex flex-col relative overflow-hidden cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "rounded-xl border transition-all duration-300 shadow-sm",
        "bg-card",
        "border-slate-200 dark:border-white/[0.06]",
        "hover:shadow-md hover:-translate-y-0.5",
        isMaintenance
          ? "hover:border-amber-500/50"
          : isOccupied
          ? "hover:border-red-500/50"
          : "hover:border-emerald-500/50"
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3 mt-1">
        <div>
          <h3 className={cn(
            "text-2xl font-bold transition-colors flex items-center gap-2",
            "text-card-foreground group-hover:text-sti-blue"
          )}>
            {room.roomNumber}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">{room.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn(
            "text-xs font-semibold border-none px-2.5 py-0.5 rounded-md",
            isMaintenance
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : isOccupied
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            {isOccupied ? "Occupied" : room.status || "Available"}
          </Badge>
          {!hasHvac && (
            <Badge
              variant="outline"
              title="No Air Conditioning System Installed"
              className="text-xs font-semibold border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-md flex items-center gap-1"
            >
              <Wind className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
              <span>No HVAC</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-5 text-sm font-medium text-slate-500 dark:text-slate-400 mb-5">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 opacity-50" /> {room.floor}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 opacity-50" /> {room.capacity} Cap
        </span>
      </div>

      {/* Amenities */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-sti-blue" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Amenities</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[...(room.amenities || []), ...(room.equipment || [])].map((item, idx) => {
            const IconComponent = getEquipmentIcon(item);
            return (
              <Badge
                key={idx}
                variant="secondary"
                className={cn(
                  "text-xs font-medium px-2.5 py-0.5 rounded-md flex items-center gap-1.5",
                  "bg-slate-100 dark:bg-white/5 border-transparent text-slate-600 dark:text-slate-300"
                )}
              >
                <IconComponent className="w-3.5 h-3.5 text-sti-blue" />
                {item}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-auto flex items-center justify-between pt-5 border-t border-slate-100 dark:border-white/5">
        <div className="flex flex-col">
          <p className="text-xs text-muted-foreground mb-0.5">Status</p>
          <p className={cn(
            "text-sm font-semibold",
            !isOccupied ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"
          )}>
            {!isOccupied ? "Available Now" : "Currently In-Use"}
          </p>
        </div>
        {!isMaintenance ? (
          <Button
            size="sm"
            className={cn(
              "text-sm font-semibold px-5 h-9 rounded-lg transition-all",
              !isOccupied
                ? "bg-sti-blue hover:bg-sti-blue-dark text-white shadow-sm"
                : room.status?.toLowerCase() === "occupied"
                  ? "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                  : "bg-slate-100 dark:bg-white/5 text-muted-foreground hover:bg-slate-200 dark:hover:bg-white/10"
            )}
            onClick={async (e) => { 
              e.stopPropagation(); 
              if (room.status?.toLowerCase() === "occupied") {
                try {
                  await fetch(`/api/admin/building/facilities/${room.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'available' })
                  });
                  router.refresh();
                } catch (err) {
                  console.error(err);
                }
              } else {
                onBookNow(room); 
              }
            }}
          >
            {!isOccupied 
              ? "Book Now" 
              : room.status?.toLowerCase() === "occupied"
                ? "Remove Hold"
                : "Privileged Booking"}
          </Button>
        ) : (
          <Badge variant="outline" className="h-9 px-3 rounded-lg text-sm font-semibold border-dashed border-amber-300 text-amber-600 bg-amber-50 flex items-center gap-1.5">
            <Wrench className="w-4 h-4" /> Maintenance
          </Badge>
        )}
      </div>

      {/* Today's Agenda */}
      <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sti-blue" /> Today&apos;s Agenda
          </p>
          {dailyActivity.length > 0 && (
            <Badge className="text-xs font-semibold bg-blue-50 text-sti-blue dark:bg-sti-blue/10 border-none rounded-md px-2">
              {dailyActivity.length} Events
            </Badge>
          )}
        </div>
        {dailyActivity.length > 0 ? (
          <div className="space-y-2">
            {visibleActivities.map((act: MergedActivity, idx: number) => {
              const config = ACTIVITY_CONFIG[act.type];
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg flex items-center justify-between border shadow-sm transition-all",
                    config.light, "border-transparent hover:border-slate-200 dark:hover:border-white/10"
                  )}
                >
                  <div className="flex flex-col truncate max-w-[160px]">
                    <span className={cn("text-sm font-semibold truncate", config.text)}>{act.title}</span>
                    <span className="text-xs font-medium opacity-70 truncate">{act.subtitle}</span>
                  </div>
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5 shrink-0 text-xs">
                    {formatTime12Hour(act.startTime)}
                  </span>
                </div>
              );
            })}
            {dailyActivity.length > 1 && (
              <button
                className={cn(
                  "w-full text-xs font-semibold text-sti-blue py-2 mt-1 flex items-center justify-center gap-1",
                  "hover:bg-blue-50 dark:hover:bg-sti-blue/10 rounded-lg transition-colors"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(room.id);
                }}
              >
                {isExpanded ? "Show Less" : `Show All Agenda (${dailyActivity.length})`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic bg-slate-50 dark:bg-white/5 rounded-lg p-3 text-center">No activities scheduled today</p>
        )}
      </div>
    </Card>
  );
}
