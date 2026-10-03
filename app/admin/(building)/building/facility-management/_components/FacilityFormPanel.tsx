"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Plus, Hammer, Check, Settings2, Camera, Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AMENITY_NAME_MAX_LENGTH, AMENITY_NOTES_MAX_LENGTH, AMENITY_QUANTITY_MAX, normalizeAmenityName, prettifyAmenityName, isAmenityQuantityLocked } from "@/backend/admin/building/building.types";
import { AssignedEquipmentList } from "./AssignedEquipmentList";

const TYPES = ["Classroom", "Laboratory", "Multi-Purpose Hall", "Gymnasium", "Library", "Specialty"];

interface FacilityFormPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingFacility: any;
  availableFloors: string[];
  availableEquipment: any[];
  assignedEquipment: any[];
  formFloor: string;
  setFormFloor: (v: string) => void;
  formType: string;
  setFormType: (v: string) => void;
  specialtyName: string;
  setSpecialtyName: (v: string) => void;
  formCapacity: string;
  setFormCapacity: (v: string) => void;
  formStatus: string;
  setFormStatus: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formIsAvailableForRental: boolean;
  setFormIsAvailableForRental: (v: boolean) => void;
  formAmenityRows: any[];
  setFormAmenityRows: React.Dispatch<React.SetStateAction<any[]>>;
  amenityCatalog: any[];
  amenitySearch: string;
  setAmenitySearch: (v: string) => void;
  addAmenityOpen: boolean;
  setAddAmenityOpen: (v: boolean) => void;
  manualOverride: boolean;
  setManualOverride: (v: boolean) => void;
  manualId: string;
  setManualId: (v: string) => void;
  manualName: string;
  setManualName: (v: string) => void;
  metadata: { id: string; name: string };
  equipmentSearch: string;
  setEquipmentSearch: (v: string) => void;
  addEquipmentOpen: boolean;
  setAddEquipmentOpen: (v: boolean) => void;
  formAssignments: any[];
  setFormAssignments: React.Dispatch<React.SetStateAction<any[]>>;
  handleSaveFacility: () => void;
  handleUnassign: (ids: string[]) => void;
  onManagePhotos?: () => void;
  isSaving?: boolean;
}

export function FacilityFormPanel({
  open,
  onOpenChange,
  editingFacility,
  availableFloors,
  availableEquipment,
  assignedEquipment,
  formFloor,
  setFormFloor,
  formType,
  setFormType,
  specialtyName,
  setSpecialtyName,
  formCapacity,
  setFormCapacity,
  formStatus,
  setFormStatus,
  formDescription,
  setFormDescription,
  formIsAvailableForRental,
  setFormIsAvailableForRental,
  formAmenityRows,
  setFormAmenityRows,
  amenityCatalog,
  amenitySearch,
  setAmenitySearch,
  addAmenityOpen,
  setAddAmenityOpen,
  manualOverride,
  setManualOverride,
  manualId,
  setManualId,
  manualName,
  setManualName,
  metadata,
  equipmentSearch,
  setEquipmentSearch,
  addEquipmentOpen,
  setAddEquipmentOpen,
  formAssignments,
  setFormAssignments,
  handleSaveFacility,
  handleUnassign,
  onManagePhotos,
  isSaving,
}: FacilityFormPanelProps) {
  const usedAmenityKeys = new Set(formAmenityRows.map((r) => normalizeAmenityName(r.name || "")));
  const trimmedAmenitySearch = amenitySearch.trim();
  const filteredAmenityCatalog = amenityCatalog.filter((a: any) => {
    if (usedAmenityKeys.has(normalizeAmenityName(a.name))) return false;
    if (!trimmedAmenitySearch) return true;
    return prettifyAmenityName(a.name).toLowerCase().includes(trimmedAmenitySearch.toLowerCase())
      || a.name.toLowerCase().includes(trimmedAmenitySearch.toLowerCase());
  });
  const hasExactAmenityMatch = trimmedAmenitySearch
    ? amenityCatalog.some((a: any) => normalizeAmenityName(a.name) === normalizeAmenityName(trimmedAmenitySearch))
      || usedAmenityKeys.has(normalizeAmenityName(trimmedAmenitySearch))
    : true;

  const addAmenityRow = (name: string, isEquipmentBacked: boolean) => {
    setFormAmenityRows((prev) => [
      ...prev,
      { name, quantity: "1", notes: "", isEquipmentBacked, hasExistingRow: false },
    ]);
    setAmenitySearch("");
    setAddAmenityOpen(false);
  };

  const updateAmenityRow = (index: number, patch: Record<string, any>) => {
    setFormAmenityRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeAmenityRow = (index: number) => {
    setFormAmenityRows((prev) => prev.filter((_, i) => i !== index));
  };

  // How many units of each type are still in storage (for the "N available in
  // storage" footer). availableEquipment is the unassigned inventory, grouped.
  const availableCountByType = (availableEquipment as any[]).reduce(
    (acc: Record<string, number>, g: any) => {
      if (g.equipmentTypeId) acc[g.equipmentTypeId] = (acc[g.equipmentTypeId] || 0) + (g.quantity || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  // assignedEquipment is now per-unit (fetched with ?units=1). Filter by the
  // search box across name/type/code/brand.
  const equipmentQuery = equipmentSearch.trim().toLowerCase();
  const filteredAssignedUnits = (assignedEquipment as any[]).filter((u) =>
    !equipmentQuery ||
    (u.equipmentName || "").toLowerCase().includes(equipmentQuery) ||
    (u.equipmentTypeName || "").toLowerCase().includes(equipmentQuery) ||
    (u.equipmentCode || "").toLowerCase().includes(equipmentQuery) ||
    (u.brand || "").toLowerCase().includes(equipmentQuery),
  );
  const pendingUnitCount = (formAssignments as any[]).reduce((s: number, a: any) => s + (a.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[2.5rem] p-8 overflow-y-auto max-h-[90vh] bg-card">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-sti-blue">
              {editingFacility ? "Edit Facility" : "Add New Facility"}
            </DialogTitle>
            <div className="flex items-center gap-3">
              {editingFacility && onManagePhotos && (
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1.5" onClick={onManagePhotos}>
                  <Camera className="w-3.5 h-3.5" /> Photo Gallery
                </Button>
              )}
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                  <Settings2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase text-muted-foreground">Manual</span>
                  <Switch checked={manualOverride} onCheckedChange={setManualOverride} className="scale-75" />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label htmlFor="facility-floor" className="text-sm font-medium">Floor</Label><Select value={formFloor} onValueChange={setFormFloor}><SelectTrigger id="facility-floor" className="rounded-xl h-11"><SelectValue placeholder="Select floor..." /></SelectTrigger><SelectContent>{availableFloors.map(f => <SelectItem key={f} value={f} className="text-sm font-medium">{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label htmlFor="facility-type" className="text-sm font-medium">Facility Type</Label><Select value={formType} onValueChange={setFormType}><SelectTrigger id="facility-type" className="rounded-xl h-11"><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="text-sm font-medium">{t}</SelectItem>)}</SelectContent></Select></div>
          </div>

          {formType === "Specialty" && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="facility-specialty-name" className="text-sm font-medium">Specialty Name</Label>
              <Input id="facility-specialty-name" placeholder="e.g. Incubation Hub" value={specialtyName} onChange={e => setSpecialtyName(e.target.value)} className="rounded-xl h-11 font-bold" />
            </div>
          )}

          {manualOverride ? (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 animate-in zoom-in-95 duration-200">
              <div className="space-y-1">
                <Label htmlFor="facility-manual-id" className="text-xs font-medium uppercase text-yellow-600">Manual Room No.</Label>
                <Input id="facility-manual-id" maxLength={AMENITY_NAME_MAX_LENGTH} value={manualId} onChange={e => setManualId(e.target.value)} className="h-9 font-black text-sm uppercase rounded-lg border-yellow-500/30" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="facility-manual-name" className="text-xs font-medium uppercase text-yellow-600">Manual Display Name</Label>
                <Input id="facility-manual-name" maxLength={AMENITY_NAME_MAX_LENGTH} value={manualName} onChange={e => setManualName(e.target.value)} className="h-9 font-black text-xs uppercase rounded-lg border-yellow-500/30" />
              </div>
            </div>
          ) : (
            (formFloor && formType) ? (
              <div className="p-4 rounded-2xl bg-sti-blue/5 border border-sti-blue/10 flex justify-between items-center animate-in fade-in zoom-in duration-200">
                <div><p className="text-xs font-medium text-sti-blue uppercase">Auto Room No.</p><p className="text-lg font-black">{editingFacility && !formFloor ? editingFacility.roomNumber : metadata.id}</p></div>
                <div className="text-right"><p className="text-xs font-medium text-sti-blue uppercase">Auto Display Name</p><p className="text-sm font-medium">{editingFacility && !formFloor ? editingFacility.name : metadata.name}</p></div>
              </div>
            ) : (
              <p className="text-xs font-medium text-muted-foreground px-1">Select Floor &amp; Type to preview the Room No.</p>
            )
          )}

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label htmlFor="facility-capacity" className="text-sm font-medium">Capacity</Label><Input id="facility-capacity" type="number" min="1" value={formCapacity} onChange={e => setFormCapacity(e.target.value)} className="rounded-xl h-11 font-bold" /></div>
              <div className="space-y-1">
                <Label htmlFor="facility-status" className="text-sm font-medium">Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v)}>
                  <SelectTrigger id="facility-status" className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Available">Available</SelectItem><SelectItem value="Occupied">Occupied</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem><SelectItem value="Unavailable">Unavailable</SelectItem></SelectContent>
                </Select>
              </div>
          </div>


          {/* Amenities Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Amenities</Label>
              <Badge variant="outline" className="text-xs font-medium uppercase bg-blue-500/5 text-sti-blue border-blue-500/20">
                {formAmenityRows.length} {formAmenityRows.length === 1 ? "Amenity" : "Amenities"}
              </Badge>
            </div>

            <Popover open={addAmenityOpen} onOpenChange={(o) => { setAddAmenityOpen(o); if (!o) setAmenitySearch(""); }}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={addAmenityOpen}
                  className="h-10 px-4 rounded-xl border-dashed border-sti-blue/30 text-sm font-medium hover:bg-sti-blue/5 hover:text-sti-blue transition-all w-full justify-start"
                >
                  <Plus className="w-3.5 h-3.5 mr-2" />
                  Add Amenity
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0 rounded-2xl overflow-hidden shadow-2xl border-border/50" align="start">
                <Command className="bg-background" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search or type a new amenity..."
                    className="h-10 text-sm font-medium"
                    value={amenitySearch}
                    onValueChange={setAmenitySearch}
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty className="py-6 text-sm font-medium text-center text-muted-foreground">
                      No matching amenities.
                    </CommandEmpty>
                    {filteredAmenityCatalog.length > 0 && (
                      <CommandGroup heading="Existing Amenities">
                        {filteredAmenityCatalog.map((a: any) => (
                          <CommandItem
                            key={a.id}
                            value={a.name}
                            onSelect={() => addAmenityRow(a.name, !!a.isEquipmentBacked)}
                            className="text-sm font-medium py-3 px-4 cursor-pointer"
                          >
                            <span className="capitalize">{prettifyAmenityName(a.name)}</span>
                            {a.isEquipmentBacked && (
                              <Badge variant="secondary" className="ml-auto text-[7px] px-1.5 h-4 rounded-sm font-black uppercase bg-emerald-500/10 text-emerald-600 border-none">
                                Inventory
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {trimmedAmenitySearch && !hasExactAmenityMatch && (
                      <CommandGroup heading="Create New">
                        <CommandItem
                          value={`__create__${trimmedAmenitySearch}`}
                          onSelect={() => addAmenityRow(trimmedAmenitySearch, false)}
                          className="text-sm font-medium py-3 px-4 cursor-pointer text-sti-blue"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-2" />
                          Add &quot;{trimmedAmenitySearch}&quot; as new amenity
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="space-y-2">
              {formAmenityRows.map((row: any, idx: number) => {
                // Locked only once a real source='inventory' row exists for this
                // facility+amenity — NOT just because the amenity is catalog-linked.
                // Most existing facilities already have a source='manual' row for a
                // catalog-linked amenity (e.g. projector), and that must stay editable
                // until Phase 4 actually claims it.
                const locked = isAmenityQuantityLocked(row);
                return (
                <div key={idx} className="p-3 bg-muted/10 rounded-xl border border-border/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground capitalize tracking-tight flex-1">{prettifyAmenityName(row.name)}</span>
                    {row.isEquipmentBacked && (
                      <Badge variant="secondary" className="text-[7px] px-1.5 h-4 rounded-sm font-black uppercase bg-emerald-500/10 text-emerald-600 border-none shrink-0">
                        {locked ? "Inventory-Synced" : "Inventory-Linked"}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAmenityRow(idx)}
                      aria-label={`Remove ${prettifyAmenityName(row.name)}`}
                      className="h-6 px-2 text-xs font-medium uppercase text-red-500 hover:bg-red-50 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] font-medium uppercase text-muted-foreground">Quantity</Label>
                      {locked ? (
                        <div className="h-9 flex items-center px-3 rounded-lg bg-muted/30 border border-border/30 text-xs font-bold text-muted-foreground">
                          {`Auto: ${row.quantity} from inventory`}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          max={AMENITY_QUANTITY_MAX}
                          step={1}
                          value={row.quantity}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value) || 1;
                            updateAmenityRow(idx, { quantity: String(Math.min(AMENITY_QUANTITY_MAX, Math.max(1, raw))) });
                          }}
                          className="h-9 rounded-lg text-sm font-bold"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-medium uppercase text-muted-foreground">Notes (optional)</Label>
                      <Input
                        value={row.notes}
                        onChange={(e) => updateAmenityRow(idx, { notes: e.target.value.slice(0, AMENITY_NOTES_MAX_LENGTH) })}
                        maxLength={AMENITY_NOTES_MAX_LENGTH}
                        placeholder="e.g. Ceiling-mounted"
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
                );
              })}

              {formAmenityRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 bg-muted/5 rounded-2xl border border-dashed border-border/40">
                  <p className="text-sm text-muted-foreground">No amenities added</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="facility-description" className="text-sm font-medium">Brochure Description / Details</Label>
            <Textarea
              id="facility-description"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Facility details, features, rules, or rental specs to showcase in brochure..."
              className="rounded-xl text-xs min-h-[85px] resize-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3 bg-muted/10">
            <div className="space-y-0.5">
              <Label htmlFor="facility-available-for-rental" className="text-sm font-medium text-sti-blue">Available for Rental</Label>
              <p className="text-[9px] text-muted-foreground">Allows this facility to appear in the rental booking form</p>
            </div>
            <Switch id="facility-available-for-rental" checked={formIsAvailableForRental} onCheckedChange={setFormIsAvailableForRental} />
          </div>

          {/* Equipment Assignment Section */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-sti-blue">Managed Assets</Label>
                  <p className="text-[9px] text-muted-foreground font-medium">Equipments assigned to this facility</p>
              </div>
              <Badge variant="outline" className="text-xs font-medium uppercase bg-blue-500/5 text-sti-blue border-blue-500/20">
                  {assignedEquipment.length + pendingUnitCount} Items Total
              </Badge>
            </div>

            {/* Asset Search & Add Row */}
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground group-focus-within:text-sti-blue transition-colors" />
                  <Input
                      placeholder="Filter assigned assets..."
                      value={equipmentSearch}
                      onChange={(e) => setEquipmentSearch(e.target.value)}
                      className="h-10 pl-8 text-sm font-medium rounded-xl border-border/40 bg-muted/5 focus:bg-background transition-all"
                  />
              </div>

              <Popover open={addEquipmentOpen} onOpenChange={setAddEquipmentOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={addEquipmentOpen}
                          className="h-10 px-4 rounded-xl border-dashed border-sti-blue/30 text-sm font-medium hover:bg-sti-blue/5 hover:text-sti-blue transition-all"
                      >
                          <Plus className="w-3.5 h-3.5 mr-2" />
                          Add Equipment
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-border/50" align="end">
                      <Command className="bg-background">
                          <CommandInput placeholder="Search equipment..." className="h-10 text-sm font-medium" />
                          <CommandList className="max-h-[300px]">
                              <CommandEmpty className="py-6 text-sm font-medium text-center text-muted-foreground">No equipment found.</CommandEmpty>
                              <CommandGroup heading="Available Inventory">
                                  {availableEquipment.map(g => (
                                      <CommandItem
                                          key={g.ids[0]}
                                          value={g.equipmentName}
                                          onSelect={() => {
                                              const existing = formAssignments.find((a: any) => a.typeId === g.equipmentTypeId);
                                              if (existing) {
                                                  setFormAssignments(prev => prev.map((a: any) => a.typeId === g.equipmentTypeId ? { ...a, quantity: Math.min(a.quantity + 1, g.quantity) } : a));
                                              } else {
                                                  setFormAssignments(prev => [...prev, { typeId: g.equipmentTypeId, name: g.equipmentName, quantity: 1, max: g.quantity }]);
                                              }
                                              setAddEquipmentOpen(false);
                                          }}
                                          className="text-sm font-medium py-3 px-4 cursor-pointer"
                                      >
                                          <div className="flex flex-col gap-0.5">
                                              <span>{g.equipmentName}</span>
                                              <span className="text-[8px] font-bold text-muted-foreground">{g.quantity} Units Available</span>
                                          </div>
                                          <Check className={cn("ml-auto h-3 w-3", formAssignments.some((a: any) => a.typeId === g.equipmentTypeId) ? "opacity-100" : "opacity-0")} />
                                      </CommandItem>
                                  ))}
                              </CommandGroup>
                          </CommandList>
                      </Command>
                  </PopoverContent>
              </Popover>
            </div>

            {/* Assets List */}
            <div className="space-y-2 min-h-[100px]">
              {/* Current Assignments — one row per physical unit (code/brand/status) */}
              <AssignedEquipmentList
                assignedUnits={filteredAssignedUnits}
                availableCountByType={availableCountByType}
                onUnassign={(id) => handleUnassign([id])}
              />

              {/* Filtered Pending Assignments */}
              {formAssignments
                  .filter(a => a.name.toLowerCase().includes(equipmentSearch.toLowerCase()))
                  .map((a, idx) => (
                <div key={idx} className="group flex items-center justify-between p-3 bg-sti-blue/5 hover:bg-sti-blue/10 rounded-xl border border-sti-blue/20 animate-in slide-in-from-top-1 transition-all">
                  <div className="flex flex-col">
                    <span className="text-sm text-sti-blue capitalize tracking-tight">{a.name.toLowerCase()}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[7px] px-1 h-3.5 rounded-sm font-black uppercase bg-sti-blue text-white border-none">
                          {a.quantity} Units
                      </Badge>
                      <span className="text-xs font-medium text-sti-blue/60 uppercase">Pending Sync</span>
                    </div>
                  </div>
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormAssignments(prev => prev.filter((_, i) => i !== idx))}
                      className="h-7 px-3 text-xs font-medium uppercase text-red-500 hover:bg-red-50"
                  >
                      Cancel
                  </Button>
                </div>
              ))}

              {/* Empty State */}
              {assignedEquipment.length === 0 && formAssignments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 bg-muted/5 rounded-2xl border border-dashed border-border/40">
                      <Hammer className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No equipment assigned</p>
                  </div>
              )}

              {/* No Search Results */}
              {equipmentSearch &&
               filteredAssignedUnits.length === 0 &&
               formAssignments.filter(a => a.name.toLowerCase().includes(equipmentSearch.toLowerCase())).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6">
                      <Search className="w-6 h-6 text-muted-foreground/20 mb-1" />
                      <p className="text-xs font-bold text-muted-foreground uppercase">No matching assets found</p>
                  </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-12 px-6 rounded-2xl font-black uppercase text-[11px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveFacility}
            disabled={isSaving}
            className="flex-1 h-12 bg-sti-blue hover:bg-sti-blue-dark rounded-2xl font-black uppercase text-[11px] shadow-lg shadow-sti-blue/20 transition-all active:scale-95"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingFacility ? "Save Changes" : "Confirm Facility")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
