"use client"

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Search, Plus, CloudLightning, AlertTriangle, Layers, X, Hammer, DoorClosed, Loader2, ArrowUp, ArrowDown, SlidersHorizontal } from "lucide-react";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import { FacilityTable } from "./_components/FacilityTable";
import { FacilityFormPanel } from "./_components/FacilityFormPanel";
import { AdminReviewsModerationPanel } from "./_components/AdminReviewsModerationPanel";
import { ReservationPolicyTab } from "./_components/ReservationPolicyTab";
import { ScheduleReportsTab } from "./_components/ScheduleReportsTab";
import { FacilityPhotoManagerDialog } from "./_components/FacilityPhotoManagerDialog";
import { useState, useMemo, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useBuildingFacilities } from "@/hooks/admin/building";
import { useBuildingEquipment } from "@/hooks/admin/building/useBuildingEquipment";
import { cn } from "@/lib/utils";
import { AMENITY_NAME_MAX_LENGTH, AMENITY_NOTES_MAX_LENGTH, AMENITY_QUANTITY_MAX, normalizeAmenityName, isAmenityQuantityLocked } from "@/backend/admin/building/building.types";

const TYPES = ["Classroom", "Laboratory", "Multi-Purpose Hall", "Gymnasium", "Library", "Specialty"];

const FacilityManagement = () => {
  const { facilities, floors, facilityTypes, createFacility, updateFacility, deleteFacility } = useBuildingFacilities();
  
  // UI States
  const [search, setSearch] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any>(null);
  const [photoManagerFacility, setPhotoManagerFacility] = useState<any>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Facility Form State
  const [formFloor, setFormFloor] = useState("");
  const [formType, setFormType] = useState("");
  const [specialtyName, setSpecialtyName] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formStatus, setFormStatus] = useState("Available");
  const [formIsAvailableForRental, setFormIsAvailableForRental] = useState(false);
  const [formAssignments, setFormAssignments] = useState<any[]>([]); // { typeId, name, quantity }
  const [assignedEquipment, setAssignedEquipment] = useState<any[]>([]); // Current assignments from server
  // { name, quantity (string), notes, isEquipmentBacked, source, hasExistingRow }
  const [formAmenityRows, setFormAmenityRows] = useState<any[]>([]);
  const [amenityCatalog, setAmenityCatalog] = useState<any[]>([]); // { id, name, category, icon, isEquipmentBacked }
  const [formDescription, setFormDescription] = useState("");

  // Manual Override States
  const [manualOverride, setManualOverride] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualName, setManualName] = useState("");

  // Equipment Search State
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false);

  // Amenity Search State
  const [amenitySearch, setAmenitySearch] = useState("");
  const [addAmenityOpen, setAddAmenityOpen] = useState(false);

  // Restriction States
  const [overrideReason, setOverrideReason] = useState("Examination");
  const [customReason, setCustomReason] = useState("");
  const [restrictionDuration, setRestrictionDuration] = useState("Until End of Day");
  const [customLiftDate, setCustomLiftDate] = useState("");
  const [bulkTargetAction, setBulkTargetAction] = useState<"Restrict" | "Restore">("Restrict");

  // Filter & Sort States
  const [filterFloor, setFilterFloor] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"floor" | "roomNumber" | "name" | "capacity" | "status" | "type">("floor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const availableFloors = floors?.map(f => f.name) || [];

  const formatTypeName = (name: string) =>
    name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const filtered = useMemo(() => {
    const result = facilities.filter((f) => {
      const matchesSearch =
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.roomNumber?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesFloor = filterFloor === "all" || f.floorName === filterFloor;
      const matchesType = filterType === "all" || f.facilityTypeName === filterType;
      const matchesStatus = filterStatus === "all" ||
        (filterStatus === "Restricted" ? f.status?.startsWith("Restricted") : f.status === filterStatus);
      return matchesSearch && matchesFloor && matchesType && matchesStatus;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "floor": {
          const floorDiff = (a.floorNumber ?? 0) - (b.floorNumber ?? 0);
          if (floorDiff !== 0) return floorDiff * dir;
          return (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true });
        }
        case "roomNumber":
          return (a.roomNumber || "").localeCompare(b.roomNumber || "", undefined, { numeric: true }) * dir;
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "capacity":
          return ((a.capacity ?? 0) - (b.capacity ?? 0)) * dir;
        case "status":
          return (a.status || "").localeCompare(b.status || "") * dir;
        case "type":
          return (a.facilityTypeName || "").localeCompare(b.facilityTypeName || "") * dir;
        default:
          return 0;
      }
    });

    return result;
  }, [facilities, search, filterFloor, filterType, filterStatus, sortBy, sortDir]);

  // --- LOGIC: AUTO-GENERATION ---
  const metadata = useMemo(() => {
    if (!formType || !formFloor) return { id: "", name: "" };

    if (["Multi-Purpose Hall", "Gymnasium", "Library"].includes(formType)) {
      const existing = facilities.filter(f => f.facilityTypeName === formType).length + 1;
      const label = formType === "Multi-Purpose Hall" ? "MPH" : formType === "Gymnasium" ? "Gym" : "Library";
      return { id: `${label} ${existing}`, name: `${label} ${existing}` };
    }

    const floorRooms = facilities.filter(f => f.floorName === formFloor && ["Classroom", "Laboratory", "Specialty"].includes(f.facilityTypeName));
    let roomNum = "";

    if (formFloor === "Ground Floor") {
      roomNum = (104 + floorRooms.length).toString();
    } else if (formFloor === "Mezzanine") {
      roomNum = `M${(floorRooms.length + 1).toString().padStart(2, '0')}`;
    } else {
      const floorDigit = formFloor.match(/\d+/)?.[0] || "1";
      if (floorRooms.length > 0) {
        const nums = floorRooms.filter(r => r.roomNumber).map(r => parseInt(r.roomNumber!)).filter(n => !isNaN(n));
        roomNum = nums.length > 0 ? (Math.max(...nums) + 1).toString() : `${floorDigit}01`;
      } else {
        roomNum = `${floorDigit}01`;
      }
    }

    let genName = `Room ${roomNum}`;
    if (formType === "Laboratory") genName = `Room ${roomNum} - Laboratory`;
    if (formType === "Specialty") genName = `Room ${roomNum}${specialtyName ? ` - ${specialtyName}` : ""}`;

    return { id: roomNum, name: genName };
  }, [formType, formFloor, specialtyName, facilities]);

  useEffect(() => {
    if (manualOverride && !manualId) {
      setManualId(editingFacility?.roomNumber || metadata.id);
      setManualName(editingFacility?.name || metadata.name);
    }
  }, [manualOverride, metadata, editingFacility]);

  // Fetch current equipment assignments when editing
  useEffect(() => {
    if (editingFacility) {
      const fetchAssigned = async () => {
        try {
          const res = await fetch(`/api/admin/building/facilities/${editingFacility.id}/equipment?units=1`);
          const data = await res.json();
          setAssignedEquipment(data.equipment || []);
        } catch (err) {
          console.error("Failed to fetch assigned equipment", err);
        }
      };
      fetchAssigned();
    } else {
      setAssignedEquipment([]);
    }
  }, [editingFacility]);

  // Fetch the amenity catalog once (used by the amenity combobox for both add & edit)
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch(`/api/admin/building/facilities/amenities`);
        const data = await res.json();
        setAmenityCatalog(data.amenities || []);
      } catch (err) {
        console.error("Failed to fetch amenity catalog", err);
      }
    };
    fetchCatalog();
  }, []);

  // Fetch this facility's current amenities when editing
  useEffect(() => {
    if (editingFacility) {
      const fetchAmenities = async () => {
        try {
          const res = await fetch(`/api/admin/building/facilities/${editingFacility.id}/amenities`);
          const data = await res.json();
          const rows = (data.amenities || []).map((a: any) => ({
            name: a.name,
            quantity: String(a.quantity ?? 1),
            notes: a.notes || "",
            isEquipmentBacked: !!a.isEquipmentBacked,
            // Source of truth for the read-only quantity lock — see FacilityFormPanel.
            // A catalog-linked amenity (isEquipmentBacked) is NOT locked just because
            // it *could* eventually be inventory-owned; it only locks once Phase 4 has
            // actually written a source='inventory' row for this facility+amenity pair.
            source: a.source,
            hasExistingRow: true,
          }));
          setFormAmenityRows(rows);
        } catch (err) {
          console.error("Failed to fetch facility amenities", err);
        }
      };
      fetchAmenities();
    } else {
      setFormAmenityRows([]);
    }
  }, [editingFacility]);

  const { equipment: allEquipmentGroups, equipmentTypes } = useBuildingEquipment();
  const availableEquipment = allEquipmentGroups.filter((g: any) => !g.assignedFacilityId) as any[];

  // --- ACTIONS WITH API INTEGRATION ---

  const handleBulkUpdate = async () => {
    setIsUpdating(true);
    const isRestoring = bulkTargetAction === "Restore";
    const reason = overrideReason === "Other" ? customReason : overrideReason;
    const durationLabel = restrictionDuration === "Other" ? `Lifts: ${customLiftDate}` : restrictionDuration;

    const newStatus = isRestoring ? "Available" : `Restricted (${reason})`;
    const newNote = isRestoring ? "" : `${reason} | ${durationLabel}`;

    try {
      await Promise.all(
        selectedRooms.map(id =>
          updateFacility(id, { status: newStatus, restrictionNote: newNote })
        )
      );
      toast({ title: "Updated", description: `${selectedRooms.length} facilities modified.` });
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setSelectedRooms([]);
      setOverrideDialogOpen(false);
      setIsUpdating(false);
    }
  };

  const validateAmenityRows = (): string | null => {
    for (const row of formAmenityRows) {
      const name = (row.name || "").trim();
      if (!name) return "Amenity name cannot be empty.";
      if (name.length > AMENITY_NAME_MAX_LENGTH) {
        return `Amenity name must be ${AMENITY_NAME_MAX_LENGTH} characters or fewer.`;
      }
      if (!isAmenityQuantityLocked(row)) {
        const qty = Number(row.quantity);
        if (String(row.quantity).trim() === "" || !Number.isInteger(qty) || qty < 1 || qty > AMENITY_QUANTITY_MAX) {
          return `Amenity "${name}" quantity must be a whole number between 1 and ${AMENITY_QUANTITY_MAX}.`;
        }
      }
      if ((row.notes || "").length > AMENITY_NOTES_MAX_LENGTH) {
        return `Amenity "${name}" notes must be ${AMENITY_NOTES_MAX_LENGTH} characters or fewer.`;
      }
    }
    // Reject duplicate amenities (case/format-insensitive) within the same submission.
    const seen = new Set<string>();
    for (const row of formAmenityRows) {
      const key = normalizeAmenityName(row.name || "");
      if (seen.has(key)) return `Amenity "${row.name}" is listed more than once.`;
      seen.add(key);
    }
    return null;
  };

  const handleSaveFacility = async () => {
    if (isUpdating) return;

    if (!manualOverride && (!formFloor || !formType)) {
      toast({ title: "Error", description: "Select a Floor and Facility Type.", variant: "destructive" });
      return;
    }

    const capacityNum = Number(formCapacity);
    if (formCapacity.trim() === "" || !Number.isFinite(capacityNum) || capacityNum < 1) {
      toast({ title: "Error", description: "Capacity must be a positive number.", variant: "destructive" });
      return;
    }

    if (manualOverride && facilities.some(f => f.roomNumber === manualId && f.id !== editingFacility?.id)) {
      toast({ title: "Error", description: "Room number already exists.", variant: "destructive" });
      return;
    }

    const amenityError = validateAmenityRows();
    if (amenityError) {
      toast({ title: "Error", description: amenityError, variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    const payload = {
      name: manualOverride ? manualName : (editingFacility && !formFloor ? editingFacility.name : metadata.name),
      facilityTypeName: formType,
      floorName: formFloor,
      capacity: Number(formCapacity),
      status: formStatus.toLowerCase(),
      description: formDescription,
      isAvailableForRental: formIsAvailableForRental,
      amenities: formAmenityRows.map(row => ({
        name: row.name.trim(),
        quantity: Number(row.quantity) || 1,
        notes: row.notes?.trim() ? row.notes.trim() : undefined,
      })),
    };

    try {
      let facilityId = editingFacility?.id;
      if (editingFacility) {
        await updateFacility(editingFacility.id, payload);
        toast({ title: "Success", description: "Facility updated successfully." });
      } else {
        const newFacility = await createFacility(payload);
        facilityId = (newFacility as any).id;
        toast({ title: "Success", description: "Facility created successfully." });
      }

      // Handle Equipment Assignments
      if (facilityId && formAssignments.length > 0) {
        const assignRes = await fetch(`/api/admin/building/facilities/${facilityId}/equipment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: formAssignments.map(a => ({ equipmentTypeId: a.typeId, quantity: a.quantity })) })
        });
        if (!assignRes.ok) {
          const errData = await assignRes.json().catch(() => ({}));
          toast({
            title: "Equipment Not Assigned",
            description: errData.error || "Facility was saved, but the pending equipment assignment failed.",
            variant: "destructive",
          });
        }
      }

      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnassign = async (ids: string[]) => {
    if (!editingFacility) return;
    setIsUpdating(true);
    try {
      const unassignRes = await fetch(`/api/admin/building/facilities/${editingFacility.id}/equipment`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: ids })
      });
      if (!unassignRes.ok) {
        const errData = await unassignRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to unassign equipment.');
      }
      // Refresh assignments
      const res = await fetch(`/api/admin/building/facilities/${editingFacility.id}/equipment?units=1`);
      const data = await res.json();
      setAssignedEquipment(data.equipment || []);
      toast({ title: "Success", description: "Equipment unassigned." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFacility(id);
      toast({ title: "Deleted", description: "Facility deleted successfully." });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingFacility(null);
    setFormFloor("");
    setFormType("");
    setFormCapacity("");
    setFormStatus("Available");
    setFormIsAvailableForRental(false);
    setSpecialtyName("");
    setFormAmenityRows([]);
    setFormDescription("");
    setFormAssignments([]);
    setAssignedEquipment([]);
    setManualOverride(false);
    setManualId("");
    setManualName("");
    setEquipmentSearch("");
    setAmenitySearch("");
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* HEADER SECTION */}
      <div className="px-1">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Facility <span className="text-accent-brand">Management</span>
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Configure building floors, room details, capacity, and active notices
            </p>
          </div>
          <div className="flex gap-2">
            {/* Added: Database Sync Loader */}
            {isUpdating && <div className="flex items-center gap-2 px-3 text-sm font-medium text-sti-blue animate-pulse"><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</div>}
            
            <Button onClick={() => setFloorDialogOpen(true)} variant="outline" className="text-sm font-medium h-10 px-4 rounded-xl border-dashed">
              <Layers className="w-3.5 h-3.5 mr-2" /> Add Floor
            </Button>
            
            <div className="flex items-center">
                <Button 
                    variant="ghost" 
                    className={cn(
                        "text-sm font-medium h-10 px-4 rounded-xl transition-all",
                        selectedRooms.length > 0 
                            ? "bg-blue-500 text-white hover:bg-blue-600 rounded-r-none border-r border-blue-400" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setOverrideDialogOpen(true)}
                >
                    <CloudLightning className="w-3.5 h-3.5 mr-2" /> 
                    {selectedRooms.length > 0 ? `Update Status (${selectedRooms.length})` : "Bulk Update"}
                </Button>
                {selectedRooms.length > 0 && (
                    <Button 
                        variant="ghost" 
                        className="bg-red-500 text-white hover:bg-red-600 h-10 px-2 rounded-xl rounded-l-none"
                        onClick={() => setSelectedRooms([])}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-sti-blue hover:bg-sti-blue-dark text-sm font-medium h-10 px-6 rounded-xl shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Add Facility
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground tracking-widest">
            Campus infrastructure management and availability control
        </p>
      </div>

      <Tabs defaultValue="facilities">
        <TabsList className="mb-2">
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
          <TabsTrigger value="reviews">Reviews & Issues</TabsTrigger>
          <TabsTrigger value="policy">Reservation Policy</TabsTrigger>
          <TabsTrigger value="schedule-reports">Schedule Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="facilities" className="space-y-8">
      {/* STATS SECTION */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Available Now" value={facilities.filter(f => f.status === "Available").length} icon={Building2} variant="success" />
        <StatsCard title="Maintenance" value={facilities.filter(f => f.status === "Maintenance").length} icon={Hammer} variant="warning" />
        <StatsCard title="Occupied" value={facilities.filter(f => f.status === "Occupied").length} icon={DoorClosed} variant="destructive" />
        <StatsCard title="Restricted" value={facilities.filter(f => f.status?.startsWith("Restricted")).length} icon={AlertTriangle} variant="primary" />
      </div>

      {/* SEPARATED SEARCH BAR */}
      <div className="relative w-full group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-sti-blue transition-transform group-focus-within:scale-110" />
        <input 
          placeholder="Search by Room Number or Name..." 
          className="w-full pl-12 pr-6 h-14 bg-background border border-border/40 rounded-2xl outline-none font-bold text-xs focus:ring-2 focus:ring-sti-blue/20 focus:border-sti-blue transition-all placeholder:text-muted-foreground/50 tracking-tight shadow-sm" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      {/* FILTER & SORT BAR */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        {/* Floor filter */}
        <Select value={filterFloor} onValueChange={setFilterFloor}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-xl text-sm font-medium border-border/40">
            <SelectValue placeholder="All Floors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm font-medium">All Floors</SelectItem>
            {floors.map(f => (
              <SelectItem key={f.id} value={f.name} className="text-sm font-medium">{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-xl text-sm font-medium border-border/40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm font-medium">All Types</SelectItem>
            {facilityTypes.map(t => (
              <SelectItem key={t.id} value={t.name} className="text-sm font-medium">{formatTypeName(t.name)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-xl text-sm font-medium border-border/40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm font-medium">All Statuses</SelectItem>
            <SelectItem value="Available" className="text-sm font-medium">Available</SelectItem>
            <SelectItem value="Occupied" className="text-sm font-medium">Occupied</SelectItem>
            <SelectItem value="Maintenance" className="text-sm font-medium">Maintenance</SelectItem>
            <SelectItem value="Restricted" className="text-sm font-medium">Restricted</SelectItem>
            <SelectItem value="Unavailable" className="text-sm font-medium">Unavailable</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-5 w-px bg-border/40" />

        {/* Sort by */}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-xl text-sm font-medium border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="floor" className="text-sm font-medium">Sort: Floor</SelectItem>
            <SelectItem value="roomNumber" className="text-sm font-medium">Sort: Room No.</SelectItem>
            <SelectItem value="name" className="text-sm font-medium">Sort: Name</SelectItem>
            <SelectItem value="capacity" className="text-sm font-medium">Sort: Capacity</SelectItem>
            <SelectItem value="status" className="text-sm font-medium">Sort: Status</SelectItem>
            <SelectItem value="type" className="text-sm font-medium">Sort: Type</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort direction */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 rounded-xl text-sm font-medium border-border/40 gap-1.5"
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
        >
          {sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {sortDir === "asc" ? "ASC" : "DESC"}
        </Button>

        {/* Clear filters */}
        {(filterFloor !== "all" || filterType !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 gap-1"
            onClick={() => { setFilterFloor("all"); setFilterType("all"); setFilterStatus("all"); }}
          >
            <X className="w-3 h-3" /> Clear
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {filtered.length} / {facilities.length} facilities
        </span>
      </div>

      {/* MAIN TABLE SECTION */}
      <FacilityTable
        filtered={filtered}
        selectedRooms={selectedRooms}
        setSelectedRooms={setSelectedRooms}
        sortBy={sortBy}
        sortDir={sortDir}
        setSortBy={setSortBy}
        setSortDir={setSortDir}
        onEdit={(f) => {
          setEditingFacility(f); setFormFloor(f.floorName); setFormType(f.facilityTypeName);
          setFormCapacity(String(f.capacity)); setFormStatus(f.status);
          setFormIsAvailableForRental(f.isAvailableForRental ?? false);
          // formAmenityRows is populated by the fetch-on-edit effect keyed on editingFacility.
          setFormDescription(f.description || "");
          setDialogOpen(true);
        }}
        onDelete={handleDelete}
        onManagePhotos={setPhotoManagerFacility}
      />
        </TabsContent>

        <TabsContent value="reviews">
          <AdminReviewsModerationPanel />
        </TabsContent>

        <TabsContent value="policy">
          <ReservationPolicyTab />
        </TabsContent>

        <TabsContent value="schedule-reports">
          <ScheduleReportsTab />
        </TabsContent>
      </Tabs>

      {/* FLOOR DISPLAY DIALOG */}
      <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Available Floors</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {availableFloors.map((floor, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                            <span className="text-xs font-black uppercase">{floor}</span>
                        </div>
                    ))}
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* BULK RESTRICTION DIALOG */}
      <AlertDialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] p-8 max-w-2xl">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">Bulk Update Facilities</AlertDialogTitle>
              {/* Note: AlertDialog usually doesn't have an X, but I kept the action-based closure */}
            </div>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium text-sti-blue">1. Selected Facilities</Label>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-md font-medium">{selectedRooms.length} Selected</Badge>
              </div>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" /><Input placeholder="Quick search..." className="pl-8 h-9 text-sm font-medium rounded-xl" value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} /></div>
              <ScrollArea className="h-[200px] border border-border/50 rounded-2xl p-2 bg-muted/10">
                <div className="space-y-1">
                  {facilities.filter(f => f.name.toLowerCase().includes(bulkSearch.toLowerCase()) || (f.roomNumber?.toLowerCase().includes(bulkSearch.toLowerCase()) ?? false)).map(f => (
                    <div key={f.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg transition-all">
                      <Checkbox id={`bulk-${f.id}`} checked={selectedRooms.includes(f.id)} onCheckedChange={(c) => setSelectedRooms(prev => c ? [...prev, f.id] : prev.filter(id => id !== f.id))} />
                      <label htmlFor={`bulk-${f.id}`} className="text-sm font-medium cursor-pointer select-none grow">{f.roomNumber || 'N/A'} — {f.name}</label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-4 border-l pl-6 border-border/40">
              <Label htmlFor="bulk-target-action" className="text-sm font-medium text-sti-blue">2. New Status</Label>
              <div className="space-y-3">
                <Select value={bulkTargetAction} onValueChange={(v: any) => setBulkTargetAction(v)}>
                  <SelectTrigger id="bulk-target-action" className="rounded-xl h-10 text-sm font-medium"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Restrict">Restrict Access</SelectItem><SelectItem value="Restore">Restore Access</SelectItem></SelectContent>
                </Select>
                {bulkTargetAction === "Restrict" && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                    <Select value={restrictionDuration} onValueChange={setRestrictionDuration}>
                      <SelectTrigger className="rounded-xl h-10 text-sm font-medium"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Until End of Day">End of Day</SelectItem><SelectItem value="Indefinite">Indefinite</SelectItem><SelectItem value="Other">Other...</SelectItem></SelectContent>
                    </Select>
                    {restrictionDuration === "Other" && <Input type="date" className="rounded-xl h-10 text-sm font-medium" value={customLiftDate} onChange={e => setCustomLiftDate(e.target.value)} />}
                    <Select value={overrideReason} onValueChange={setOverrideReason}>
                      <SelectTrigger className="rounded-xl h-10 text-sm font-medium"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Examination">Examination</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem><SelectItem value="Other">Other...</SelectItem></SelectContent>
                    </Select>
                    {overrideReason === "Other" && <Input placeholder="Type custom reason..." className="rounded-xl h-10 text-sm font-medium mt-3" value={customReason} onChange={e => setCustomReason(e.target.value)} />}
                  </div>
                )}
              </div>
            </div>
          </div>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel className="h-12 rounded-xl text-sm font-medium flex-1">Abort</AlertDialogCancel>
            <AlertDialogAction disabled={selectedRooms.length === 0} className="h-12 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium flex-1 shadow-md transition-all active:scale-95" onClick={handleBulkUpdate}>Apply Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FACILITY ADD/EDIT DIALOG */}
      <FacilityFormPanel
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingFacility={editingFacility}
        availableFloors={availableFloors}
        availableEquipment={availableEquipment}
        assignedEquipment={assignedEquipment}
        formFloor={formFloor}
        setFormFloor={setFormFloor}
        formType={formType}
        setFormType={setFormType}
        specialtyName={specialtyName}
        setSpecialtyName={setSpecialtyName}
        formCapacity={formCapacity}
        setFormCapacity={setFormCapacity}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formIsAvailableForRental={formIsAvailableForRental}
        setFormIsAvailableForRental={setFormIsAvailableForRental}
        formAmenityRows={formAmenityRows}
        setFormAmenityRows={setFormAmenityRows}
        amenityCatalog={amenityCatalog}
        amenitySearch={amenitySearch}
        setAmenitySearch={setAmenitySearch}
        addAmenityOpen={addAmenityOpen}
        setAddAmenityOpen={setAddAmenityOpen}
        manualOverride={manualOverride}
        setManualOverride={setManualOverride}
        manualId={manualId}
        setManualId={setManualId}
        manualName={manualName}
        setManualName={setManualName}
        metadata={metadata}
        equipmentSearch={equipmentSearch}
        setEquipmentSearch={setEquipmentSearch}
        addEquipmentOpen={addEquipmentOpen}
        setAddEquipmentOpen={setAddEquipmentOpen}
        formAssignments={formAssignments}
        setFormAssignments={setFormAssignments}
        handleSaveFacility={handleSaveFacility}
        handleUnassign={handleUnassign}
        onManagePhotos={() => editingFacility && setPhotoManagerFacility(editingFacility)}
        isSaving={isUpdating}
      />

      {/* PHOTO MANAGER DIALOG */}
      <FacilityPhotoManagerDialog
        open={!!photoManagerFacility}
        onOpenChange={(open) => !open && setPhotoManagerFacility(null)}
        facilityId={photoManagerFacility?.id ?? null}
        facilityName={photoManagerFacility?.name}
      />
    </div>
  );
};

export default FacilityManagement;