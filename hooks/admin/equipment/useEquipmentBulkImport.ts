'use client'

import { useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { parseExcelRows } from '@/lib/excel'

export interface BulkImportItem {
  equipmentName: string
  equipmentType: string
  brand: string
  model: string
  serialNumber: string
  quantity: number | string
  notes: string
}

export interface RowIssue {
  /** Blocking problems that must be fixed before the row can be submitted. */
  errors: string[]
  /** Non-blocking heads-up (e.g. a brand-new type will be created). */
  warnings: string[]
}

const emptyItem = (): BulkImportItem => ({
  equipmentName: '',
  equipmentType: '',
  brand: '',
  model: '',
  serialNumber: '',
  quantity: 1,
  notes: '',
})

interface Params {
  /** API base, e.g. /api/admin/pamo/equipment — the hook POSTs to `${basePath}/bulk`. */
  basePath: string
  /** Known types, used both for the template dropdown and to flag brand-new types. */
  equipmentTypes: { id: string; name: string }[]
  /** Called after a successful import so the caller can refresh its list. */
  onImported?: () => void
}

/**
 * Shared bulk-import controller for the equipment managers (Building, PAMO, IT).
 * Owns the dialog state, the .xlsx template download, file parsing, the
 * editable review rows, per-row validation, and submission to `${basePath}/bulk`.
 * Kept as one hook so all three surfaces behave identically and never drift.
 */
export function useEquipmentBulkImport({ basePath, equipmentTypes, onImported }: Params) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [importData, setImportData] = useState<BulkImportItem[]>([])
  const [importLoading, setImportLoading] = useState(false)

  // Lower-cased set of existing type names, to flag rows introducing a new type.
  const knownTypeNames = useMemo(
    () => new Set(equipmentTypes.map((t) => t.name.trim().toLowerCase())),
    [equipmentTypes]
  )

  const rowIssues = (item: BulkImportItem): RowIssue => {
    const errors: string[] = []
    const warnings: string[] = []
    if (!item.equipmentName?.trim()) errors.push('Name is required')
    if (!item.equipmentType?.trim()) errors.push('Type is required')
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty < 1) errors.push('Quantity must be at least 1')
    else if (qty > 100) warnings.push('Capped at 100 per row')
    const type = item.equipmentType?.trim()
    if (type && errors.length === 0 && !knownTypeNames.has(type.toLowerCase())) {
      warnings.push('New type — will be created')
    }
    return { errors, warnings }
  }

  const invalidCount = useMemo(
    () => importData.filter((i) => rowIssues(i).errors.length > 0).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importData, knownTypeNames]
  )

  const totalQuantity = useMemo(
    () => importData.reduce((acc, i) => acc + (Math.max(0, Number(i.quantity)) || 0), 0),
    [importData]
  )

  const downloadTemplate = async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Equipment Template')

    // Hidden sheet holds the type list so the in-cell dropdown isn't bound by
    // the 255-char inline-list limit.
    const typeSheet = workbook.addWorksheet('__Metadata', { state: 'hidden' })
    const typeNames = equipmentTypes.map((t) => t.name).filter((name) => name !== 'OTHER (SPECIFY)')
    typeNames.forEach((name, i) => {
      typeSheet.getCell(i + 1, 1).value = name
    })
    const typeRange = `'__Metadata'!$A$1:$A$${typeNames.length || 1}`

    // NOTE: no ID/Code column — the app assigns the sequential code on import.
    const headers = ['Equipment Name', 'Equipment Type', 'Brand', 'Model', 'Serial Number', 'Quantity', 'Notes']
    const headerRow = worksheet.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0072BC' } }
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      }
    })

    worksheet.columns = [
      { width: 30 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 25 }, { width: 12 }, { width: 40 },
    ]

    // Type dropdown on column B for the first 1000 rows.
    for (let i = 2; i <= 1000; i++) {
      worksheet.getCell(i, 2).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [typeRange],
        showErrorMessage: true,
        errorTitle: 'Invalid Equipment Type',
        error: 'Please select an equipment type from the dropdown list.',
        promptTitle: 'Select Type',
        prompt: 'Choose from the predefined list of equipment types.',
      }
    }

    const sampleRow = worksheet.addRow(['Example Projector', typeNames[0] || 'Projector', 'Epson', 'EB-X05', 'SN12345', 1, 'New arrival'])
    sampleRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'STI_Equipment_Template.xlsx'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseExcelRows(file)
      const mapped: BulkImportItem[] = rows.map((row: any) => ({
        equipmentName: String(row['Equipment Name'] ?? '').trim(),
        equipmentType: String(row['Equipment Type'] ?? '').trim(),
        brand: String(row['Brand'] ?? '').trim(),
        model: String(row['Model'] ?? '').trim(),
        serialNumber: String(row['Serial Number'] ?? '').trim(),
        quantity: Number(row['Quantity']) || 1,
        notes: String(row['Notes'] ?? '').trim(),
      }))
      if (mapped.length === 0) {
        toast({ title: 'Nothing to import', description: 'No data rows were found in that file.', variant: 'destructive' })
        return
      }
      setImportData(mapped)
      setActiveTab('review')
    } catch {
      toast({ title: 'Error', description: 'Failed to parse file. Ensure it matches the template.', variant: 'destructive' })
    } finally {
      // Allow re-selecting the same file after a failed/first attempt.
      e.target.value = ''
    }
  }

  const handleManualEntryAdd = () => {
    setImportData((prev) => [...prev, emptyItem()])
    setActiveTab('review')
  }

  const updateImportItem = (index: number, field: keyof BulkImportItem, value: string) => {
    setImportData((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  const removeImportItem = (index: number) => {
    setImportData((prev) => prev.filter((_, i) => i !== index))
  }

  const handleBulkSubmit = async () => {
    if (importData.length === 0) return
    if (invalidCount > 0) {
      toast({
        title: 'Fix invalid rows first',
        description: `${invalidCount} row${invalidCount === 1 ? '' : 's'} need a name, type, or valid quantity.`,
        variant: 'destructive',
      })
      return
    }
    setImportLoading(true)
    try {
      const res = await fetch(`${basePath}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importData }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'Failed to import items')
      const count = typeof payload?.count === 'number' ? payload.count : totalQuantity
      toast({ title: 'Bulk import successful', description: `Registered ${count} asset${count === 1 ? '' : 's'}.` })
      setOpen(false)
      setImportData([])
      setActiveTab('upload')
      onImported?.()
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to import items', variant: 'destructive' })
    } finally {
      setImportLoading(false)
    }
  }

  return {
    open,
    setOpen,
    activeTab,
    setActiveTab,
    importData,
    importLoading,
    invalidCount,
    totalQuantity,
    rowIssues,
    downloadTemplate,
    handleFileUpload,
    handleManualEntryAdd,
    updateImportItem,
    removeImportItem,
    handleBulkSubmit,
  }
}
