"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The subset of a per-unit equipment record this list renders. A full
 * `BuildingEquipment` is structurally assignable to it, so callers can pass the
 * result of `getUnitsForFacility` directly.
 */
export interface AssignedEquipmentUnit {
  id: string
  equipmentCode: string | null
  equipmentName: string
  equipmentTypeId: string
  equipmentTypeName: string
  brand: string | null
  model: string | null
  currentStatusName: string
}

interface AssignedEquipmentListProps {
  /** Per-unit equipment currently assigned to the facility (ungrouped). */
  assignedUnits: AssignedEquipmentUnit[]
  /** Units still available in storage, keyed by equipmentTypeId. */
  availableCountByType: Record<string, number>
  /** Remove a single physical unit from the facility. */
  onUnassign: (id: string) => void
}

/** Semantic status-dot tone, matched on the human-readable status name. */
function statusTone(status: string): string {
  const s = status.toLowerCase()
  if (s.includes("mainten") || s.includes("repair")) return "bg-amber-500"
  if (s.includes("broken") || s.includes("retired") || s.includes("out")) return "bg-red-500"
  if (s.includes("use")) return "bg-sti-blue"
  return "bg-emerald-500" // available / working
}

/**
 * Per-unit "Managed Assets" list for the facility editor. Each physical unit is
 * its own row — asset code, brand + model, and status — grouped under its
 * equipment type with a "N assigned · M available in storage" footer. The parent
 * owns the empty state, so this renders nothing when there is nothing assigned.
 */
export function AssignedEquipmentList({
  assignedUnits,
  availableCountByType,
  onUnassign,
}: AssignedEquipmentListProps) {
  if (assignedUnits.length === 0) return null

  // Group per-unit rows under their equipment type, preserving first-seen order.
  const groups: { typeId: string; typeName: string; units: AssignedEquipmentUnit[] }[] = []
  const indexByType = new Map<string, number>()
  for (const u of assignedUnits) {
    let idx = indexByType.get(u.equipmentTypeId)
    if (idx === undefined) {
      idx = groups.length
      indexByType.set(u.equipmentTypeId, idx)
      groups.push({ typeId: u.equipmentTypeId, typeName: u.equipmentTypeName || u.equipmentName, units: [] })
    }
    groups[idx].units.push(u)
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const available = availableCountByType[group.typeId] ?? 0
        return (
          <div key={group.typeId} className="rounded-xl border border-border/40 bg-muted/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
              <span className="text-sm font-medium text-foreground capitalize tracking-tight">{group.typeName}</span>
              <span className="text-xs font-medium uppercase text-emerald-600 dark:text-emerald-400">Inventory</span>
            </div>

            <div className="divide-y divide-border/30">
              {group.units.map((u) => (
                <div key={u.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", statusTone(u.currentStatusName))} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-foreground truncate">{u.equipmentCode || "—"}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {[u.brand, u.model].filter(Boolean).join(" ") || u.equipmentName}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">{u.currentStatusName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onUnassign(u.id)}
                    aria-label={`Unassign ${u.equipmentCode || u.equipmentName}`}
                    className="h-6 w-6 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-t border-border/30 bg-muted/20">
              {group.units.length} assigned · {available} available in storage
            </div>
          </div>
        )
      })}
    </div>
  )
}
