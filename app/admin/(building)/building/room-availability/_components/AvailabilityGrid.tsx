"use client"

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight, Package, AlertTriangle, Wind } from "lucide-react";
import { getEquipmentIcon, hasHvacSystem } from "@/lib/equipment/equipment-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Facility } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { MergedActivity } from "@/hooks/admin/useAvailabilityGrid";

const formatTime12Hour = (timeStr?: string) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
};

interface EquipmentRecord {
  equipmentName: string;
  quantity: number;
  currentStatusName: string;
}

const ACTIVITY_CONFIG = {
  class: { color: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-500/10", label: "Published Schedule" },
  booking: { color: "bg-[#0072bc]", text: "text-[#0072bc]", light: "bg-[#0072bc]/10", label: "Reserved Room" },
  maintenance: { color: "bg-amber-500", text: "text-amber-600", light: "bg-amber-500/10", label: "Maintenance" },
  hold: { color: "bg-slate-500", text: "text-slate-600", light: "bg-slate-500/10", label: "Admin Block" },
};

interface AvailabilityGridProps {
  selectedRoom: Facility;
  roomEquipment: EquipmentRecord[];
  modalTab: string;
  onModalTabChange: (tab: string) => void;
  getActivity: (room: Facility, date: string) => MergedActivity[];
  onExternalCalendar: () => void;
}

export function AvailabilityGrid({
  selectedRoom,
  roomEquipment,
  modalTab,
  onModalTabChange,
  getActivity,
  onExternalCalendar,
}: AvailabilityGridProps) {
  return (
    <Tabs value={modalTab} onValueChange={onModalTabChange} className="w-full h-full flex flex-col">
      <div className={cn(
        "px-8 pt-6 pb-2 sticky top-0 z-20",
        "bg-card/80 backdrop-blur-sm border-b border-border/40"
      )}>
        <TabsList className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl h-12 w-full lg:w-auto border border-border/20">
          <TabsTrigger value="today" className="rounded-xl px-6 font-semibold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-foreground data-[state=active]:shadow-sm">Today</TabsTrigger>
          <TabsTrigger value="threeday" className="rounded-xl px-6 font-semibold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-foreground data-[state=active]:shadow-sm">Next 3 Days</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-xl px-6 font-semibold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-foreground data-[state=active]:shadow-sm">Weekly Grid</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 p-8">

        {/* TODAY VIEW */}
        {/* TODAY VIEW */}
        <TabsContent value="today" className="mt-0 outline-none">
          {(() => {
            const todayActivities = getActivity(selectedRoom, new Date().toISOString().split('T')[0]);
            const hasActivities = todayActivities.length > 0;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className={cn("space-y-6", hasActivities ? "lg:col-span-2" : "lg:col-span-3")}>
                  <h3 className="text-lg font-bold text-foreground">
                    Daily <span className="text-[#0072bc]">Timeline</span>
                  </h3>
                  <div className="space-y-4">
                    {hasActivities ? (
                      todayActivities.map((act, idx) => {
                        const config = ACTIVITY_CONFIG[act.type as keyof typeof ACTIVITY_CONFIG];
                        return (
                          <div key={idx} className="group relative pl-8 pb-8 last:pb-0">
                            <div className="absolute left-[3px] top-0 bottom-0 w-0.5 bg-border/40 group-last:bottom-auto group-last:h-6" />
                            <div className={cn("absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full z-10 shadow-sm transition-transform group-hover:scale-125", config.color)} />
                            <div className="p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md bg-card border-border/40">
                              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge className={cn("text-[10px] font-semibold border-none text-white", config.color)}>{config.label}</Badge>
                                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {formatTime12Hour(act.startTime)} - {formatTime12Hour(act.endTime)}
                                    </span>
                                  </div>
                                  <h4 className="text-base font-bold leading-tight text-foreground">{act.title}</h4>
                                  <p className="text-sm font-medium text-muted-foreground mt-1">{act.subtitle}</p>
                                </div>
                                {/* ponytail: buttons removed. Remove hold exists on main card. Details view is YAGNI until requested. */}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-10 text-center border-2 border-dashed border-border/40 rounded-2xl bg-card/30">
                        <Clock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No activities scheduled for today</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className={cn("space-y-6", !hasActivities && "lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 space-y-0")}>
                  <div className="bg-card p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col">
                    <h4 className="text-xs font-semibold mb-6 text-[#0072bc] border-b border-border/40 pb-4 flex items-center justify-between">
                      Amenities & Equipment
                      {roomEquipment && roomEquipment.length > 0 && (
                        <Badge className="bg-[#0072bc]/10 text-[#0072bc] border-none text-xs">{roomEquipment.length} Dynamic Assets</Badge>
                      )}
                    </h4>

                    {!hasHvacSystem(selectedRoom, roomEquipment) && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 mb-4 text-xs font-medium">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>No HVAC / Air Conditioning system installed in this room.</span>
                      </div>
                    )}
                    
                    {((!roomEquipment || roomEquipment.length === 0) && (!selectedRoom.amenities || selectedRoom.amenities.length === 0) && (!selectedRoom.equipment || selectedRoom.equipment.length === 0)) ? (
                      <div className="py-8 text-center border-2 border-dashed border-border/20 rounded-2xl bg-muted/10">
                        <Package className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">No assets registered</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {[...(selectedRoom.amenities || []), ...(selectedRoom.equipment || [])].map((item, idx) => {
                            const IconComponent = getEquipmentIcon(item);
                            return (
                              <Badge
                                key={`static-${idx}`}
                                variant="secondary"
                                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-foreground flex items-center gap-1.5"
                              >
                                <IconComponent className="w-3.5 h-3.5 text-[#0072bc]" />
                                {item}
                              </Badge>
                            );
                          })}
                        </div>

                        {roomEquipment && roomEquipment.length > 0 && (
                          <div className="space-y-3 mt-auto">
                            {roomEquipment.map((g, idx) => {
                              const IconComponent = getEquipmentIcon(g.equipmentName || (g as any).equipmentTypeName);
                              return (
                                <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/40">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-foreground">{g.equipmentName}</span>
                                    <span className="text-xs font-medium text-muted-foreground">{g.quantity} Units — {g.currentStatusName}</span>
                                  </div>
                                  <IconComponent className="w-4 h-4 text-[#0072bc]/70" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {hasActivities && (
                    <div className="bg-card p-6 rounded-2xl border border-border/40 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-semibold mb-6 text-muted-foreground border-b border-border/40 pb-4">Activity Legend</h4>
                        <div className="space-y-4">
                          {Object.entries(ACTIVITY_CONFIG).map(([key, config]) => (
                            <div key={key} className="flex items-center gap-4">
                              <div className={cn("w-3.5 h-3.5 rounded-full shadow-inner shrink-0", config.color)} />
                              <span className="text-xs font-medium text-foreground/80">{config.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <Button
                          variant="outline"
                          onClick={onExternalCalendar}
                          className="w-full h-10 rounded-xl font-semibold text-xs border-dashed opacity-60 hover:opacity-100 transition-opacity"
                        >
                          External Calendar Page
                        </Button>
                      </div>
                    </div>
                  )}

                  {!hasActivities && (
                    <div className="flex flex-col justify-center">
                      <Button
                        variant="outline"
                        onClick={onExternalCalendar}
                        className="w-full h-12 rounded-xl font-semibold text-sm border-dashed border-border/60 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        External Calendar Page
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* 3-DAY VIEW */}
        <TabsContent value="threeday" className="mt-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(offset => {
              const date = new Date();
              date.setDate(date.getDate() + offset);
              const dateStr = date.toISOString().split('T')[0];
              const acts = getActivity(selectedRoom, dateStr);
              return (
                <div key={offset} className="bg-card p-6 rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-6 border-b border-border/40 pb-4">
                    <div>
                      <p className="text-xs font-semibold text-[#0072bc] mb-1">
                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-base font-bold text-foreground">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold bg-slate-950/10 dark:bg-slate-950/30 border-none px-3 py-1 text-foreground/70">
                      {acts.length} Events
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    {acts.length > 0 ? acts.map((a, i) => (
                      <div key={i} className={cn("p-4 rounded-xl flex flex-col gap-1 transition-all border border-transparent", ACTIVITY_CONFIG[a.type].light)}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", ACTIVITY_CONFIG[a.type].color)} />
                          <span className="text-xs font-semibold">
                            {formatTime12Hour(a.startTime)} - {formatTime12Hour(a.endTime)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>
                      </div>
                    )) : (
                      <div className="py-12 text-center">
                        <p className="text-sm font-medium text-muted-foreground opacity-60">No Events</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* WEEKLY GRID VIEW */}
        <TabsContent value="weekly" className="mt-0 outline-none">
          <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950/40 border-b border-border/40">
                    <th className="p-4 text-xs font-semibold text-muted-foreground w-32 border-r border-border/40">Day</th>
                    <th className="p-4 text-xs font-semibold text-muted-foreground">Schedules</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
                    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayNum];
                    const date = new Date();
                    const currentDay = date.getDay();
                    let diff = dayNum - currentDay;
                    if (diff < 0) diff += 7;
                    date.setDate(date.getDate() + diff);
                    const dateStr = date.toISOString().split('T')[0];
                    const acts = getActivity(selectedRoom, dateStr);

                    return (
                      <tr key={dayNum} className="border-b border-border/40 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors">
                        <td className="p-4 text-sm font-semibold border-r border-border/40 bg-slate-50 dark:bg-slate-950/10 text-foreground">
                          {dayName}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {acts.length > 0 ? acts.map((a, i) => (
                              <div key={i} className={cn("px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm border border-white/5", ACTIVITY_CONFIG[a.type].light)}>
                                <div className={cn("w-2 h-2 rounded-full shrink-0", ACTIVITY_CONFIG[a.type].color)} />
                                <div className="flex flex-col">
                                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                                  <span className="text-[11px] font-semibold">
                                    {formatTime12Hour(a.startTime)} - {formatTime12Hour(a.endTime)}
                                  </span>
                                </div>
                              </div>
                            )) : (
                              <span className="text-sm text-muted-foreground italic px-2 py-1 opacity-60">Unscheduled</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

      </div>
    </Tabs>
  );
}
