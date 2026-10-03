/**
 * Shared layout helpers for all email templates.
 */

export function wrapEmailLayout(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#003087;padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;">ReserveIT</p>
            <p style="margin:4px 0 0;color:#a8c4e8;font-size:13px;">STI College Lucena — Facility & Equipment Booking System</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 20px;color:#003087;font-size:18px;">${title}</h2>
            ${bodyContent}
          </td>
        </tr>
        <tr>
          <td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#888;font-size:12px;">
              This is an automated notification from ReserveIT.<br>
              STI College Lucena — Do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function row(label: string, value: string, highlight?: boolean): string {
  const bgStyle = highlight ? 'background:#fff3cd;' : ''
  const labelColor = highlight ? 'color:#856404;' : 'color:#003087;'
  const valueStyle = highlight ? 'color:#856404;font-weight:bold;' : 'color:#333;'
  return `
    <tr style="${bgStyle}">
      <td style="border:1px solid #dde;padding:10px 14px;font-weight:bold;${labelColor}width:40%;">${label}</td>
      <td style="border:1px solid #dde;padding:10px 14px;${valueStyle}">${value}</td>
    </tr>`
}

export function tableWrap(rows: string): string {
  return `<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">${rows}</table>`
}

export function actionButton(url: string, label: string): string {
  return `
    <p style="text-align:center;margin:28px 0 8px;">
      <a href="${url}" style="background:#003087;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
        ${label}
      </a>
    </p>`
}

// ── Template 1: Mismatched Reservation ──────────────────────────────────────
