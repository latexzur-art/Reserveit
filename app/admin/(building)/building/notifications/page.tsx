'use client'

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CalendarDays, Wrench, Shield, AlertTriangle, RefreshCw,
  AlertCircle, BellOff, CheckCircle2, User, MapPin, Clock, Calendar, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toUnifiedNotification, type UnifiedNotification } from "@/types/notifications";
import { formatDistanceToNow } from "date-fns";

const tabs = [
  { value: "all", label: "All Updates" },
  { value: "booking", label: "Bookings" },
  { value: "maintenance", label: "Maintenance" },
  { value: "system", label: "System" },
];

const iconMap: Record<string, typeof CalendarDays> = {
  booking: CalendarDays,
  schedule_upload: CalendarDays,
  maintenance: Wrench,
  system: Shield,
  conflict: AlertTriangle,
};

const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  booking:        { bg: "bg-blue-500/10",    text: "text-blue-500",    dot: "bg-blue-500" },
  schedule_upload:{ bg: "bg-indigo-500/10",  text: "text-indigo-500",  dot: "bg-indigo-500" },
  maintenance:    { bg: "bg-amber-500/10",   text: "text-amber-500",   dot: "bg-amber-500" },
  conflict:       { bg: "bg-destructive/10", text: "text-red-600 dark:text-red-400", dot: "bg-destructive" },
  system:         { bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500" },
};

const META_FIELDS: { icon: React.ElementType; label: string; key: string }[] = [
  { icon: User,     label: "Requested by",  key: "requester_name" },
  { icon: User,     label: "Role",          key: "requester_role" },
  { icon: MapPin,   label: "Facility",      key: "facility_name" },
  { icon: Calendar, label: "Date",          key: "booking_date" },
  { icon: Clock,    label: "Duration",      key: "duration" },
  { icon: Info,     label: "Purpose",       key: "purpose" },
  { icon: User,     label: "Attendees",     key: "expected_attendees" },
  { icon: User,     label: "Decided by",    key: "decided_by_name" },
  { icon: Info,     label: "Reason",        key: "rejection_reason" },
  { icon: Info,     label: "Dept.",         key: "department" },
  { icon: Info,     label: "Term",          key: "academic_term" },
  { icon: Info,     label: "Entries",       key: "total_entries" },
  { icon: User,     label: "Submitted by",  key: "submitted_by" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<UnifiedNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/building/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      const rows = data.notifications || data || [];
      setNotifications(rows.map((r: Record<string, unknown>) => toUnifiedNotification(r)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    try {
      await fetch('/api/admin/building/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) { console.error('[Notifications]', err); }
  };

  const viewNotification = async (notif: UnifiedNotification) => {
    setSelectedNotif(notif);
    setDetailOpen(true);
    if (!notif.read) {
      try {
        await fetch('/api/admin/building/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id, action: 'mark_read' }),
        });
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
      } catch (err) { console.error('[Notifications]', err); }
    }
  };

  const filteredNotifs = (tab: string) => {
    if (tab === "all") return notifications;
    return notifications.filter(n => (n.sourceType ?? 'system') === tab);
  };

  const formatTime = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400 mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400">{error}</p>
        <Button variant="link" onClick={fetchNotifications}>Retry Fetch</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">System <span className="text-accent-brand">Notifications</span></h1>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchNotifications}
            className="h-9 w-9 rounded-lg border border-border"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            className="rounded-lg text-xs font-semibold border-border hover:bg-muted h-9 px-3.5"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Mark All Read
          </Button>
        </div>
      </div>

      <Card className="rounded-xl overflow-hidden border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <div className="px-6 pt-4 pb-3 border-b border-border bg-muted/20">
              <TabsList className="bg-muted/60 p-1 rounded-lg h-9 gap-1 border-none">
                {tabs.map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="text-xs font-medium rounded-md px-4 h-7 data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-xs"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {tabs.map(tab => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <ScrollArea className="h-[60vh]">
                  <div className="divide-y divide-border/40">
                    {filteredNotifs(tab.value).map(notif => {
                      const srcType = notif.sourceType ?? 'system';
                      const c = colorMap[srcType] || colorMap.system;
                      const Icon = iconMap[srcType] || Shield;
                      return (
                        <div
                          key={notif.id}
                          onClick={() => viewNotification(notif)}
                          className={cn(
                            "p-4 sm:p-5 cursor-pointer transition-all hover:bg-muted/40 flex items-start gap-4 relative group",
                            !notif.read && "bg-primary/[0.03]"
                          )}
                        >
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs mt-0.5", c.bg)}>
                            <Icon className={cn("w-5 h-5", c.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1 gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{notif.title}</p>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-xs text-muted-foreground font-medium">
                                  {formatTime(notif.createdAt)}
                                </span>
                                {!notif.read && (
                                  <span className={cn("w-2 h-2 rounded-full", c.dot)} title="Unread" />
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredNotifs(tab.value).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                        <BellOff className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Everything is up to date</p>
                      <p className="text-xs text-muted-foreground mt-1">No notifications found in this category</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </Card>

      {/* DETAIL MODAL */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border p-6 shadow-xl">
          {selectedNotif && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", colorMap[selectedNotif.sourceType ?? 'system']?.bg || "bg-muted")}>
                    {React.createElement(iconMap[selectedNotif.sourceType ?? 'system'] || Shield, {
                      className: cn("w-5 h-5", colorMap[selectedNotif.sourceType ?? 'system']?.text || "text-foreground")
                    })}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground leading-snug">
                      {selectedNotif.title}
                    </DialogTitle>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {formatTime(selectedNotif.createdAt)}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-muted/30 text-xs font-normal leading-relaxed text-foreground border border-border/50">
                {selectedNotif.message}
              </div>

              {/* Rich metadata panel */}
              {selectedNotif.metadata && Object.keys(selectedNotif.metadata).length > 0 && (
                <div className="space-y-2 pt-1 border-t border-border/40">
                  {!!selectedNotif.metadata.booking_reference && (
                    <p className="text-xs font-mono text-muted-foreground pb-2">
                      Ref: <span className="font-semibold text-foreground">{String(selectedNotif.metadata.booking_reference)}</span>
                    </p>
                  )}
                  {META_FIELDS.filter(f => !!selectedNotif.metadata?.[f.key]).map(f => (
                    <div key={f.key} className="flex items-start gap-2 text-xs">
                      <f.icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground w-24 flex-shrink-0">{f.label}</span>
                      <span className="font-semibold text-foreground">{String(selectedNotif.metadata?.[f.key])}</span>
                    </div>
                  ))}
                  {!!selectedNotif.metadata.start_time && !!selectedNotif.metadata.end_time && (
                    <div className="flex items-start gap-2 text-xs">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground w-24 flex-shrink-0">Time</span>
                      <span className="font-semibold text-foreground">
                        {String(selectedNotif.metadata.start_time)} – {String(selectedNotif.metadata.end_time)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setDetailOpen(false)}
                  className="rounded-xl text-xs font-semibold px-6 h-9"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
