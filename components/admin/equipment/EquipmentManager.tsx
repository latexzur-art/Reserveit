'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Plus, Search, Archive, MapPin, Loader2, X } from 'lucide-react'
import { useBuildingEquipment } from '@/hooks/admin/building'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useEquipmentBulkImport } from '@/hooks/admin/equipment/useEquipmentBulkImport'
import { BulkImportDialog } from '@/components/admin/equipment/BulkImportDialog'

const emptyForm = { equipmentName: '', equipmentTypeId: '', customTypeName: '', currentStatusId: '', assignedFacilityId: '', brand: '', model: '', quantity: 1 }

interface EquipmentManagerProps {
  /** API base, e.g. /api/admin/pamo/equipment or /api/admin/users/equipment */
  basePath: string
  /** Highlighted first word of the H1 (rendered plain) */
  titleLead: string
  /** Accent word of the H1 (rendered in text-accent-brand) */
  titleAccent: string
  subtitle: string
  /** Show the Facility column (tech items live in rooms) */
  showFacility?: boolean
}

export function EquipmentManager({ basePath, titleLead, titleAccent, subtitle, showFacility = true }: EquipmentManagerProps) {
  const {
    equipment, equipmentTypes, statusTypes, loading,
    search, setSearch, assignmentFilter, setAssignmentFilter,
    createEquipment, updateEquipment, deleteEquipment, refresh,
  } = useBuildingEquipment(basePath)

  const bulk = useEquipmentBulkImport({ basePath, equipmentTypes, onImported: refresh })

  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({
    equipmentName: '',
    equipmentTypeId: '',
    customTypeName: '',
    currentStatusId: '',
    assignedFacilityId: '',
    brand: '',
    model: '',
  })
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetch('/api/admin/building/facilities?pageSize=200')
      .then((res) => (res.ok ? res.json() : { facilities: [] }))
      .then((data) => setFacilities(data.facilities || []))
      .catch(() => {})
  }, [])

  const set = (k: keyof typeof emptyForm, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    const isOther = form.equipmentTypeId === 'other'
    if (!form.equipmentName || (!isOther && !form.equipmentTypeId) || (isOther && !form.customTypeName.trim())) return

    setSaving(true)
    const ok = await createEquipment({
      equipmentName: form.equipmentName,
      equipmentTypeId: isOther ? undefined : form.equipmentTypeId,
      customTypeName: isOther ? form.customTypeName.trim() : undefined,
      currentStatusId: form.currentStatusId || undefined,
      assignedFacilityId: form.assignedFacilityId === 'unassigned' ? undefined : (form.assignedFacilityId || undefined),
      brand: form.brand || undefined,
      model: form.model || undefined,
      quantity: Number(form.quantity) || 1,
    })
    setSaving(false)
    if (ok) { setForm(emptyForm); setAddOpen(false) }
  }

  const handleOpenEdit = (item: any) => {
    setEditingItem(item)
    setEditForm({
      equipmentName: item.equipmentName || '',
      equipmentTypeId: item.equipmentTypeId || '',
      customTypeName: '',
      currentStatusId: item.currentStatusId || '',
      assignedFacilityId: item.assignedFacilityId || 'unassigned',
      brand: item.brand || '',
      model: item.model || '',
    })
  }

  const submitEdit = async () => {
    const isOtherEdit = editForm.equipmentTypeId === 'other'
    if (!editingItem || !editForm.equipmentName || (!isOtherEdit && !editForm.equipmentTypeId) || (isOtherEdit && !editForm.customTypeName.trim())) return

    setUpdating(true)
    const ok = await updateEquipment(editingItem.id, {
      equipmentName: editForm.equipmentName,
      equipmentTypeId: isOtherEdit ? undefined : editForm.equipmentTypeId,
      customTypeName: isOtherEdit ? editForm.customTypeName.trim() : undefined,
      currentStatusId: editForm.currentStatusId || undefined,
      assignedFacilityId: editForm.assignedFacilityId === 'unassigned' ? null : editForm.assignedFacilityId,
      brand: editForm.brand || undefined,
      model: editForm.model || undefined,
    })
    setUpdating(false)
    if (ok) setEditingItem(null)
  }

  // Optional status drill-down via ?status= (e.g. linked from a dashboard stat).
  // Normalized match keeps it robust to display-name variations ("In Use" ⇢ "inuse").
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const statusFilter = searchParams.get('status')
  const normStatus = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')
  const visibleEquipment = statusFilter
    ? equipment.filter((e: any) => normStatus(e.currentStatusName || '').includes(normStatus(statusFilter)))
    : equipment

  const colCount = showFacility ? 6 : 5

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          {titleLead} <span className="text-accent-brand">{titleAccent}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, brand…"
              className="h-11 pl-9"
            />
          </div>
          {statusFilter && (
            <button
              type="button"
              onClick={() => router.replace(pathname)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear status filter"
            >
              Status: <span className="capitalize text-foreground">{statusFilter}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
            <SelectTrigger className="h-11 w-[160px]">
              <SelectValue placeholder="All units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
        <BulkImportDialog bulk={bulk} equipmentTypes={equipmentTypes} triggerClassName="h-11" />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="h-11"><Plus size={16} className="mr-1.5" /> Add asset</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add equipment</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.equipmentName} onChange={(e) => set('equipmentName', e.target.value)} className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.equipmentTypeId} onValueChange={(v) => set('equipmentTypeId', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {equipmentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      <SelectItem value="other">+ Other (Specify custom type)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.currentStatusId} onValueChange={(v) => set('currentStatusId', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Default (Available)" /></SelectTrigger>
                    <SelectContent>
                      {statusTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.equipmentTypeId === 'other' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="custom-type" className="text-xs font-semibold text-accent-brand">Specify Custom Type Name</Label>
                  <Input
                    id="custom-type"
                    placeholder="e.g. VR Headset, 3D Printer, Microphone"
                    value={form.customTypeName}
                    onChange={(e) => set('customTypeName', e.target.value)}
                    className="h-11"
                  />
                </div>
              )}
              {showFacility && (
                <div className="space-y-1.5">
                  <Label>Facility / Location</Label>
                  <Select value={form.assignedFacilityId} onValueChange={(v) => set('assignedFacilityId', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Unassigned (Storage)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned (Storage)</SelectItem>
                      {facilities.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={form.model} onChange={(e) => set('model', e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input id="qty" type="number" min={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className="h-11" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !form.equipmentName || (!form.equipmentTypeId || (form.equipmentTypeId === 'other' && !form.customTypeName.trim()))}>
                {saving && <Loader2 size={16} className="mr-1.5 animate-spin" />} Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit & Assign Asset Location</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editForm.equipmentName} onChange={(e) => setEditForm((f) => ({ ...f, equipmentName: e.target.value }))} className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={editForm.equipmentTypeId} onValueChange={(v) => setEditForm((f) => ({ ...f, equipmentTypeId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {equipmentTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    <SelectItem value="other">+ Other (Specify custom type)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.currentStatusId} onValueChange={(v) => setEditForm((f) => ({ ...f, currentStatusId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Default (Available)" /></SelectTrigger>
                  <SelectContent>
                    {statusTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editForm.equipmentTypeId === 'other' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="edit-custom-type" className="text-xs font-semibold text-accent-brand">Specify Custom Type Name</Label>
                <Input
                  id="edit-custom-type"
                  placeholder="e.g. VR Headset, 3D Printer, Microphone"
                  value={editForm.customTypeName}
                  onChange={(e) => setEditForm((f) => ({ ...f, customTypeName: e.target.value }))}
                  className="h-11"
                />
              </div>
            )}
            {showFacility && (
              <div className="space-y-1.5">
                <Label>Location / Facility</Label>
                <Select value={editForm.assignedFacilityId} onValueChange={(v) => setEditForm((f) => ({ ...f, assignedFacilityId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Unassigned (Storage)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned (Storage)</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-brand">Brand</Label>
                <Input id="edit-brand" value={editForm.brand} onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-model">Model</Label>
                <Input id="edit-model" value={editForm.model} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} className="h-11" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)} disabled={updating}>Cancel</Button>
            <Button onClick={submitEdit} disabled={updating || !editForm.equipmentName || !editForm.equipmentTypeId}>
              {updating && <Loader2 size={16} className="mr-1.5 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              {showFacility && <TableHead>Facility</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground">
                <Loader2 className="inline animate-spin mr-2" size={16} /> Loading…
              </TableCell></TableRow>
            ) : visibleEquipment.length === 0 ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground">{statusFilter || assignmentFilter ? 'No equipment matches the current filters.' : 'No equipment yet.'}</TableCell></TableRow>
            ) : visibleEquipment.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.equipmentCode}</TableCell>
                <TableCell className="font-medium">{e.equipmentName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.equipmentTypeName}</TableCell>
                <TableCell><Badge variant="secondary">{e.currentStatusName}</Badge></TableCell>
                {showFacility && <TableCell className="text-sm text-muted-foreground">{e.assignedFacilityName || '—'}</TableCell>}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground mr-1"
                    aria-label={`Edit or Assign location for ${e.equipmentCode}`}
                    onClick={() => handleOpenEdit(e)}
                  >
                    <MapPin size={16} />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        aria-label={`Deactivate ${e.equipmentCode}`}
                      >
                        <Archive size={16} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate {e.equipmentCode}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes it from the active inventory. Its record and history are kept, not deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteEquipment(e.id)}>Deactivate</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

