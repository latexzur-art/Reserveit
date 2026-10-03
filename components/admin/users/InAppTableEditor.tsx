'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { validateUserRow, type ParsedRow } from '@/lib/user-validation'
import type { RoleOption, DepartmentOption } from '@/backend/admin/admin.types'

interface InAppTableEditorProps {
  roles: RoleOption[]
  departments: DepartmentOption[]
  validRoleNames: string[]
  onRowsSubmit: (rows: ParsedRow[]) => void
}

const createEmptyRow = (): ParsedRow => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  user_type: 'Internal',
  role: '',
  department: '',
  organization: '',
  notification_email: '',
  provision_entra: true,
})

export const InAppTableEditor = ({ roles, departments, validRoleNames, onRowsSubmit }: InAppTableEditorProps) => {
  const [rows, setRows] = useState<ParsedRow[]>(Array.from({ length: 5 }, createEmptyRow))
  
  // Re-run validation whenever validRoleNames change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(current => current.map(row => ({
      ...row,
      validationError: validateUserRow(row, validRoleNames)
    })))
  }, [validRoleNames])

  const handleCellChange = (index: number, field: keyof ParsedRow, value: string | boolean) => {
    setRows(current => {
      const updated = [...current]
      const row = { ...updated[index], [field]: value }
      
      // Auto-clear invalid fields if type changes
      if (field === 'user_type') {
        row.role = '' // Reset role as role options differ
        if (value === 'External') {
          row.department = ''
          row.notification_email = ''
          row.provision_entra = false
        } else {
          row.organization = ''
          row.provision_entra = true
        }
      }
      
      row.validationError = validateUserRow(row, validRoleNames)
      updated[index] = row
      return updated
    })
  }

  const addRow = () => {
    setRows(current => [...current, createEmptyRow()])
  }

  const removeRow = (index: number) => {
    setRows(current => current.filter((_, i) => i !== index))
  }

  const toggleAllEntra = (checked: boolean) => {
    setRows(current => current.map(row => {
      if (row.user_type === 'Internal') {
        const updated = { ...row, provision_entra: checked }
        updated.validationError = validateUserRow(updated, validRoleNames)
        return updated
      }
      return row
    }))
  }

  const handlePaste = useCallback((e: React.ClipboardEvent, startRowIndex: number) => {
    const clipboardData = e.clipboardData.getData('Text')
    if (!clipboardData) return

    // Only intercept if it looks like tabular data from Excel/CSV
    const isTabular = clipboardData.includes('\t') || clipboardData.includes('\n')
    if (!isTabular) return // Let native paste handle single-cell text

    e.preventDefault()
    e.stopPropagation()

    const pastedRows = clipboardData.split(/\r?\n/).filter(r => r.trim().length > 0).map(r => r.split('\t'))
    if (pastedRows.length === 0) return

    setRows(current => {
      const updated = [...current]
      
      // Ensure we have enough rows
      const requiredRows = startRowIndex + pastedRows.length
      while (updated.length < requiredRows) {
        updated.push(createEmptyRow())
      }

      pastedRows.forEach((pastedCols, i) => {
        const rowIndex = startRowIndex + i
        const row = { ...updated[rowIndex] }
        
        // Map based on column order:
        // 0: First Name, 1: Last Name, 2: Email, 3: Phone, 4: Type, 5: Role, 6: Dept, 7: Org, 8: Notif Email, 9: Entra
        if (pastedCols[0] !== undefined) row.first_name = pastedCols[0].trim()
        if (pastedCols[1] !== undefined) row.last_name = pastedCols[1].trim()
        if (pastedCols[2] !== undefined) row.email = pastedCols[2].trim()
        if (pastedCols[3] !== undefined) row.phone = pastedCols[3].trim()
        
        if (pastedCols[4] !== undefined) {
          const t = pastedCols[4].trim().toLowerCase()
          row.user_type = t === 'external' ? 'External' : 'Internal'
        }
        
        if (pastedCols[5] !== undefined) {
          // Attempt to match pasted role displayName to a role id
          const pastedRole = pastedCols[5].trim().toLowerCase()
          const matchedRole = roles.find(r => 
            r.name.toLowerCase() === pastedRole || 
            r.displayName.toLowerCase() === pastedRole
          )
          row.role = matchedRole ? matchedRole.name : pastedCols[5].trim()
        }
        
        if (pastedCols[6] !== undefined && row.user_type === 'Internal') {
          // Match department code or name
          const pastedDept = pastedCols[6].trim().toLowerCase()
          const matchedDept = departments.find(d => 
            d.code.toLowerCase() === pastedDept || 
            d.name.toLowerCase() === pastedDept
          )
          row.department = matchedDept ? `${matchedDept.code} - ${matchedDept.name}` : pastedCols[6].trim()
        }
        
        if (pastedCols[7] !== undefined && row.user_type === 'External') {
          row.organization = pastedCols[7].trim()
        }
        
        if (pastedCols[8] !== undefined && row.user_type === 'Internal') {
          row.notification_email = pastedCols[8].trim()
        }
        
        if (pastedCols[9] !== undefined && row.user_type === 'Internal') {
          const val = pastedCols[9].trim().toLowerCase()
          row.provision_entra = val === 'true' || val === 'yes' || val === '1'
        }

        row.validationError = validateUserRow(row, validRoleNames)
        updated[rowIndex] = row
      })
      
      // Check for duplicate emails within the updated rows
      const seen = new Set<string>()
      updated.forEach(row => {
        const em = row.email.toLowerCase().trim()
        if (em && seen.has(em)) {
          row.validationError = row.validationError || 'Duplicate email in table'
        }
        if (em) seen.add(em)
      })

      return updated
    })
  }, [roles, departments, validRoleNames])

  const filledRows = rows.filter(r => r.first_name || r.last_name || r.email)
  const validCount = filledRows.filter(r => !r.validationError).length
  const invalidCount = filledRows.filter(r => !!r.validationError).length

  const internalRows = rows.filter(r => r.user_type === 'Internal')
  const allInternalEntraChecked = internalRows.length > 0 && internalRows.every(r => r.provision_entra)

  return (
    <div className="flex flex-col flex-1 h-full space-y-4 min-h-0">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <p className="text-sm font-medium">Manual Entry Grid</p>
          <p className="text-xs text-muted-foreground">Fill out the rows or paste directly from Excel/CSV (Tab-Separated).</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
             <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {validCount} valid
           </Badge>
           {invalidCount > 0 && (
             <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
               <XCircle className="h-3.5 w-3.5 mr-1" /> {invalidCount} with errors
             </Badge>
           )}
        </div>
      </div>

      <div className="border rounded-md flex-1 overflow-auto shadow-sm min-h-0">
        <Table className="min-w-max relative" style={{ minWidth: '1200px' }}>
          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-10 px-2"></TableHead>
              <TableHead className="w-[140px] text-xs">First Name *</TableHead>
              <TableHead className="w-[140px] text-xs">Last Name *</TableHead>
              <TableHead className="w-[200px] text-xs">Email *</TableHead>
              <TableHead className="w-[140px] text-xs">Phone</TableHead>
              <TableHead className="w-[130px] text-xs">Type *</TableHead>
              <TableHead className="w-[160px] text-xs">Role *</TableHead>
              <TableHead className="w-[180px] text-xs">Dept / Org</TableHead>
              <TableHead className="w-[180px] text-xs">Notif. Email</TableHead>
              <TableHead className="w-[80px] text-xs text-center p-0 align-middle">
                <div className="flex flex-col items-center justify-center gap-1 py-1">
                  <span>Entra?</span>
                  <Checkbox 
                    checked={allInternalEntraChecked} 
                    onCheckedChange={(c) => toggleAllEntra(!!c)} 
                    className="data-[state=checked]:bg-blue-600 border-slate-300"
                    title="Toggle all internal users"
                  />
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const isFilled = row.first_name || row.last_name || row.email
              const hasError = isFilled && !!row.validationError
              
              const filteredRoles = roles.filter(r => {
                if (row.user_type === 'Internal') return r.name !== 'external_client'
                return r.name === 'external_client'
              })

              return (
                <TableRow 
                  key={i} 
                  className={hasError ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                  onPaste={(e) => handlePaste(e, i)}
                >
                  <TableCell className="text-xs text-muted-foreground px-2 py-1 text-center border-r">
                    {i + 1}
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent" 
                      value={row.first_name} 
                      onChange={e => handleCellChange(i, 'first_name', e.target.value)}
                      placeholder="First Name"
                    />
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    <Input 
                      className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent" 
                      value={row.last_name} 
                      onChange={e => handleCellChange(i, 'last_name', e.target.value)}
                      placeholder="Last Name"
                    />
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    <Input 
                      className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent" 
                      value={row.email} 
                      onChange={e => handleCellChange(i, 'email', e.target.value)}
                      placeholder="user@example.com"
                      title={hasError && row.validationError?.includes('email') ? row.validationError : undefined}
                    />
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    <Input 
                      className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent" 
                      value={row.phone || ''} 
                      onChange={e => handleCellChange(i, 'phone', e.target.value)}
                      placeholder="+63 XXX"
                    />
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    <Select value={row.user_type} onValueChange={v => handleCellChange(i, 'user_type', v)}>
                      <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internal" className="text-xs">Internal</SelectItem>
                        <SelectItem value="External" className="text-xs">External</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    <Select value={row.role} onValueChange={v => handleCellChange(i, 'role', v)}>
                      <SelectTrigger className={`h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent ${!row.role && isFilled ? 'text-red-500' : ''}`}>
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRoles.map(r => (
                          <SelectItem key={r.id} value={r.name} className="text-xs">{r.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    {row.user_type === 'Internal' ? (
                      <Select value={row.department} onValueChange={v => handleCellChange(i, 'department', v)}>
                        <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                          <SelectValue placeholder="Dept" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(d => (
                            <SelectItem key={d.id} value={`${d.code} - ${d.name}`} className="text-xs">
                              {d.code} - {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input 
                        className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent" 
                        value={row.organization || ''} 
                        onChange={e => handleCellChange(i, 'organization', e.target.value)}
                        placeholder="Organization"
                      />
                    )}
                  </TableCell>
                  <TableCell className="p-1 border-l">
                    <Input 
                      className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent disabled:opacity-50" 
                      value={row.notification_email || ''} 
                      onChange={e => handleCellChange(i, 'notification_email', e.target.value)}
                      placeholder="Notif. Email"
                      disabled={row.user_type === 'External'}
                    />
                  </TableCell>
                  <TableCell className="p-1 border-l text-center align-middle">
                    <div className="flex justify-center items-center h-full">
                      <Checkbox 
                        checked={row.provision_entra}
                        onCheckedChange={c => handleCellChange(i, 'provision_entra', !!c)}
                        disabled={row.user_type === 'External'}
                        className="data-[state=checked]:bg-blue-600 border-slate-300"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="p-1 border-l text-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 shrink-0"
                      onClick={() => removeRow(i)}
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addRow} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Row
        </Button>
        <Button 
          onClick={() => onRowsSubmit(filledRows)}
          disabled={validCount === 0 || invalidCount > 0}
          className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
        >
          Review & Submit {validCount > 0 ? `(${validCount})` : ''}
        </Button>
      </div>
    </div>
  )
}
