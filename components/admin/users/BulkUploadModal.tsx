'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileDown,
  Pencil,
} from 'lucide-react'
import ExcelJS from 'exceljs'
import { createBrandedWorkbook, downloadWorkbook } from '@/lib/excel-branding'
import type { RoleOption, DepartmentOption } from '@/backend/admin/admin.types'
import { INTERNAL_DOMAINS } from '@/backend/auth/auth.constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InAppTableEditor } from './InAppTableEditor'
import { validateUserRow, type ParsedRow } from '@/lib/user-validation'

// ------- Types -------

interface UploadResult {
  row: number
  success: boolean
  email: string
  fullName: string
  temporaryPassword?: string
  error?: string
  department?: string
}

interface BulkUploadResponse {
  results: UploadResult[]
  summary: { total: number; success: number; failed: number }
}

interface BulkUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: (rows: ParsedRow[]) => Promise<BulkUploadResponse>
  onComplete: () => void
  roles: RoleOption[]
  departments: DepartmentOption[]
}

// ------- Template generation with Excel dropdowns -------

async function generateTemplate(roles: RoleOption[], departments: DepartmentOption[]) {
  const userTypeValues = ['internal', 'external']
  const roleValues = roles.map(r => r.name)   // snake_case used in DB
  const deptValues = departments.map(d => `${d.code} - ${d.name}`)
  const boolValues = ['TRUE', 'FALSE']

  const wb = createBrandedWorkbook({
    sheetName: 'User Upload',
    title: 'Bulk User Upload Template',
    subtitle: 'Fill in each row. User Type, Role, and Department columns have dropdown lists — click a cell to select.',
    columns: [
      { header: 'First Name *', key: 'first_name', width: 20 },
      { header: 'Last Name *', key: 'last_name', width: 20 },
      { header: 'Email *', key: 'email', width: 42 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'User Type *', key: 'user_type', width: 16 },
      { header: 'Role *', key: 'role', width: 22 },
      { header: 'Department', key: 'department', width: 44 },
      { header: 'Organization', key: 'organization', width: 30 },
      { header: 'Notif. Email', key: 'notification_email', width: 42 },
      { header: 'Create Entra?', key: 'provision_entra', width: 15 },
    ],
    rows: [
      {
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        email: `juan.delacruz${INTERNAL_DOMAINS[0]}`,
        phone: '+63 912 345 6789',
        user_type: 'internal',
        role: 'faculty',
        department: deptValues[0] || '',
        organization: '',
        notification_email: 'juan.personal@gmail.com',
        provision_entra: 'TRUE',
      },
      {
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'maria@company.com',
        phone: '',
        user_type: 'external',
        role: 'external_client',
        department: '',
        organization: 'Tech Corp',
        notification_email: '',
        provision_entra: 'FALSE',
      },
    ],
  })

  const ws = wb.getWorksheet('User Upload')!

  // Add a hidden reference sheet with valid values
  const refSheet = wb.addWorksheet('_ValidValues', { state: 'veryHidden' })
  // Column A: user types, Column B: roles, Column C: departments, Column D: bools
  userTypeValues.forEach((v, i) => { refSheet.getCell(i + 1, 1).value = v })
  roleValues.forEach((v, i) => { refSheet.getCell(i + 1, 2).value = v })
  deptValues.forEach((v, i) => { refSheet.getCell(i + 1, 3).value = v })
  boolValues.forEach((v, i) => { refSheet.getCell(i + 1, 4).value = v })

  // Apply data validation to rows 5–104 (100 rows)
  const utFormula = `'_ValidValues'!$A$1:$A$${userTypeValues.length}`
  const roleFormula = `'_ValidValues'!$B$1:$B$${roleValues.length}`
  const deptFormula = `'_ValidValues'!$C$1:$C$${deptValues.length}`
  const boolFormula = `'_ValidValues'!$D$1:$D$${boolValues.length}`

  for (let row = 5; row <= 104; row++) {
    // Column E: User Type (col 5)
    ws.getCell(row, 5).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [utFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid User Type',
      error: 'Please select "internal" or "external"',
    }
    // Column F: Role (col 6)
    ws.getCell(row, 6).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [roleFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Role',
      error: 'Please select a role from the dropdown list',
    }
    // Column G: Department (col 7)
    ws.getCell(row, 7).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [deptFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Department',
      error: 'Please select a department from the dropdown list',
    }
    // Column J: Provision Entra (col 10)
    ws.getCell(row, 10).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [boolFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select TRUE or FALSE',
    }
  }

  await downloadWorkbook(wb, 'STI-ReserveIT-User-Upload-Template.xlsx')
}

// ------- CSV Parsing -------

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuote = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuote = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        row.push(current.trim())
        current = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(current.trim())
        if (row.some(c => c !== '')) rows.push(row)
        row = []
        current = ''
      } else {
        current += ch
      }
    }
  }
  row.push(current.trim())
  if (row.some(c => c !== '')) rows.push(row)

  return rows
}

// ------- Component -------

export const BulkUploadModal = ({
  open,
  onOpenChange,
  onUpload,
  onComplete,
  roles,
  departments,
}: BulkUploadModalProps) => {
  const [phase, setPhase] = useState<'upload' | 'preview' | 'processing' | 'results'>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<BulkUploadResponse | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('file')
  const inputRef = useRef<HTMLInputElement>(null)

  const validRoleNames = roles.map(r => r.name.toLowerCase())

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('upload')
      setParsedRows([])
      setResults(null)
      setProcessing(false)
      setDragOver(false)
      setFileError(null)
      setActiveTab('file')
    }
  }, [open])

  const handleFile = useCallback(async (file: File) => {
    setFileError(null)
    
    let rawRows: string[][] = []

    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        rawRows = parseCSV(text)
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer()
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(arrayBuffer)
        const ws = wb.worksheets[0]
        if (!ws) throw new Error('No worksheets found')
        
        ws.eachRow((row) => {
          const rowValues: string[] = []
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowValues[colNumber - 1] = cell.text || cell.value?.toString() || ''
          })
          rawRows.push(rowValues)
        })
      } else {
        setFileError('Please upload an Excel file (.xlsx) or CSV (.csv)')
        return
      }
    } catch {
      setFileError('Failed to parse file. Please ensure it is a valid format.')
      return
    }

    if (rawRows.length < 2) {
      setFileError('File must contain data rows.')
      return
    }

    // Find the header row by looking for "Email" and "First Name"
    let headerRowIdx = -1
    for (let i = 0; i < rawRows.length; i++) {
      const rowText = rawRows[i].join('').toLowerCase()
      if (rowText.includes('email') && (rowText.includes('first name') || rowText.includes('firstname'))) {
        headerRowIdx = i
        break
      }
    }

    if (headerRowIdx === -1) {
      setFileError('Could not find header row. Ensure columns include "First Name", "Last Name", and "Email".')
      return
    }

    const headers = rawRows[headerRowIdx].map(h => (h || '').toLowerCase().replace(/[*()?]/g, '').trim().replace(/\s+/g, '_'))
    const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => r.some(c => !!c?.trim()))

    const hi = {
      first_name: headers.findIndex(h => h.includes('first_name') || h === 'firstname'),
      last_name: headers.findIndex(h => h.includes('last_name') || h === 'lastname'),
      email: headers.findIndex(h => h.includes('email')),
      phone: headers.findIndex(h => h.includes('phone')),
      user_type: headers.findIndex(h => h.includes('user_type')),
      role: headers.findIndex(h => h === 'role'),
      department: headers.findIndex(h => h.includes('department')),
      organization: headers.findIndex(h => h.includes('organization') || h === 'org'),
      notification_email: headers.findIndex(h => h.includes('notification') || h.includes('notif')),
      provision_entra: headers.findIndex(h => h.includes('entra') || h.includes('provision')),
    }

    if (hi.first_name === -1 || hi.last_name === -1 || hi.email === -1) {
      setFileError('File must have "First Name", "Last Name", and "Email" columns.')
      return
    }

    const parsed: ParsedRow[] = dataRows.map(cols => {
      const p_entra = hi.provision_entra >= 0 ? cols[hi.provision_entra]?.toLowerCase().trim() : ''
      const provision_entra = p_entra === 'true' || p_entra === 'yes' || p_entra === '1'
      
      const row: ParsedRow = {
        first_name: cols[hi.first_name] || '',
        last_name: cols[hi.last_name] || '',
        email: cols[hi.email] || '',
        phone: hi.phone >= 0 ? cols[hi.phone] || '' : '',
        user_type: hi.user_type >= 0 ? cols[hi.user_type] || '' : '',
        role: hi.role >= 0 ? cols[hi.role] || '' : '',
        department: hi.department >= 0 ? cols[hi.department] || '' : '',
        organization: hi.organization >= 0 ? cols[hi.organization] || '' : '',
        notification_email: hi.notification_email >= 0 ? cols[hi.notification_email] || '' : '',
        provision_entra,
      }
      row.validationError = validateUserRow(row, validRoleNames)
      return row
    })

    // Check for duplicate emails
    const seen = new Set<string>()
    for (const row of parsed) {
      const em = row.email.toLowerCase().trim()
      if (em && seen.has(em)) {
        row.validationError = row.validationError || 'Duplicate email in file'
      }
      if (em) seen.add(em)
    }

    if (parsed.length > 100) {
      setFileError(`Maximum 100 users per upload. Your file has ${parsed.length} data rows.`)
      return
    }

    setParsedRows(parsed)
    setPhase('preview')
  }, [validRoleNames])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const validCount = parsedRows.filter(r => !r.validationError).length
  const invalidCount = parsedRows.filter(r => !!r.validationError).length

  const handleSubmit = async () => {
    const validRows = parsedRows.filter(r => !r.validationError)
    if (validRows.length === 0) return
    setProcessing(true)
    setPhase('processing')
    try {
      const response = await onUpload(validRows)
      setResults(response)
      setPhase('results')
    } catch {
      setResults({
        results: [],
        summary: { total: validRows.length, success: 0, failed: validRows.length },
      })
      setPhase('results')
    } finally {
      setProcessing(false)
    }
  }

  const handleFixErrors = () => {
    if (!results) return

    const validRows = parsedRows.filter(r => !r.validationError)
    const newRows: ParsedRow[] = []
    
    // 1. Keep rows that had local validation errors (never sent)
    parsedRows.forEach(r => {
      if (r.validationError) {
        newRows.push(r)
      }
    })

    // 2. Add rows that failed on the server
    results.results.forEach((backendResult, i) => {
      if (!backendResult.success) {
        const originalRow = validRows[i]
        if (originalRow) {
          newRows.push({
            ...originalRow,
            validationError: backendResult.error || 'Failed on server'
          })
        }
      }
    })

    setParsedRows(newRows)
    setResults(null)
    setActiveTab('manual')
    setPhase('upload')
  }

  const handleDownloadCredentials = async () => {
    if (!results) return
    const creds = results.results.filter(r => r.success && r.temporaryPassword)
    if (creds.length === 0) return

    const wb = createBrandedWorkbook({
      sheetName: 'Credentials',
      title: 'New User Credentials',
      subtitle: 'CONFIDENTIAL \u2014 Share securely. Temporary passwords shown here will not be available again.',
      columns: [
        { header: 'Full Name', key: 'fullName', width: 28 },
        { header: 'Email', key: 'email', width: 42 },
        { header: 'Temporary Password', key: 'temporaryPassword', width: 28 },
        { header: 'Department', key: 'department', width: 18 },
      ],
      rows: creds.map(r => ({
        fullName: r.fullName,
        email: r.email,
        temporaryPassword: r.temporaryPassword,
        department: r.department || '—',
      })),
    })
    await downloadWorkbook(wb, `STI-ReserveIT-Credentials-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleClose = (next: boolean) => {
    if (processing) return
    if (!next && results) {
      onComplete()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[85vh] flex flex-col">

        {/* ====== PHASE: UPLOAD ====== */}
        {phase === 'upload' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <DialogHeader className="shrink-0 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Bulk Upload Users
              </DialogTitle>
              <DialogDescription>
                Upload an Excel/CSV file, or manually paste spreadsheet data directly into the grid.
              </DialogDescription>
            </DialogHeader>

            <TabsList className="grid w-full grid-cols-2 mt-2 mb-4 shrink-0">
              <TabsTrigger value="file">File Upload</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="flex-1 overflow-auto mt-0 space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">Download Excel Template</p>
                    <p className="text-xs text-muted-foreground">
                      Template includes <strong>dropdown lists</strong> for User Type, Role, and Department.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateTemplate(roles, departments)}
                      className="mt-2 gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Template
                    </Button>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/20'
                }`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Drop your CSV or Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">Maximum 100 users per upload</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = ''
                  }}
                />
              </div>

              {fileError && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {fileError}
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="flex-1 mt-0 min-h-0 outline-none data-[state=active]:flex flex-col">
              <InAppTableEditor 
                roles={roles} 
                departments={departments} 
                validRoleNames={validRoleNames} 
                onRowsSubmit={(rows) => {
                  if (rows.length > 100) {
                    setFileError(`Maximum 100 users. You provided ${rows.length}.`)
                    // Switch back to file tab to show error or just show alert (can't easily switch tab state without managed state, but user can see it if we stay or we can just alert)
                    alert(`Maximum 100 users. You provided ${rows.length}.`)
                    return
                  }
                  setParsedRows(rows)
                  setPhase('preview')
                }} 
              />
            </TabsContent>
          </Tabs>
        )}

        {/* ====== PHASE: PREVIEW ====== */}
        {phase === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>Review Upload — {parsedRows.length} users</DialogTitle>
              <DialogDescription>
                Review the data below before submitting. Rows with errors will be skipped.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-3 text-sm">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                    <XCircle className="h-3.5 w-3.5 mr-1" /> {invalidCount} with errors
                  </Badge>
                )}
              </div>

              <div className="overflow-auto flex-1 rounded-md border max-h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs w-[36px]">#</TableHead>
                      <TableHead className="text-xs">First Name</TableHead>
                      <TableHead className="text-xs">Last Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Dept</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow key={i} className={row.validationError ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{row.first_name || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{row.last_name || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={row.email}>{row.email || '—'}</TableCell>
                        <TableCell className="text-xs">{row.user_type || '—'}</TableCell>
                        <TableCell className="text-xs">{row.role || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate" title={row.department}>{row.department ? row.department.split(' - ')[0] : '—'}</TableCell>
                        <TableCell className="text-xs">
                          {row.validationError ? (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                              <XCircle className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[120px]" title={row.validationError}>{row.validationError}</span>
                            </span>
                          ) : (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setPhase('upload'); setParsedRows([]) }}>Back</Button>
              <Button
                onClick={handleSubmit}
                disabled={validCount === 0}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Upload {validCount} user{validCount !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ====== PHASE: PROCESSING ====== */}
        {phase === 'processing' && (
          <>
            <DialogHeader>
              <DialogTitle>Creating Users…</DialogTitle>
              <DialogDescription>
                Processing {validCount} users. This may take a moment as Entra accounts are provisioned for internal users.
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 space-y-4">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Provisioning accounts and creating user records…</p>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          </>
        )}

        {/* ====== PHASE: RESULTS ====== */}
        {phase === 'results' && results && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Complete</DialogTitle>
              <DialogDescription>
                {results.summary.success} of {results.summary.total} users created successfully.
                {results.summary.failed > 0 && ` ${results.summary.failed} failed.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-3 text-sm">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {results.summary.success} created
                </Badge>
                {results.summary.failed > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                    <XCircle className="h-3.5 w-3.5 mr-1" /> {results.summary.failed} failed
                  </Badge>
                )}
              </div>

              <div className="overflow-auto flex-1 rounded-md border max-h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs w-[40px]">#</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.results.map((r, i) => (
                      <TableRow key={i} className={!r.success ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="text-xs font-medium">{r.fullName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.email}</TableCell>
                        <TableCell className="text-xs">
                          {r.success ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Created
                              {r.temporaryPassword && <Badge variant="secondary" className="ml-1 text-xs">Entra</Badge>}
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                              <XCircle className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[180px]" title={r.error}>{r.error}</span>
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Credentials download */}
              {results.results.some(r => r.success && r.temporaryPassword) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Download credentials now — temporary passwords will not be shown again!
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadCredentials}
                        className="mt-2 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Download Credentials Excel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              {results.summary.failed > 0 && (
                <Button variant="outline" onClick={handleFixErrors} className="gap-2">
                  <Pencil className="h-4 w-4" /> Fix {results.summary.failed} Errors
                </Button>
              )}
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  )
}
