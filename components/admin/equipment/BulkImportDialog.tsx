"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Plus, Trash2, Loader2, Download, FileUp, ListPlus, Upload,
  Table as TableIcon, ChevronsUpDown, FileText, AlertTriangle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { useEquipmentBulkImport } from "@/hooks/admin/equipment/useEquipmentBulkImport";

interface BulkImportDialogProps {
  /** Controller from useEquipmentBulkImport — owns all state + handlers. */
  bulk: ReturnType<typeof useEquipmentBulkImport>;
  equipmentTypes: { id: string; name: string }[];
  /** Override the trigger button classes so it can match each page's toolbar. */
  triggerClassName?: string;
}

/**
 * Per-row type picker. Holds its OWN search string in React state — the previous
 * implementation stashed it on `window`, which was shared across every row's
 * combobox and produced the wrong "Add …" label when two were open.
 */
function TypeCombobox({
  value,
  known,
  onSelect,
}: {
  value: string;
  known: { id: string; name: string }[];
  onSelect: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-8 w-full justify-between text-[10px] font-bold border border-white/10 rounded-lg px-2 hover:bg-white/10">
          {value || "Select..."}
          <ChevronsUpDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 rounded-xl border-none shadow-2xl bg-sti-navy-light">
        <Command className="bg-sti-navy-light">
          <CommandInput
            placeholder="Search or type new..."
            className="h-9 text-[10px] text-white"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="p-2">
              <Button
                variant="ghost"
                className="w-full text-[10px] font-black uppercase text-sti-blue justify-start overflow-hidden"
                disabled={!search.trim()}
                onClick={() => search.trim() && onSelect(search.trim())}
              >
                <Plus className="w-3 h-3 mr-2 shrink-0" />
                <span className="truncate">Add &quot;{search}&quot;</span>
              </Button>
            </CommandEmpty>
            <CommandGroup className="text-white">
              {known.map((t) => (
                <CommandItem
                  key={t.id}
                  onSelect={() => onSelect(t.name)}
                  className="text-[10px] font-bold uppercase hover:bg-white/10"
                >
                  {t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function BulkImportDialog({ bulk, equipmentTypes, triggerClassName }: BulkImportDialogProps) {
  const {
    open, setOpen, activeTab, setActiveTab, importData, importLoading,
    invalidCount, totalQuantity, rowIssues,
    handleFileUpload, downloadTemplate, handleManualEntryAdd, handleBulkSubmit,
    updateImportItem, removeImportItem,
  } = bulk;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "font-black uppercase text-[10px] h-10 px-4 rounded-xl border-dashed border-border/60 gap-2",
            triggerClassName,
          )}
        >
          <FileUp className="w-3.5 h-3.5 text-sti-blue" /> Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none bg-sti-navy text-white">
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="text-2xl font-black uppercase text-white flex items-center gap-3">
            <Upload className="w-6 h-6 text-sti-blue" /> Bulk Equipment Registration
          </DialogTitle>
          <DialogDescription className="text-[11px] text-blue-200/60 font-bold uppercase">
            Import multiple assets via Excel or manual spreadsheet entry — codes are assigned automatically
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-8 pb-4">
            <TabsList className="bg-white/5 p-1 rounded-xl w-full max-w-md border border-white/5">
              <TabsTrigger value="upload" className="rounded-lg text-[10px] font-black uppercase flex-1 data-[state=active]:bg-sti-blue data-[state=active]:text-white">
                <FileUp className="w-3 h-3 mr-2" /> Upload File
              </TabsTrigger>
              <TabsTrigger value="review" className="rounded-lg text-[10px] font-black uppercase flex-1 data-[state=active]:bg-sti-blue data-[state=active]:text-white">
                <ListPlus className="w-3 h-3 mr-2" />
                Review &amp; Edit
                {importData.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-md">
                    {importData.length} Types | {totalQuantity} Total
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="upload" className="h-full mt-0 p-8 flex flex-col items-center justify-center gap-6">
              <label className="w-full max-w-lg p-12 border-2 border-dashed border-white/10 rounded-3xl bg-white/5 flex flex-col items-center gap-4 text-center group hover:border-sti-blue/50 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Upload equipment spreadsheet"
                />
                <div className="w-16 h-16 bg-sti-blue/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-sti-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-white">Click or drag Excel file</h3>
                  <p className="text-[10px] text-blue-200/40 font-bold uppercase">Supported formats: .xlsx, .xls, .csv</p>
                </div>
              </label>

              <div className="flex flex-col items-center gap-3">
                <p className="text-[11px] text-blue-200/60 font-bold uppercase">First time? Download our template</p>
                <Button variant="ghost" onClick={downloadTemplate} className="text-sti-blue hover:bg-sti-blue/10 text-[10px] font-black uppercase gap-2 h-10 px-6 rounded-xl">
                  <Download className="w-4 h-4" /> Download Template
                </Button>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-blue-200/20 font-bold uppercase">--- OR ---</span>
                </div>
                <Button onClick={handleManualEntryAdd} variant="outline" className="border-white/10 text-white hover:bg-white/5 text-[10px] font-black uppercase h-10 px-6 rounded-xl gap-2">
                  <TableIcon className="w-4 h-4" /> Start with Empty Table
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="review" className="h-full mt-0 flex flex-col overflow-hidden">
              {/* SUMMARY HEADER */}
              <div className="px-8 py-4 flex items-center justify-between border-b border-white/5 bg-white/2">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-blue-200/40">Unique Rows</span>
                    <span className="text-2xl font-black text-white tracking-tighter">{importData.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-sti-blue">Total Quantity</span>
                    <span className="text-2xl font-black text-white tracking-tighter">{totalQuantity}</span>
                  </div>
                </div>
                {invalidCount > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase text-red-400/80 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> {invalidCount} Row{invalidCount === 1 ? "" : "s"} Need Fixing
                    </span>
                    <span className="text-[10px] font-bold text-blue-200/40 uppercase">Highlighted below</span>
                  </div>
                ) : (
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase text-emerald-500/60">Ready to Process</span>
                    <span className="text-[10px] font-bold text-blue-200/40 uppercase">Review entries below</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden px-8 py-6">
                <ScrollArea className="h-full rounded-2xl border border-white/5 bg-white/5">
                  <Table>
                    <TableHeader className="bg-sti-navy-light sticky top-0 z-10">
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60 w-12 text-center">#</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60 min-w-[200px]">Name</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60 min-w-[150px]">Type</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60 w-32">Brand</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60 w-40">Serial #</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60 w-24">Qty</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-blue-200/60">Notes</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center text-[10px] font-bold text-blue-200/40 uppercase">No data to review. Upload a file or add rows.</TableCell>
                        </TableRow>
                      ) : (
                        importData.map((item, idx) => {
                          const issues = rowIssues(item);
                          const hasError = issues.errors.length > 0;
                          const isNewType = issues.warnings.some((w) => w.startsWith("New type"));
                          return (
                            <TableRow
                              key={idx}
                              className={cn(
                                "border-white/5 hover:bg-white/5 group",
                                hasError && "bg-red-500/10 hover:bg-red-500/15",
                              )}
                            >
                              <TableCell className="text-center">
                                {hasError ? (
                                  <span title={issues.errors.join(" · ")} className="inline-flex text-red-400">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-blue-200/20">{idx + 1}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.equipmentName}
                                  onChange={(e) => updateImportItem(idx, "equipmentName", e.target.value)}
                                  className={cn(
                                    "h-8 rounded-lg bg-transparent border-white/10 text-[10px] font-bold focus:bg-white/10 transition-colors",
                                    !item.equipmentName?.trim() && "border-red-500/40",
                                  )}
                                  placeholder="Asset name"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <TypeCombobox
                                    value={item.equipmentType}
                                    known={equipmentTypes}
                                    onSelect={(name) => updateImportItem(idx, "equipmentType", name)}
                                  />
                                  {isNewType && (
                                    <Badge className="bg-amber-400/15 text-amber-300 text-[8px] font-black uppercase border-none py-0 px-1.5 gap-1 w-fit">
                                      <Sparkles className="w-2.5 h-2.5" /> New type
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.brand}
                                  onChange={(e) => updateImportItem(idx, "brand", e.target.value)}
                                  className="h-8 rounded-lg bg-transparent border-white/10 text-[10px] font-bold focus:bg-white/10"
                                  placeholder="Brand"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.serialNumber}
                                  onChange={(e) => updateImportItem(idx, "serialNumber", e.target.value)}
                                  className="h-8 rounded-lg bg-transparent border-white/10 text-[10px] font-bold focus:bg-white/10"
                                  placeholder="Serial #"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateImportItem(idx, "quantity", e.target.value)}
                                  className={cn(
                                    "h-8 rounded-lg bg-transparent border-white/10 text-[10px] font-bold focus:bg-white/10 w-20",
                                    (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) && "border-red-500/40",
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className={cn(
                                        "h-8 w-8 p-0 rounded-lg transition-colors",
                                        item.notes ? "text-sti-blue bg-sti-blue/10" : "text-blue-200/20 hover:bg-white/5",
                                      )}
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-4 rounded-2xl border-none shadow-2xl bg-sti-navy-light z-50">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase text-blue-200/60 flex items-center gap-2">
                                          <FileText className="w-3 h-3" /> Asset Notes
                                        </h4>
                                        {item.notes && (
                                          <Badge className="bg-sti-blue/20 text-sti-blue text-[8px] font-black uppercase border-none py-0 px-2">Saved</Badge>
                                        )}
                                      </div>
                                      <Textarea
                                        value={item.notes}
                                        onChange={(e) => updateImportItem(idx, "notes", e.target.value)}
                                        placeholder="Enter asset condition, location details, or warranty info..."
                                        className="min-h-[120px] bg-white/5 border-white/10 text-xs font-bold text-white placeholder:text-white/10 rounded-xl focus:ring-sti-blue resize-none"
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => removeImportItem(idx)} className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-500 text-blue-200/20" aria-label={`Remove row ${idx + 1}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="p-8 border-t border-white/5 bg-sti-navy">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={handleManualEntryAdd}
                    className="text-[10px] font-black uppercase text-sti-blue hover:bg-sti-blue/10 rounded-xl"
                  >
                    <Plus className="w-3 h-3 mr-2" /> Add Row
                  </Button>
                  <div className="flex items-center gap-3">
                    {invalidCount > 0 && (
                      <span className="text-[10px] font-bold uppercase text-red-400/80 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> {invalidCount} to fix
                      </span>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setOpen(false)}
                      className="border-white/10 text-white rounded-2xl h-12 px-8 font-black uppercase text-[11px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleBulkSubmit}
                      disabled={importLoading || importData.length === 0 || invalidCount > 0}
                      className="rounded-2xl bg-sti-blue hover:bg-sti-navy font-black h-12 uppercase px-8 shadow-lg shadow-sti-blue/20 transition-all disabled:opacity-50"
                    >
                      {importLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        `Register ${totalQuantity} Asset${totalQuantity === 1 ? "" : "s"}`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
