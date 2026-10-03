"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EquipmentTypePicker } from "./EquipmentTypePicker";
import { AlertTriangle, Loader2, Plus, ArrowRightLeft, Send, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_VALUE = "__storage__";

interface FacilityPickerProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  facilities: { id: string; name: string }[];
  isRequest: boolean;
  disabled?: boolean;
}

export function FacilityPicker({
  id,
  value,
  onValueChange,
  facilities,
  isRequest,
  disabled = false,
}: FacilityPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedName =
    value === STORAGE_VALUE
      ? "Storage (Unassigned)"
      : facilities.find((f) => String(f.id) === value)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full rounded-xl font-medium h-11 text-sm justify-between px-3.5 border-input bg-background hover:bg-accent hover:text-accent-foreground text-left"
        >
          <span className={cn("truncate", !selectedName && "text-muted-foreground")}>
            {selectedName || "Type to search or select facility…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border bg-popover shadow-2xl"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search room or facility name…" className="h-10 text-sm" />
          <CommandList className="max-h-60 p-1">
            <CommandEmpty className="text-xs text-muted-foreground p-3 text-center">
              No matching facility found.
            </CommandEmpty>
            <CommandGroup>
              {!isRequest && (
                <CommandItem
                  value="storage unassigned"
                  onSelect={() => {
                    onValueChange(STORAGE_VALUE);
                    setOpen(false);
                  }}
                  className="text-sm font-medium rounded-lg cursor-pointer py-2 px-3.5"
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 text-sti-blue", value === STORAGE_VALUE ? "opacity-100" : "opacity-0")}
                  />
                  Storage (Unassigned)
                </CommandItem>
              )}
              {facilities.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.name} ${f.id}`}
                  onSelect={() => {
                    onValueChange(String(f.id));
                    setOpen(false);
                  }}
                  className="text-sm font-medium rounded-lg cursor-pointer py-2 px-3.5"
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 text-sti-blue", value === String(f.id) ? "opacity-100" : "opacity-0")}
                  />
                  {f.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface AssignEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The grouped row being moved (displayCode, equipmentName, quantity, ids, assignedFacilityName). */
  item: any;
  /** 'assign' = direct move (PAMO/non-tech); 'request' = assignment request IT approves (tech). */
  mode: "assign" | "request";
  facilities: { id: string; name: string }[];
  loading: boolean;
  onSubmit: (toFacilityId: string | null, reason: string) => void;
}

export function AssignEquipmentDialog({
  open,
  onOpenChange,
  item,
  mode,
  facilities,
  loading,
  onSubmit,
}: AssignEquipmentDialogProps) {
  const isRequest = mode === "request";
  const [facilityId, setFacilityId] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // Reset the form each time the dialog opens for a fresh row.
  useEffect(() => {
    if (open) {
      setFacilityId("");
      setReason("");
    }
  }, [open, item?.ids?.[0]]);

  const count = item?.ids?.length ?? item?.quantity ?? 1;
  // A request must target a real facility; a direct move may also return to Storage.
  const canSubmit = !loading && facilityId !== "" && (isRequest ? facilityId !== STORAGE_VALUE : true);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(facilityId === STORAGE_VALUE ? null : facilityId, reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border bg-card shadow-2xl max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-bold text-xl text-foreground">
            {isRequest ? "Request Equipment Assignment" : "Assign Equipment Location"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {isRequest
              ? "Tech equipment moves are reviewed and approved by the IT Administrator."
              : "Move this equipment to a target facility. Location updates apply immediately."}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4 px-6 py-2">
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground truncate">{item.equipmentName}</p>
                {count > 1 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                    {count} units
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-medium">{item.displayCode}</span>
                <span>·</span>
                <span>Currently in</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {item.assignedFacilityName || "Storage"}
                </span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assign-facility" className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{isRequest ? "Move to facility" : "Destination Facility"}</span>
                <span className="text-red-500 font-normal">*</span>
              </Label>
              <FacilityPicker
                id="assign-facility"
                value={facilityId}
                onValueChange={setFacilityId}
                facilities={facilities}
                isRequest={isRequest}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assign-reason" className="text-xs font-semibold text-foreground">
                Reason <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="assign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isRequest ? "Specify why this equipment needs to be moved..." : "e.g. Reassigned for AVR special setup"}
                className="rounded-xl text-sm font-normal min-h-[80px] resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="bg-muted/30 p-6 pt-4 rounded-b-2xl border-t border-border/40 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-1/3 rounded-xl font-medium h-11 text-sm border-input hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 bg-sti-blue hover:bg-sti-navy rounded-xl font-semibold h-11 transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRequest ? (
              <>
                <Send className="w-4 h-4" /> Submit Request
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" /> Assign Location
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  equipmentTypes: any[];
  statusTypes: any[];
  confirmDecommission: (item: any) => void;
  handleSaveEdit: () => void;
  editLoading: boolean;
  editTypeSearchOpen: boolean;
  setEditTypeSearchOpen: (v: boolean) => void;
}

export function EditEquipmentDialog({
  open,
  onOpenChange,
  editingItem,
  setEditingItem,
  equipmentTypes,
  statusTypes,
  confirmDecommission,
  handleSaveEdit,
  editLoading,
  editTypeSearchOpen,
  setEditTypeSearchOpen,
}: EditEquipmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border bg-card shadow-2xl max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-bold text-xl text-foreground">Edit Equipment Details</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Update name, type, and operating status for this inventory item.
          </DialogDescription>
        </DialogHeader>

        {editingItem && (
          <div className="space-y-4 px-6 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-equipment-name" className="text-xs font-semibold text-foreground">Equipment Name</Label>
              <Input
                id="edit-equipment-name"
                value={editingItem.equipmentName}
                onChange={(e) => setEditingItem({ ...editingItem, equipmentName: e.target.value })}
                className="rounded-xl font-medium h-11 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label id="edit-equipment-type-label" className="text-xs font-semibold text-foreground">Type</Label>
                <EquipmentTypePicker
                  id="edit-equipment-type"
                  labelledBy="edit-equipment-type-label"
                  value={editingItem.equipmentTypeId}
                  onValueChange={(v) => setEditingItem({ ...editingItem, equipmentTypeId: v })}
                  equipmentTypes={equipmentTypes}
                  open={editTypeSearchOpen}
                  onOpenChange={setEditTypeSearchOpen}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-equipment-status" className="text-xs font-semibold text-foreground">Status</Label>
                <Select
                  value={editingItem.currentStatusId}
                  onValueChange={(v) => setEditingItem({ ...editingItem, currentStatusId: v })}
                >
                  <SelectTrigger id="edit-equipment-status" className="rounded-xl font-medium h-11 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border shadow-xl">
                    {statusTypes?.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-sm font-medium">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2">
              <div className="h-px bg-border/50 w-full mb-3" />
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Inventory Lifecycle</Label>
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    confirmDecommission(editingItem);
                  }}
                  className="w-full border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-xl font-semibold h-11 transition-all flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" /> Decommission Units
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="bg-muted/30 p-6 pt-4 rounded-b-2xl border-t border-border/40 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-1/3 rounded-xl font-medium h-11 text-sm border-input hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            disabled={editLoading}
            className="flex-1 bg-sti-blue hover:bg-sti-navy rounded-xl font-semibold h-11 transition-all shadow-md"
          >
            {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newItem: any;
  setNewItem: (item: any) => void;
  equipmentTypes: any[];
  isAddingNewType: boolean;
  setIsAddingNewType: (v: boolean) => void;
  newTypeName: string;
  setNewTypeName: (v: string) => void;
  handleAddNewType: () => void;
  typeSubmitLoading: boolean;
  modalTypeSearchOpen: boolean;
  setModalTypeSearchOpen: (v: boolean) => void;
  isOtherSelected: boolean;
  handleAdd: () => void;
  addLoading: boolean;
  addAttempted: boolean;
}

export function AddEquipmentDialog({
  open,
  onOpenChange,
  newItem,
  setNewItem,
  equipmentTypes,
  isAddingNewType,
  setIsAddingNewType,
  newTypeName,
  setNewTypeName,
  handleAddNewType,
  typeSubmitLoading,
  modalTypeSearchOpen,
  setModalTypeSearchOpen,
  isOtherSelected,
  handleAdd,
  addLoading,
  addAttempted,
}: AddEquipmentDialogProps) {
  const nameHasError = addAttempted && !newItem.equipmentName.trim();
  const typeHasError = addAttempted && !newItem.equipmentTypeId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border bg-card shadow-2xl max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-bold text-xl text-foreground">Register New Equipment</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Add a new equipment asset or batch register items into inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-equipment-name" className="text-xs font-semibold text-foreground">
              Equipment Name <span className="text-red-500 font-normal">*</span>
            </Label>
            <Input
              id="new-equipment-name"
              placeholder="e.g. Epson Projector"
              value={newItem.equipmentName}
              onChange={(e) => setNewItem({ ...newItem, equipmentName: e.target.value })}
              aria-invalid={nameHasError}
              className={cn(
                "rounded-xl font-medium h-11 text-sm",
                nameHasError && "border-red-500 focus-visible:ring-red-500/30"
              )}
            />
            {nameHasError && <p className="text-xs font-medium text-red-500 pl-1">Equipment name is required.</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label id="new-equipment-type-label" className="text-xs font-semibold text-foreground">
                Equipment Type <span className="text-red-500 font-normal">*</span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingNewType(!isAddingNewType)}
                className="h-6 px-2 text-xs font-medium text-sti-blue hover:bg-sti-blue/10 rounded-lg"
              >
                {isAddingNewType ? "Cancel" : "Add New Type"}
              </Button>
            </div>

            {isAddingNewType ? (
              <div className="flex gap-2 mt-1 animate-in slide-in-from-top-2 duration-200">
                <Input
                  aria-label="New equipment type name"
                  placeholder="e.g. Anatomy Skeleton"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="rounded-xl font-medium h-11 flex-1 text-sm border-sti-blue/40"
                />
                <Button
                  onClick={handleAddNewType}
                  disabled={typeSubmitLoading}
                  className="rounded-xl bg-sti-blue h-11 w-11 p-0 shadow-sm shrink-0"
                >
                  {typeSubmitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <>
                <EquipmentTypePicker
                  id="new-equipment-type"
                  labelledBy="new-equipment-type-label"
                  value={newItem.equipmentTypeId}
                  onValueChange={(v) => setNewItem({ ...newItem, equipmentTypeId: v })}
                  equipmentTypes={equipmentTypes}
                  open={modalTypeSearchOpen}
                  onOpenChange={setModalTypeSearchOpen}
                />
                {typeHasError && <p className="text-xs font-medium text-red-500 pl-1 mt-1">Select an equipment type.</p>}

                {isOtherSelected && (
                  <div className="mt-3 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <Label
                      htmlFor="new-equipment-custom-type"
                      className="text-xs font-semibold text-amber-700 dark:text-amber-400"
                    >
                      Specify Custom Type
                    </Label>
                    <Input
                      id="new-equipment-custom-type"
                      placeholder="e.g. Anatomy Skeleton"
                      value={newItem.customTypeName}
                      onChange={(e) => setNewItem({ ...newItem, customTypeName: e.target.value })}
                      className="rounded-xl font-medium h-11 text-sm border-amber-500/40"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-equipment-quantity" className="text-xs font-semibold text-foreground">
              Quantity (Batch Register)
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="new-equipment-quantity"
                type="number"
                min="1"
                max="100"
                placeholder="1"
                value={newItem.quantity}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    quantity: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)),
                  })
                }
                className="rounded-xl font-medium h-11 w-28 text-sm"
              />
              <p className="text-xs font-medium text-muted-foreground leading-tight">
                Enter &gt;1 to register multiple identical assets at once.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-6 pt-4 rounded-b-2xl border-t border-border/40 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-1/3 rounded-xl font-medium h-11 text-sm border-input hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={addLoading}
            className="flex-1 bg-sti-blue hover:bg-sti-navy rounded-xl font-semibold h-11 transition-all shadow-md"
          >
            {addLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Registration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
