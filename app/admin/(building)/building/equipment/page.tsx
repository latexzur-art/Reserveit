"use client"

import { Button } from "@/components/ui/button";
import {
  Plus, Search, Trash2,
  Monitor, CheckCircle, Wrench, Filter, Clock, RefreshCw, Loader2,
  Check, ChevronsUpDown, MoreHorizontal, Layers
} from "lucide-react";
import { StatsCard } from "@/components/admin/dashboard/StatsCard";
import React, { useState, useMemo } from "react";
import { useBuildingEquipment } from "@/hooks/admin/building";
import { cn } from "@/lib/utils";
import { BulkImportDialog } from "@/components/admin/equipment/BulkImportDialog";
import { useEquipmentBulkImport } from "@/hooks/admin/equipment/useEquipmentBulkImport";
import { EditEquipmentDialog, AddEquipmentDialog, AssignEquipmentDialog } from "./_components/EquipmentDialogs";
import { BulkActionDialogs } from "./_components/BulkActionDialogs";
import { EquipmentTable } from "./_components/EquipmentTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const Equipment = () => {
  const {
    equipment,
    equipmentTypes,
    statusTypes,
    stats,
    facilities,
    loading,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    scopeFilter,
    setScopeFilter,
    refresh,
    createEquipment,
    deleteEquipment,
    deleteBulkEquipment,
    updateBulkEquipment,
    assignEquipment,
    requestAssignEquipment,
    currentPage,
    setCurrentPage,
    totalPages
  } = useBuildingEquipment();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [selectedBulkStatus, setSelectedBulkStatus] = useState("");
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Partial Delete State
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false);
  const [reducingItem, setReducingItem] = useState<any>(null);
  const [reduceCount, setReduceCount] = useState(1);
  const [reduceLoading, setReduceLoading] = useState(false);

  // Dialog States
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addAttempted, setAddAttempted] = useState(false);

  const [newItem, setNewItem] = useState({
    equipmentName: "",
    equipmentTypeId: "",
    assignedFacilityId: "",
    customTypeName: "",
    quantity: 1,
  });

  // Assign / request-assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningItem, setAssigningItem] = useState<any>(null);
  const [assignMode, setAssignMode] = useState<"assign" | "request">("assign");
  const [assignLoading, setAssignLoading] = useState(false);

  const [typeSearchOpen, setTypeSearchOpen] = useState(false);
  const [statusSearchOpen, setStatusSearchOpen] = useState(false);
  const [scopeSearchOpen, setScopeSearchOpen] = useState(false);
  const [modalTypeSearchOpen, setModalTypeSearchOpen] = useState(false);
  const [editTypeSearchOpen, setEditTypeSearchOpen] = useState(false);

  const { toast } = useToast();

  const bulk = useEquipmentBulkImport({
    basePath: '/api/admin/building/equipment',
    equipmentTypes,
    onImported: refresh,
  });

  const [isAddingNewType, setIsAddingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeSubmitLoading, setTypeSubmitLoading] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedGroups(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openEdit = (item: any) => {
    setEditingItem({
        ...item,
        // Ensure IDs are strings for the Select components
        equipmentTypeId: String(item.equipmentTypeId),
        currentStatusId: String(item.currentStatusId)
    });
    setEditDialogOpen(true);
  };

  // Open the assign dialog. Non-tech (PAMO) = direct move; tech (IT) = request.
  const openAssign = (item: any) => {
    setAssigningItem(item);
    setAssignMode(item.managedBy === "it" ? "request" : "assign");
    setAssignDialogOpen(true);
  };

  const handleAssignSubmit = async (toFacilityId: string | null, reason: string) => {
    if (!assigningItem) return;
    setAssignLoading(true);
    const ids: string[] = assigningItem.ids || [];
    const ok =
      assignMode === "request"
        ? await requestAssignEquipment(ids, toFacilityId as string, reason)
        : await assignEquipment(ids, toFacilityId, reason);
    setAssignLoading(false);
    if (ok) {
      setAssignDialogOpen(false);
      setAssigningItem(null);
    }
  };

  // Helper to get all individual asset IDs from the current visible groups
  const allVisibleIds = useMemo(() => equipment.flatMap((g: any) => g.ids), [equipment]);
  const isPageSelected = useMemo(() => 
    allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id)), 
    [allVisibleIds, selectedIds]
  );


  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setEditLoading(true);
    // editingItem comes from a grouped EquipmentTable row (same name/type/
    // facility/status is exactly what defines the group) — apply the edit to
    // every unit in the group, not just the single representative one the
    // group object happens to carry as `.id`. A group of 1 is just `.ids`
    // with one entry, so this covers both cases identically.
    const ids = editingItem.ids?.length > 0 ? editingItem.ids : [editingItem.id];
    const success = await updateBulkEquipment({
      equipmentName: editingItem.equipmentName,
      equipmentTypeId: editingItem.equipmentTypeId,
      currentStatusId: editingItem.currentStatusId,
      assignedFacilityId: editingItem.assignedFacilityId || null,
    }, ids);
    setEditLoading(false);
    if (success) setEditDialogOpen(false);
  };

  const handleAdd = async () => {
    const missingName = !newItem.equipmentName.trim();
    const missingType = !newItem.equipmentTypeId;
    if (missingName || missingType) {
      setAddAttempted(true);
      toast({
        title: "Missing required fields",
        description: missingName && missingType
          ? "Enter an equipment name and select a type."
          : missingName
          ? "Enter an equipment name."
          : "Select an equipment type.",
        variant: "destructive",
      });
      return;
    }
    setAddLoading(true);
    const success = await createEquipment({
      equipmentName: newItem.equipmentName,
      equipmentTypeId: newItem.equipmentTypeId,
      assignedFacilityId: newItem.assignedFacilityId || null,
      customTypeName: isOtherSelected ? newItem.customTypeName : undefined,
      quantity: newItem.quantity,
    });
    setAddLoading(false);
    if (success) {
      setAddDialogOpen(false);
      setAddAttempted(false);
      setNewItem({ equipmentName: "", equipmentTypeId: "", assignedFacilityId: "", customTypeName: "", quantity: 1 });
    }
  };

  const handleAddNewType = async () => {
    if (!newTypeName.trim()) return;
    setTypeSubmitLoading(true);
    try {
      const res = await fetch('/api/admin/building/equipment/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTypeName })
      });
      if (res.ok) {
        const newType = await res.json();
        await refresh(); // Refresh to get the new type in the list
        setNewItem({ ...newItem, equipmentTypeId: String(newType.id) });
        setIsAddingNewType(false);
        setNewTypeName("");
      }
    } catch (error) {
      console.error("Failed to add new type", error);
    } finally {
      setTypeSubmitLoading(false);
    }
  };

  const isOtherSelected = equipmentTypes.find(t => t.id === newItem.equipmentTypeId)?.name === "OTHER (SPECIFY)";


  const handleDelete = async () => {
    if (deletingId === null) return;
    await deleteEquipment(deletingId);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all IDs within all visible groups
      setSelectedIds(allVisibleIds);
    } else {
      setSelectedIds([]);
      setIsAllPagesSelected(false);
    }
  };

  const handleSelectGroup = (ids: string[], checked: boolean) => {
    if (checked) {
      setSelectedIds([...new Set([...selectedIds, ...ids])]);
    } else {
      setSelectedIds(selectedIds.filter(id => !ids.includes(id)));
      setIsAllPagesSelected(false);
    }
  };


  const confirmDecommission = (item: any) => {
    if (item.quantity > 1) {
      setReducingItem(item);
      setReduceCount(1);
      setReduceDialogOpen(true);
    } else {
      setDeletingId(item.ids[0]);
      setDeleteDialogOpen(true);
    }
  };

  const handleReduceQuantity = async () => {
    if (!reducingItem || reduceCount <= 0) return;
    setReduceLoading(true);
    // Take the first N IDs from the group
    const idsToRemove = reducingItem.ids.slice(0, Math.min(reduceCount, reducingItem.quantity));
    const success = await deleteBulkEquipment(idsToRemove);
    setReduceLoading(false);
    if (success) {
      setReduceDialogOpen(false);
      setReducingItem(null);
    }
  };

  const getActiveFilters = () => ({
    search,
    category: categoryFilter,
    status: statusFilter
  });

  const handleBulkDecommission = async () => {
    if (selectedIds.length === 0 && !isAllPagesSelected) return;
    setBulkUpdateLoading(true);
    const filters = isAllPagesSelected ? getActiveFilters() : undefined;
    const ids = isAllPagesSelected ? undefined : selectedIds;
    const success = await deleteBulkEquipment(ids, filters);
    setBulkUpdateLoading(false);
    if (success) {
      setSelectedIds([]);
      setIsAllPagesSelected(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if ((selectedIds.length === 0 && !isAllPagesSelected) || !selectedBulkStatus) return;
    setBulkUpdateLoading(true);
    const filters = isAllPagesSelected ? getActiveFilters() : undefined;
    const ids = isAllPagesSelected ? undefined : selectedIds;
    const success = await updateBulkEquipment({ currentStatusId: selectedBulkStatus }, ids, filters);
    setBulkUpdateLoading(false);
    if (success) {
      setSelectedIds([]);
      setIsAllPagesSelected(false);
      setBulkStatusDialogOpen(false);
      setSelectedBulkStatus("");
    }
  };

  const statsArray = [
    { title: "Total Assets", value: stats.total, icon: Monitor, variant: "primary" as const },
    { title: "Available", value: stats.available, icon: CheckCircle, variant: "success" as const },
    { title: "In-use", value: stats.inUse, icon: Monitor, variant: "primary" as const },
    { title: "Under Repair", value: stats.maintenance, icon: Wrench, variant: "warning" as const },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className="px-1">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Equipment <span className="text-accent-brand">Inventory</span>
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Audit equipment assets, track stock levels, and monitor maintenance
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={refresh} disabled={loading} variant="outline" className="font-medium text-sm h-10 px-4 rounded-xl border-dashed border-border/60">
                {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Refresh
            </Button>
            {/*
              Building Admin is the operational front-line, not an inventory owner:
              it views ALL equipment, moves non-tech (PAMO), requests tech (IT) moves,
              and flags/triages reports — it does NOT add or delete PAMO/IT assets.
              Adding/retiring BA-owned HVAC units lives on the dedicated HVAC tab
              (/admin/building/equipment/hvac), so the general inventory overview
              intentionally exposes no Add / Bulk-import / Clear-all controls.
            */}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsArray.map(s => <StatsCard key={s.title} title={s.title} value={s.value} icon={s.icon} variant={s.variant} />)}
      </div>

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0072bc]" />
          <input 
            aria-label="Search equipment by ID, Name, or Location"
            placeholder="Search by ID, Name, or Location..." 
            className="w-full pl-12 pr-6 h-12 bg-card border border-border/60 rounded-2xl outline-none font-medium text-sm focus:ring-2 focus:ring-[#0072bc]/20 transition-all" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {/* Type Filter */}
          <Popover open={typeSearchOpen} onOpenChange={setTypeSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-label="Filter by Equipment Type"
                aria-expanded={typeSearchOpen}
                className="w-full md:w-44 h-12 rounded-2xl font-medium text-sm border border-border/60 bg-card px-4 justify-between"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-[#0072bc]"/>
                  {categoryFilter && categoryFilter !== "all" 
                    ? equipmentTypes.find((t) => String(t.id) === categoryFilter)?.name 
                    : "All Types"}
                </div>
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 rounded-xl border-none shadow-2xl">
              <Command>
                <CommandInput placeholder="Search type..." className="h-9 text-sm" />
                <CommandList>
                  <CommandEmpty className="text-sm p-2">No type found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setCategoryFilter("all");
                        setTypeSearchOpen(false);
                      }}
                      className="text-sm font-medium"
                    >
                      <Check className={cn("mr-2 h-3 w-3", categoryFilter === "all" ? "opacity-100" : "opacity-0")} />
                      All Types
                    </CommandItem>
                    {equipmentTypes?.map((t: any) => (
                      <CommandItem
                        key={t.id}
                        value={String(t.id)}
                        onSelect={() => {
                          setCategoryFilter(String(t.id));
                          setTypeSearchOpen(false);
                        }}
                        className="text-sm font-medium"
                      >
                        <Check className={cn("mr-2 h-3 w-3", categoryFilter === String(t.id) ? "opacity-100" : "opacity-0")} />
                        {t.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Status Filter */}
          <Popover open={statusSearchOpen} onOpenChange={setStatusSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-label="Filter by Status"
                aria-expanded={statusSearchOpen}
                className="w-full md:w-44 h-12 rounded-2xl font-medium text-sm border border-border/60 bg-card px-4 justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-[#0072bc]"/>
                  {statusFilter && statusFilter !== "all" 
                    ? statusTypes.find((s) => String(s.id) === statusFilter)?.name 
                    : "All Status"}
                </div>
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 rounded-xl border-none shadow-2xl">
              <Command>
                <CommandInput placeholder="Search status..." className="h-9 text-sm" />
                <CommandList>
                  <CommandEmpty className="text-sm p-2">No status found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setStatusFilter("all");
                        setStatusSearchOpen(false);
                      }}
                      className="text-sm font-medium"
                    >
                      <Check className={cn("mr-2 h-3 w-3", statusFilter === "all" ? "opacity-100" : "opacity-0")} />
                      All Status
                    </CommandItem>
                    {statusTypes?.map((s: any) => (
                      <CommandItem
                        key={s.id}
                        value={String(s.id)}
                        onSelect={() => {
                          setStatusFilter(String(s.id));
                          setStatusSearchOpen(false);
                        }}
                        className="text-sm font-medium"
                      >
                        <Check className={cn("mr-2 h-3 w-3", statusFilter === String(s.id) ? "opacity-100" : "opacity-0")} />
                        {s.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Ownership (tech / non-tech) Filter */}
          <DropdownMenu open={scopeSearchOpen} onOpenChange={setScopeSearchOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-label="Filter by ownership"
                aria-expanded={scopeSearchOpen}
                className="w-full md:w-48 h-12 rounded-2xl font-medium text-sm border border-border/60 bg-card px-4 justify-between"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3 h-3 text-[#0072bc]" />
                  {scopeFilter === "pamo"
                    ? "Non-tech (PAMO)"
                    : scopeFilter === "it"
                    ? "Tech (IT)"
                    : scopeFilter === "building"
                    ? "Fixtures (HVAC)"
                    : "All Ownership"}
                </div>
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl">
              {[
                { value: "all", label: "All Ownership" },
                { value: "pamo", label: "Non-tech (PAMO)" },
                { value: "it", label: "Tech (IT)" },
                { value: "building", label: "Fixtures (HVAC)" },
              ].map((o) => {
                const active = (scopeFilter || "all") === o.value;
                return (
                  <DropdownMenuItem
                    key={o.value}
                    onClick={() => setScopeFilter(o.value)}
                    className="text-sm font-medium"
                  >
                    <Check className={cn("mr-2 h-3 w-3", active ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EquipmentTable
        equipment={equipment}
        loading={loading}
        stats={stats}
        selectedIds={selectedIds}
        isAllPagesSelected={isAllPagesSelected}
        allVisibleIds={allVisibleIds}
        isPageSelected={isPageSelected}
        expandedGroups={expandedGroups}
        toggleExpand={toggleExpand}
        handleSelectAll={handleSelectAll}
        handleSelectGroup={handleSelectGroup}
        openEdit={openEdit}
        openAssign={openAssign}
        confirmDecommission={confirmDecommission}
        setIsAllPagesSelected={setIsAllPagesSelected}
        setSelectedIds={setSelectedIds}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
      />

      {/* EDIT + ADD DIALOGS */}
      <EditEquipmentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        equipmentTypes={equipmentTypes}
        statusTypes={statusTypes}
        confirmDecommission={confirmDecommission}
        handleSaveEdit={handleSaveEdit}
        editLoading={editLoading}
        editTypeSearchOpen={editTypeSearchOpen}
        setEditTypeSearchOpen={setEditTypeSearchOpen}
      />
      <AssignEquipmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        item={assigningItem}
        mode={assignMode}
        facilities={facilities}
        loading={assignLoading}
        onSubmit={handleAssignSubmit}
      />
      <AddEquipmentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        newItem={newItem}
        setNewItem={setNewItem}
        equipmentTypes={equipmentTypes}
        isAddingNewType={isAddingNewType}
        setIsAddingNewType={setIsAddingNewType}
        newTypeName={newTypeName}
        setNewTypeName={setNewTypeName}
        handleAddNewType={handleAddNewType}
        typeSubmitLoading={typeSubmitLoading}
        modalTypeSearchOpen={modalTypeSearchOpen}
        setModalTypeSearchOpen={setModalTypeSearchOpen}
        isOtherSelected={isOtherSelected}
        handleAdd={handleAdd}
        addLoading={addLoading}
        addAttempted={addAttempted}
      />
      {/* BULK ACTIONS BAR */}
      {(selectedIds.length > 0 || isAllPagesSelected) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#050d36] border border-[#0072bc]/30 rounded-2xl p-2 pl-6 pr-2 shadow-2xl flex items-center gap-6 backdrop-blur-xl">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#0072bc]">Action Required</span>
              <span className="text-xs font-bold text-white uppercase">
                {isAllPagesSelected ? `All ${stats.total}` : selectedIds.length} Assets Selected
              </span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex gap-2">
              <Button 
                onClick={() => setBulkStatusDialogOpen(true)}
                className="bg-[#0072bc]/10 hover:bg-[#0072bc] text-[#0072bc] hover:text-white text-[10px] font-black uppercase h-10 px-4 rounded-xl border border-[#0072bc]/20 transition-all gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Update Status
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="text-[10px] font-black uppercase h-10 px-4 rounded-xl gap-2 shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> 
                {isAllPagesSelected ? `Decommission All ${stats.total} Assets` : `Decommission Selected (${selectedIds.length})`}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedIds([])}
                className="text-white hover:bg-white/5 text-[10px] font-black uppercase h-10 px-4 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkActionDialogs
        selectedIds={selectedIds}
        statusTypes={statusTypes}
        bulkStatusDialogOpen={bulkStatusDialogOpen}
        setBulkStatusDialogOpen={setBulkStatusDialogOpen}
        selectedBulkStatus={selectedBulkStatus}
        setSelectedBulkStatus={setSelectedBulkStatus}
        handleBulkStatusUpdate={handleBulkStatusUpdate}
        bulkUpdateLoading={bulkUpdateLoading}
        bulkDeleteDialogOpen={bulkDeleteDialogOpen}
        setBulkDeleteDialogOpen={setBulkDeleteDialogOpen}
        handleBulkDecommission={handleBulkDecommission}
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        handleDelete={handleDelete}
        reduceDialogOpen={reduceDialogOpen}
        setReduceDialogOpen={setReduceDialogOpen}
        reducingItem={reducingItem}
        reduceCount={reduceCount}
        setReduceCount={setReduceCount}
        handleReduceQuantity={handleReduceQuantity}
        reduceLoading={reduceLoading}
      />

    </div>
  );
};

export default Equipment;