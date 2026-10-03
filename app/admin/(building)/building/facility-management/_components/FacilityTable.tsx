"use client"

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Hammer, Clock, ArrowUp, ArrowDown, ArrowUpDown, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

type SortCol = "floor" | "roomNumber" | "name" | "capacity" | "status" | "type";

interface FacilityTableProps {
  filtered: any[];
  selectedRooms: string[];
  setSelectedRooms: React.Dispatch<React.SetStateAction<string[]>>;
  sortBy: SortCol;
  sortDir: "asc" | "desc";
  setSortBy: (col: SortCol) => void;
  setSortDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  onEdit: (f: any) => void;
  onDelete: (id: string) => void;
  onManagePhotos: (f: any) => void;
}

export function FacilityTable({
  filtered,
  selectedRooms,
  setSelectedRooms,
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
  onEdit,
  onDelete,
  onManagePhotos,
}: FacilityTableProps) {
  return (
    <Card className="border-border/50 bg-card rounded-[2.5rem] overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-12 px-6"><Checkbox checked={selectedRooms.length === filtered.length && filtered.length > 0} onCheckedChange={(checked) => setSelectedRooms(checked ? filtered.map(f => f.id) : [])} /></TableHead>
            {(["roomNumber", "name", "type", "floor", "capacity", "status"] as const).map((col) => {
              const labels: Record<string, string> = { roomNumber: "Room No.", name: "Name", type: "Type", floor: "Floor", capacity: "Capacity", status: "Status" };
              const active = sortBy === col;
              return (
                <TableHead key={col} className={cn("text-sm font-medium cursor-pointer select-none hover:text-foreground transition-colors", active ? "text-sti-blue" : "")} onClick={() => { if (active) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortDir("asc"); } }}>
                  <span className="flex items-center gap-1">
                    {labels[col]}
                    {active ? (sortDir === "asc" ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-20" />}
                  </span>
                </TableHead>
              );
            })}
            <TableHead className="text-right text-sm font-medium px-6">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(f => (
            <TableRow key={f.id} className={cn("hover:bg-muted/30 transition-colors", f.status?.startsWith("Restricted") && "bg-muted/40 opacity-80")}>
              <TableCell className="px-6"><Checkbox checked={selectedRooms.includes(f.id)} onCheckedChange={(checked) => setSelectedRooms(prev => checked ? [...prev, f.id] : prev.filter(id => id !== f.id))} /></TableCell>
              <TableCell className="font-black text-xs text-sti-blue">{f.roomNumber}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{f.name}</span>
                  {f.status?.startsWith("Restricted") && <span className="text-xs text-red-600 font-medium flex items-center gap-1 mt-0.5"><Clock className="w-2 h-2" /> Restricted</span>}
                </div>
              </TableCell>
              <TableCell><span className="text-xs font-medium text-muted-foreground">{f.facilityTypeName}</span></TableCell>
              <TableCell className="text-sm text-muted-foreground">{f.floorName}</TableCell>
              <TableCell className="text-xs font-bold">{f.capacity} Pax</TableCell>
              <TableCell>
                <Badge className={cn("text-xs font-medium border-none px-2",
                  f.status === "Available" ? "bg-emerald-500/10 text-emerald-600" :
                  f.status?.startsWith("Restricted") ? "bg-red-500 text-white" : "bg-green-500/10 text-green-600"
                )}>{f.status}</Badge>
              </TableCell>
              <TableCell className="text-right px-6">
                <div className="flex justify-end gap-1 text-muted-foreground opacity-70 hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:text-sti-blue hover:bg-blue-50" onClick={() => onEdit(f)} title="Manage Equipment"><Hammer className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:text-amber-600 hover:bg-amber-50" onClick={() => onManagePhotos(f)} title="Manage Photos"><Camera className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:text-foreground" onClick={() => onEdit(f)} title="Edit Facility"><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:text-red-500 hover:bg-red-50" onClick={() => onDelete(f.id)} title="Delete Facility"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
