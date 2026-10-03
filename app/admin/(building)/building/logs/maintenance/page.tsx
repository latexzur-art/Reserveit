'use client'

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Download, Plus, Wrench, Clock, CheckCircle,
  Trash2, HardHat, Settings, Loader2, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import { cn } from "@/lib/utils";
import { useBuildingMaintenance, useBuildingFacilities, useBuildingEquipment } from "@/hooks/admin/building";
import { useToast } from "@/hooks/use-toast";
import { maintenanceStatusLabel, maintenanceTypeLabel } from "@/lib/enum-labels";

interface MaintenanceStaffOption { id: string; employeeId: string; fullName: string }

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In-progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function MaintenanceLogsPage() {
  const { toast } = useToast();

  // --- Backend-wired data ---
  const {
    records, loading, stats, createRecord, updateRecord, deleteRecord,
    search, setSearch, typeFilter, setTypeFilter, statusFilter, setStatusFilter,
    currentPage, setCurrentPage, totalPages,
  } = useBuildingMaintenance();
  const { facilities } = useBuildingFacilities();
  const { equipment } = useBuildingEquipment();

  // --- Maintenance staff for picker ---
  const [staffOptions, setStaffOptions] = useState<MaintenanceStaffOption[]>([])
  useEffect(() => {
    fetch('/api/admin/building/directory?category=maintenance_staff&status=active&pageSize=200')
      .then(r => r.json())
      .then(data => setStaffOptions((data.items || []).map((p: any) => ({ id: p.id, employeeId: p.employeeId ?? '', fullName: p.name }))))
      .catch(() => {})
  }, [])

  // --- State ---
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: "facility" as "facility" | "equipment",
    targetId: "",
    targetName: "",
    scheduleDate: "",
    technician: "",
  });

  const assetOptions = form.type === "facility"
    ? facilities.map(f => ({ id: f.id, label: f.roomNumber ? `${f.name} (${f.roomNumber})` : f.name }))
    : equipment.map(e => ({ id: e.id, label: e.equipmentName }));

  // --- Actions ---
  const handleAdd = async () => {
    if (!form.targetId || !form.scheduleDate || !form.technician) {
      toast({ title: "Missing information", description: "Asset, date, and technician are required.", variant: "destructive" });
      return;
    }
    setAddSubmitting(true);
    const ok = await createRecord({
      type: form.type,
      targetId: form.targetId,
      targetName: form.targetName,
      scheduleDate: form.scheduleDate,
      technician: form.technician,
    });
    setAddSubmitting(false);
    if (ok) {
      setAddDialogOpen(false);
      setForm({ type: "facility", targetId: "", targetName: "", scheduleDate: "", technician: "" });
    }
  };

  const updateStatus = (id: string, newStatus: string) => {
    updateRecord(id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleteSubmitting(true);
    const ok = await deleteRecord(deletingId);
    setDeleteSubmitting(false);
    if (ok) {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push("Type,Item,Scheduled Date,Completed Date,Technician,Status");
    records.forEach(r => lines.push(
      `${esc(r.type)},${esc(r.targetName)},${esc(r.scheduleDate)},${esc(r.completedDate)},${esc(r.technician)},${esc(STATUS_LABELS[r.status] || r.status)}`
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maintenance-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: "Maintenance log CSV downloaded" });
  };

  const statusBadge = (status: string) => {
    const configs: Record<string, string> = {
      "scheduled": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      "in_progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      "completed": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      "cancelled": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    };
    return (
      <Badge className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border-0 shadow-none", configs[status])}>
        {STATUS_LABELS[status] || maintenanceStatusLabel(status)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Maintenance <span className="text-accent-brand">Logs</span></h1>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            History of all asset availability and maintenance activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddDialogOpen(true)} className="rounded-xl font-semibold text-xs h-9 bg-card border-border hover:bg-accent hover:text-accent-foreground gap-1.5">
            <Plus className="w-4 h-4" /> Add Schedule
          </Button>
          <Button onClick={handleExportCsv} disabled={loading || records.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold text-xs h-9 px-4 gap-1.5 shadow-xs">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total Audit" value={stats.total} icon={Wrench} variant="primary" />
        <StatsCard title="In Progress" value={stats.inProgress} icon={Settings} variant="warning" />
        <StatsCard title="Resolved" value={stats.completed} icon={CheckCircle} variant="success" />
        <StatsCard title="Scheduled" value={stats.scheduled} icon={Clock} variant="default" />
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by item or technician..."
            aria-label="Search maintenance records"
            className="pl-9 h-9 rounded-lg bg-card border-border font-medium text-xs shadow-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter || "all"} onValueChange={v => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-9 rounded-lg bg-card border-border font-medium text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            <SelectItem value="all" className="text-xs">All Types</SelectItem>
            <SelectItem value="facility" className="text-xs">Facility</SelectItem>
            <SelectItem value="equipment" className="text-xs">Equipment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-9 rounded-lg bg-card border-border font-medium text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
            <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
            <SelectItem value="in_progress" className="text-xs">In-progress</SelectItem>
            <SelectItem value="completed" className="text-xs">Completed</SelectItem>
            <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* TABLE */}
      <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/40">
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground px-6 h-12 w-12 text-center">#</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Item</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Scheduled Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Completed Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Technician</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-center">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-right px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-xs font-medium text-muted-foreground">
                  No maintenance records yet.
                </TableCell>
              </TableRow>
            ) : records.map((r, index) => (
              <TableRow key={r.id} className="border-border/40 hover:bg-muted/30 transition-colors group">
                <TableCell className="px-6 py-4 text-center font-medium text-muted-foreground text-xs">{index + 1}</TableCell>
                <TableCell className="text-xs font-medium">
                  <Badge variant="outline" className="border-border/60 text-xs font-medium bg-background text-muted-foreground rounded-md px-2 py-0.5">{maintenanceTypeLabel(r.type)}</Badge>
                </TableCell>
                <TableCell className="font-semibold text-xs text-foreground">{r.targetName}</TableCell>
                <TableCell className="text-xs font-medium text-foreground">{r.scheduleDate}</TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">{r.completedDate || "-"}</TableCell>
                <TableCell className="text-xs font-medium flex items-center gap-2 py-4 text-foreground">
                   <HardHat size={14} className="text-primary" /> {r.technician}
                </TableCell>
                <TableCell className="text-center">{statusBadge(r.status)}</TableCell>
                <TableCell className="text-right px-6">
                  <div className="flex items-center justify-end gap-2">
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger className="w-28 h-8 rounded-lg text-xs font-medium border-border bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card shadow-lg">
                        <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
                        <SelectItem value="in_progress" className="text-xs">In-progress</SelectItem>
                        <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="text-red-600 dark:text-red-400 hover:bg-destructive/10 hover:text-red-600 dark:hover:text-red-400 h-8 w-8 rounded-lg" onClick={() => { setDeletingId(r.id); setDeleteDialogOpen(true); }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{currentPage}</span> of <span className="font-medium text-foreground">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* DIALOGS */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl p-6 bg-card border-border shadow-lg max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">New Audit Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label htmlFor="maintenance-log-category" className="text-xs font-semibold text-foreground">Category</Label>
                  <Select value={form.type} onValueChange={v => setForm({ type: v as "facility" | "equipment", targetId: "", targetName: "", scheduleDate: form.scheduleDate, technician: form.technician })}>
                    <SelectTrigger id="maintenance-log-category" className="h-9 rounded-lg bg-card border-border font-medium text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card"><SelectItem value="facility" className="text-xs">Facility</SelectItem><SelectItem value="equipment" className="text-xs">Equipment</SelectItem></SelectContent>
                  </Select>
               </div>
               <div className="space-y-1">
                  <Label htmlFor="maintenance-log-item" className="text-xs font-semibold text-foreground">Asset Name</Label>
                  <Select value={form.targetId} onValueChange={v => {
                    const opt = assetOptions.find(o => o.id === v)
                    setForm({ ...form, targetId: v, targetName: opt?.label ?? '' })
                  }}>
                    <SelectTrigger id="maintenance-log-item" className="h-9 rounded-lg bg-card border-border font-medium text-xs"><SelectValue placeholder="Select asset..." /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {assetOptions.map(o => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label htmlFor="maintenance-log-date" className="text-xs font-semibold text-foreground">Date</Label>
                  <Input id="maintenance-log-date" type="date" value={form.scheduleDate} onChange={e => setForm({...form, scheduleDate: e.target.value})} className="h-9 rounded-lg bg-card border-border font-medium text-xs" />
               </div>
               <div className="space-y-1.5">
                  <Label htmlFor="maintenance-log-technician" className="text-xs font-semibold text-foreground">Technician</Label>
                  {staffOptions.length > 0 && (
                    <Select onValueChange={v => setForm({...form, technician: v})}>
                      <SelectTrigger id="maintenance-log-technician-select" className="h-9 rounded-lg bg-card border-border font-medium text-xs"><SelectValue placeholder="Pick from staff list..." /></SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        {staffOptions.map(s => (
                          <SelectItem key={s.id} value={s.fullName} className="text-xs">
                            {s.fullName} ({s.employeeId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    id="maintenance-log-technician"
                    value={form.technician}
                    onChange={e => setForm({...form, technician: e.target.value})}
                    className="h-9 rounded-lg bg-card border-border font-medium text-xs"
                    placeholder={staffOptions.length > 0 ? "Or type name manually..." : "Technician name"}
                  />
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={addSubmitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-xl font-semibold text-xs shadow-xs">
              {addSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Publish Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl p-6 border-border bg-card shadow-lg max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-foreground">Remove Audit Log?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium text-muted-foreground mt-1">This will permanently remove the record from the audit trail.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl font-semibold text-xs h-9" disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteSubmitting} className="rounded-xl font-semibold text-xs h-9 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none">
              {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
