"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface BulkActionDialogsProps {
  selectedIds: string[];
  statusTypes: any[];
  bulkStatusDialogOpen: boolean;
  setBulkStatusDialogOpen: (v: boolean) => void;
  selectedBulkStatus: string;
  setSelectedBulkStatus: (v: string) => void;
  handleBulkStatusUpdate: () => void;
  bulkUpdateLoading: boolean;
  bulkDeleteDialogOpen: boolean;
  setBulkDeleteDialogOpen: (v: boolean) => void;
  handleBulkDecommission: () => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (v: boolean) => void;
  handleDelete: () => void;
  reduceDialogOpen: boolean;
  setReduceDialogOpen: (v: boolean) => void;
  reducingItem: any;
  reduceCount: number;
  setReduceCount: (n: number) => void;
  handleReduceQuantity: () => void;
  reduceLoading: boolean;
}

export function BulkActionDialogs({
  selectedIds,
  statusTypes,
  bulkStatusDialogOpen,
  setBulkStatusDialogOpen,
  selectedBulkStatus,
  setSelectedBulkStatus,
  handleBulkStatusUpdate,
  bulkUpdateLoading,
  bulkDeleteDialogOpen,
  setBulkDeleteDialogOpen,
  handleBulkDecommission,
  deleteDialogOpen,
  setDeleteDialogOpen,
  handleDelete,
  reduceDialogOpen,
  setReduceDialogOpen,
  reducingItem,
  reduceCount,
  setReduceCount,
  handleReduceQuantity,
  reduceLoading,
}: BulkActionDialogsProps) {
  return (
    <>
      {/* Bulk status update */}
<Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none bg-card shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl">Bulk Status <span className="text-[#0072bc]">Update</span></DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-muted-foreground mt-1">
              Updating {selectedIds.length} assets at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="bulk-status-select" className="text-[10px] font-black uppercase">Select New Status</Label>
              <Select value={selectedBulkStatus} onValueChange={setSelectedBulkStatus}>
                <SelectTrigger id="bulk-status-select" className="rounded-2xl font-bold h-12 uppercase text-[10px]">
                  <SelectValue placeholder="Choose status..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none">
                  {statusTypes?.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)} className="text-[10px] font-bold uppercase">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleBulkStatusUpdate} 
              disabled={bulkUpdateLoading || !selectedBulkStatus} 
              className="w-full bg-[#0072bc] hover:bg-[#050d36] rounded-2xl font-black h-12 uppercase transition-all shadow-md"
            >
              {bulkUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : `Update ${selectedIds.length} Assets`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
<AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none bg-card shadow-2xl max-w-md border border-white/5">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase text-xl flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" /> Confirm <span className="text-red-500">Decommissioning</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] font-bold uppercase text-muted-foreground leading-relaxed mt-2">
              You are about to remove <span className="text-foreground font-black underline">{selectedIds.length} assets</span>. This action cannot be easily undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-2xl font-black uppercase text-[10px] h-12 flex-1 border-border/60 hover:bg-muted/50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDecommission}
              disabled={bulkUpdateLoading}
              className="rounded-2xl font-black uppercase text-[10px] h-12 flex-1 bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              {bulkUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Decommission Items"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single delete */}
<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none bg-card shadow-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase text-xl">Confirm <span className="text-red-500">Deactivation</span></AlertDialogTitle>
            <AlertDialogDescription className="text-[10px] font-bold uppercase text-muted-foreground mt-2 leading-relaxed">
              Are you sure you want to remove this asset? It will be marked as inactive and removed from the availability list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-2xl font-black uppercase text-[10px] h-12 flex-1 border-border/60">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-2xl font-black uppercase text-[10px] h-12 flex-1 bg-red-500 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">Decommission Asset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reduce quantity */}
<Dialog open={reduceDialogOpen} onOpenChange={setReduceDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none bg-card shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl text-red-500">Decommission Units</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-muted-foreground mt-2 leading-relaxed">
              You are decommissioning units from the <strong>{reducingItem?.equipmentName}</strong> inventory.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reduce-quantity" className="text-[10px] font-black uppercase flex justify-between">
                Units to Decommission
                <span className="text-red-500">Max {reducingItem?.quantity}</span>
              </Label>
              <Input
                id="reduce-quantity"
                type="number"
                min="1" 
                max={reducingItem?.quantity}
                value={reduceCount}
                onChange={(e) => setReduceCount(Math.min(parseInt(e.target.value) || 0, reducingItem?.quantity || 0))}
                className="h-14 rounded-2xl bg-muted/50 border-none font-black text-xl text-center"
              />
            </div>
            
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex items-start gap-3">
              <div className="mt-1"><Trash2 className="w-4 h-4 text-red-500" /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-red-500">Impact Warning</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-relaxed">
                  Remaining inventory after removal: {Math.max(0, (reducingItem?.quantity || 0) - reduceCount)} units.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReduceDialogOpen(false)} className="rounded-2xl font-black uppercase text-[10px] h-12 flex-1">Cancel</Button>
            <Button 
              onClick={handleReduceQuantity} 
              disabled={reduceLoading || reduceCount <= 0}
              className="rounded-2xl font-black uppercase text-[10px] h-12 flex-1 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
            >
              {reduceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Decommission ${reduceCount} Units`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
