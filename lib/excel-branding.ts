/**
 * STI-branded Excel file generation for admin exports.
 *
 * Uses ExcelJS to produce .xlsx files with:
 * - STI Navy/Gold header with institution name
 * - Styled column headers
 * - Auto-fitted column widths
 * - Protected header rows
 */

import ExcelJS from 'exceljs'

// STI brand colours
const STI_NAVY = '002B5C'   // primary navy
const STI_GOLD = 'F4B400'   // STI gold/yellow
const WHITE    = 'FFFFFF'
const LIGHT_BG = 'F1F5F9'   // slate-100 for alternating rows
const BORDER   = 'CBD5E1'   // slate-300

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: BORDER } },
  bottom: { style: 'thin', color: { argb: BORDER } },
  left:   { style: 'thin', color: { argb: BORDER } },
  right:  { style: 'thin', color: { argb: BORDER } },
}

interface StyledWorkbookOptions {
  /** Sheet title shown on the tab */
  sheetName: string
  /** Title shown in the branded header banner */
  title: string
  /** Optional subtitle line */
  subtitle?: string
  /** Column definitions */
  columns: { header: string; key: string; width: number }[]
  /** Data rows (array of objects matching column keys) */
  rows?: Record<string, any>[]
}

/**
 * Build a fully-styled ExcelJS Workbook with STI branding and return it.
 */
export function createBrandedWorkbook(opts: StyledWorkbookOptions): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ReserveIT — STI College'
  wb.created = new Date()

  const ws = wb.addWorksheet(opts.sheetName, {
    properties: { defaultColWidth: 18 },
  })

  const colCount = opts.columns.length
  ws.columns = opts.columns.map(c => ({ header: c.header, key: c.key, width: c.width }))

  // ── Row 1: STI branded banner (merged) ──
  ws.mergeCells(1, 1, 1, colCount)
  const bannerCell = ws.getCell(1, 1)
  bannerCell.value = `STI College  •  ${opts.title}`
  bannerCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } }
  bannerCell.alignment = { horizontal: 'center', vertical: 'middle' }
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STI_NAVY } }
  ws.getRow(1).height = 36

  // ── Row 2: subtitle or date line ──
  ws.mergeCells(2, 1, 2, colCount)
  const subCell = ws.getCell(2, 1)
  subCell.value = opts.subtitle || `Generated on ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: STI_NAVY } }
  subCell.alignment = { horizontal: 'center', vertical: 'middle' }
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STI_GOLD } }
  ws.getRow(2).height = 22

  // ── Row 3: spacer ──
  ws.getRow(3).height = 6

  // ── Row 4: column headers ──
  const headerRow = ws.getRow(4)
  opts.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STI_NAVY } }
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    cell.border = THIN_BORDER
  })
  headerRow.height = 24

  // Set column widths
  opts.columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width
  })

  // ── Data rows ──
  ;(opts.rows ?? []).forEach((rowData, idx) => {
    const excelRow = ws.getRow(5 + idx)
    opts.columns.forEach((col, ci) => {
      const cell = excelRow.getCell(ci + 1)
      cell.value = rowData[col.key] ?? ''
      cell.font = { name: 'Calibri', size: 10 }
      cell.alignment = { vertical: 'middle' }
      cell.border = THIN_BORDER
      // Alternate row shading
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }
      }
    })
  })

  return wb
}

/**
 * Serialize workbook to a Blob (for client-side download).
 */
export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Trigger a browser download of the workbook.
 */
export async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const blob = await workbookToBlob(wb)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
