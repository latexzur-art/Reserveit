import ExcelJS from 'exceljs'

/**
 * Parse the first worksheet of an .xlsx file into objects keyed by the header
 * row (drop-in replacement for xlsx's sheet_to_json for simple sheets).
 * Dates are normalized to YYYY-MM-DD strings.
 */
export async function parseExcelRows(file: File): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const ws = workbook.worksheets[0]
  if (!ws) return []

  const headers: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cell.value ?? '').trim()
  })

  const rows: Record<string, unknown>[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: Record<string, unknown> = {}
    let hasValue = false
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col]
      if (!key) return
      let v: unknown = cell.value
      if (v && typeof v === 'object') {
        if (v instanceof Date) v = v.toISOString().slice(0, 10)
        else if ('result' in (v as Record<string, unknown>)) v = (v as { result: unknown }).result
        else if ('richText' in (v as Record<string, unknown>))
          v = (v as { richText: Array<{ text: string }> }).richText.map((t) => t.text).join('')
        else if ('text' in (v as Record<string, unknown>)) v = (v as { text: unknown }).text
      }
      obj[key] = v
      if (v !== null && v !== undefined && v !== '') hasValue = true
    })
    if (hasValue) rows.push(obj)
  })
  return rows
}
