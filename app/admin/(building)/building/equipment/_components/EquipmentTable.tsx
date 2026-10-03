"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Archive, MapPin, ArrowRightLeft, Send, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import React from "react";
import { cn } from "@/lib/utils";
import { equipmentRowCapabilities } from "@/lib/equipment/row-capabilities";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  loading: boolean;
  totalItems: number;
  setCurrentPage: (updater: (prev: number) => number) => void;
}

function PaginationControls({
  currentPage,
  totalPages,
  loading,
  totalItems,
  setCurrentPage,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-2 py-2 bg-card border border-border/40 rounded-2xl">
      <div className="flex items-center gap-4">
        <p className="text-sm font-medium text-muted-foreground ml-4">
          Page <span className="text-foreground">{currentPage}</span> of <span className="text-foreground">{totalPages}</span>
        </p>
        <div className="h-4 w-px bg-border/40" />
        <p className="text-sm font-medium text-[#0072bc]/80">
          {totalItems} Items Total
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage === 1 || loading}
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          className="h-9 px-4 rounded-xl text-sm font-medium hover:bg-[#0072bc]/10 text-[#0072bc]"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-2" /> Prev
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage === totalPages || loading}
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          className="h-9 px-4 rounded-xl text-sm font-medium hover:bg-[#0072bc]/10 text-[#0072bc]"
        >
          Next <ChevronRight className="w-3.5 h-3.5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

interface EquipmentTableProps {
  equipment: any[];
  loading: boolean;
  stats: { total: number };
  selectedIds: string[];
  isAllPagesSelected: boolean;
  allVisibleIds: string[];
  isPageSelected: boolean;
  expandedGroups: Set<string>;
  toggleExpand: (id: string) => void;
  handleSelectAll: (checked: boolean) => void;
  handleSelectGroup: (ids: string[], checked: boolean) => void;
  openEdit: (item: any) => void;
  openAssign: (item: any) => void;
  confirmDecommission: (item: any) => void;
  setIsAllPagesSelected: (v: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (updater: (prev: number) => number) => void;
}

export function EquipmentTable({
  equipment,
  loading,
  stats,
  selectedIds,
  isAllPagesSelected,
  allVisibleIds,
  isPageSelected,
  expandedGroups,
  toggleExpand,
  handleSelectAll,
  handleSelectGroup,
  openEdit,
  openAssign,
  confirmDecommission,
  setIsAllPagesSelected,
  setSelectedIds,
  currentPage,
  totalPages,
  setCurrentPage,
}: EquipmentTableProps) {
  return (
    <>
      {/* TABLE */}
      <div className="space-y-4">
        {isPageSelected && stats.total > allVisibleIds.length && (
          <div className="bg-[#0072bc]/10 border border-[#0072bc]/20 rounded-2xl p-3 flex items-center justify-center gap-4">
            <p className="text-sm font-medium text-[#0072bc]">
              {isAllPagesSelected
                ? `All ${stats.total} assets are selected.`
                : `All ${allVisibleIds.length} assets on this page are selected.`}
            </p>
            {!isAllPagesSelected ? (
              <Button
                variant="ghost"
                onClick={() => setIsAllPagesSelected(true)}
                className="text-sm font-medium text-[#0072bc] hover:bg-[#0072bc]/10 h-7 px-4 rounded-lg underline"
              >
                Select all {stats.total} assets in inventory
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedIds([]);
                  setIsAllPagesSelected(false);
                }}
                className="text-sm font-medium text-[#0072bc] hover:bg-[#0072bc]/10 h-7 px-4 rounded-lg underline"
              >
                Clear Selection
              </Button>
            )}
          </div>
        )}

        <Card className="border-border/50 bg-card rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-none">
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-12 pl-4">
                <Checkbox
                  checked={isPageSelected}
                  onCheckedChange={handleSelectAll}
                  className="rounded-md border-border/60"
                />
              </TableHead>
              <TableHead className="text-sm font-medium h-12">Code</TableHead>
              <TableHead className="text-sm font-medium">Equipment Detail</TableHead>
              <TableHead className="text-sm font-medium">Status</TableHead>
              <TableHead className="text-sm font-medium">Type</TableHead>
              <TableHead className="text-sm font-medium">Location</TableHead>
              <TableHead className="text-sm font-medium">Quantity</TableHead>
              <TableHead className="text-right text-sm font-medium pr-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mx-auto animate-spin" /></TableCell></TableRow>
            ) : equipment.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">No equipment found.</TableCell></TableRow>
            ) : (
              equipment.map((group: any) => (
                <React.Fragment key={group.ids[0]}>
                  <TableRow className={cn(
                    "hover:bg-muted/20 border-border/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    group.ids.every((id: string) => selectedIds.includes(id)) && "bg-[#0072bc]/5 hover:bg-[#0072bc]/10",
                    expandedGroups.has(group.ids[0]) && "bg-muted/10 border-b-0"
                  )}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedGroups.has(group.ids[0])}
                    onClick={() => toggleExpand(group.ids[0])}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(group.ids[0]) } }}
                  >
                    <TableCell className="pl-4 pr-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedGroups.has(group.ids[0]) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </Button>
                    </TableCell>
                    <TableCell className="pl-0">
                      <Checkbox
                        checked={group.ids.every((id: string) => selectedIds.includes(id))}
                        onCheckedChange={(checked) => handleSelectGroup(group.ids, !!checked)}
                        className="rounded-md border-border/60"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm text-[#0072bc]">{group.displayCode}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{group.equipmentName}</span>
                        <span className="text-xs text-muted-foreground">{group.brand || "Generic"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <Badge className={cn("text-xs font-medium border-none px-2 py-0.5",
                            group.currentStatusName === "Available" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                            group.currentStatusName === "In-Use" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        )}>{group.currentStatusName}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{group.equipmentTypeName}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1.5 w-fit px-2 py-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{group.assignedFacilityName || "Storage"}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-[#0072bc]">
                        {group.quantity} Units
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-1">
                        {(() => {
                          // Building Admin sees ALL equipment; what it may do to a
                          // row is gated by the type's managed_by scope — HVAC is
                          // BA-owned (edit/delete), PAMO is a direct move (assign),
                          // IT is a request the IT Admin approves. The server
                          // enforces the same boundary on every write.
                          const caps = equipmentRowCapabilities(group.managedBy)
                          return (
                            <>
                              {caps.canEdit && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(group); }} className="h-9 w-9 text-[#0072bc] hover:bg-[#0072bc]/10 rounded-xl" aria-label={`Edit ${group.displayCode}`}><Pencil className="w-4 h-4" /></Button>}
                              {caps.canDelete && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); confirmDecommission(group); }} className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl" aria-label={`Deactivate ${group.displayCode}`}><Archive className="w-4 h-4" /></Button>}
                              {caps.canAssign && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openAssign(group); }} className="h-9 gap-1.5 px-3 text-xs font-semibold text-[#0072bc] hover:bg-[#0072bc]/10 rounded-xl" aria-label={`Assign ${group.displayCode} to a facility`}><ArrowRightLeft className="w-4 h-4" /> Assign</Button>}
                              {caps.canRequestAssign && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openAssign(group); }} className="h-9 gap-1.5 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl" aria-label={`Request assignment for ${group.displayCode}`}><Send className="w-4 h-4" /> Request assign</Button>}
                            </>
                          )
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedGroups.has(group.ids[0]) && (
                    <TableRow className="bg-muted/5 border-t-0">
                      <TableCell colSpan={9} className="p-0">
                        <div className="px-12 py-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-4">
                               <h4 className="text-xs font-medium text-muted-foreground">Individual Assets ({group.ids.length})</h4>
                               <div className="space-y-2">
                                 <div className="p-4 bg-card rounded-2xl border border-border/40 shadow-sm">
                                   <p className="text-xs font-medium text-[#0072bc] mb-1">Asset Configuration</p>
                                   <div className="grid grid-cols-2 gap-y-2 text-sm">
                                     <span className="text-muted-foreground">Model:</span> <span>{group.model || "N/A"}</span>
                                     <span className="text-muted-foreground">Serial:</span> <span>{group.serialNumber || "N/A"}</span>
                                     <span className="text-muted-foreground">Assigned:</span> <span className="text-emerald-600 dark:text-emerald-400">{group.assignedFacilityName || "Storage"}</span>
                                   </div>
                                 </div>
                               </div>
                            </div>
                            <div className="space-y-4">
                               <h4 className="text-xs font-medium text-muted-foreground">Asset Codes</h4>
                               <div className="flex flex-wrap gap-2">
                                 <Badge variant="outline" className="text-xs font-medium border-[#0072bc]/20 text-[#0072bc]">
                                   {group.displayCode}
                                 </Badge>
                                 {group.quantity > 1 && <span className="text-xs text-muted-foreground italic">Grouped by Type & Status</span>}
                               </div>
                            </div>
                            <div className="space-y-4">
                               <h4 className="text-xs font-medium text-muted-foreground">Usage Context</h4>
                               <div className="p-4 bg-[#0072bc]/5 rounded-2xl border border-[#0072bc]/10">
                                 <p className="text-sm text-muted-foreground leading-relaxed">
                                   This equipment is currently <span className="text-[#0072bc] font-medium">{group.currentStatusName}</span>.
                                   {group.assignedFacilityName ? ` It has been assigned to ${group.assignedFacilityName} for facility-specific operations.` : " It is currently held in central storage/inventory."}
                                 </p>
                               </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
        </Card>
      </div>

      {/* BOTTOM PAGINATION */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        loading={loading}
        totalItems={stats.total}
        setCurrentPage={setCurrentPage}
      />
    </>
  );
}
