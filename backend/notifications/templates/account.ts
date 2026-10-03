import { wrapEmailLayout, row, tableWrap } from './shared'

export function passwordResetEmail(data: {
  userName: string
  signInEmail: string
  tempPassword: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>,<br>
      A password reset was requested for your <strong>ReserveIT</strong> account.
      Your temporary password is included below.
    </p>
    ${tableWrap(
      row('Sign-in Email', data.signInEmail) +
      row('Temporary Password', `<span style="font-family:monospace;font-size:15px;font-weight:bold;color:#003087;">${data.tempPassword}</span>`, true)
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;"><strong>Next Steps:</strong></p>
    <ol style="color:#555;line-height:1.8;padding-left:20px;">
      <li>Go to the <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/client/login" style="color:#003087;">ReserveIT login page</a></li>
      <li>Sign in with your email and the temporary password above</li>
      <li>You will be prompted to create a new permanent password</li>
    </ol>
    <p style="color:#e85000;font-size:13px;margin-top:16px;">
      This temporary password is one-time use only and will expire in 24 hours.
      Never share your password with anyone. ReserveIT admin will never ask for your password.
    </p>
    <p style="color:#555;font-size:13px;">If you did not request this, contact the administrator immediately.</p>`

  return {
    subject: 'Your ReserveIT Account — Temporary Password Included',
    htmlBody: wrapEmailLayout('Password Reset — Temporary Password', body),
  }
}

// ── Email 2: Booking Confirmation ────────────────────────────────────────────

export function scoreResetApprovedEmail(data: {
  userName: string
  decidedBy: string
  notes?: string | null
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your reliability score reset request has been <strong style="color:#27ae60;">approved</strong>.
    </p>
    ${tableWrap(
      row('Approved By', data.decidedBy) +
      (data.notes ? row('Notes', data.notes) : '') +
      row('Result', '<span style="color:#27ae60;font-weight:bold;">Score Reset to 0</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      Your reliability score has been reset. Please continue to observe proper booking practices to maintain a good standing.
    </p>`

  return {
    subject: '[ReserveIT] Reliability Score Reset Approved',
    htmlBody: wrapEmailLayout('Reliability Score Reset Approved', body),
  }
}

export function scoreResetByAcademicHeadEmail(data: {
  userName: string
  decidedBy: string
  notes?: string | null
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your reliability score has been reset by an Academic Head.
    </p>
    ${tableWrap(
      row('Reset By', data.decidedBy) +
      (data.notes ? row('Notes', data.notes) : '') +
      row('Result', '<span style="color:#27ae60;font-weight:bold;">Score Reset to 0</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      Your reliability score has been reset. Please continue to observe proper booking practices to maintain a good standing.
    </p>`

  return {
    subject: '[ReserveIT] Reliability Score Reset by Academic Head',
    htmlBody: wrapEmailLayout('Reliability Score Reset', body),
  }
}

export function scoreResetRequestedEmail(data: {
  requesterName: string
  requesterRole: string
  count: number
  threshold: number
  reason: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      <strong>${data.requesterName}</strong> (${data.requesterRole}) has submitted a request to reset their cancellation counter.
    </p>
    ${tableWrap(
      row('Requester', data.requesterName) +
      row('Role', data.requesterRole) +
      row('Counter', `${data.count} / ${data.threshold}`) +
      row('Reason', data.reason, true)
    )}
    <p style="color:#555;line-height:1.6;">
      Please review the request in the Building Admin panel.
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${data.reviewUrl}" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Review Request</a>
    </p>`

  return {
    subject: '[ReserveIT] Cancellation Counter Reset Request',
    htmlBody: wrapEmailLayout('Reset Request Received', body),
  }
}

export function scoreResetRequestAcknowledgedEmail(data: {
  userName: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your cancellation counter reset request has been received and is now pending review by the Building Admin.
    </p>
    <p style="color:#555;line-height:1.6;">
      You will be notified once a decision has been made. In the meantime, you may continue making reservations as normal.
    </p>`

  return {
    subject: '[ReserveIT] Reset Request Received',
    htmlBody: wrapEmailLayout('Reset Request Received', body),
  }
}

export function scoreResetDeclinedEmail(data: {
  userName: string
  decidedBy: string
  notes?: string | null
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your cancellation counter reset request has been <strong style="color:#e74c3c;">declined</strong>.
    </p>
    ${tableWrap(
      row('Reviewed By', data.decidedBy) +
      (data.notes ? row('Notes', data.notes) : '') +
      row('Result', '<span style="color:#e74c3c;font-weight:bold;">Request Declined</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      If you believe this was in error, please contact the Building Admin directly.
    </p>`

  return {
    subject: '[ReserveIT] Reset Request Declined',
    htmlBody: wrapEmailLayout('Reset Request Declined', body),
  }
}

export function scoreResetBulkDigestEmail(data: {
  academicHeadName: string
  affectedCount: number
  scopeLabel: string
  decidedAt: string
  notes?: string | null
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.academicHeadName}</strong>, this is a confirmation that the bulk reliability score reset you triggered has completed.
    </p>
    ${tableWrap(
      row('Action', '<span style="color:#27ae60;font-weight:bold;">Bulk Score Reset</span>', true) +
      row('Scope', data.scopeLabel) +
      row('Accounts Affected', `<strong>${data.affectedCount}</strong>`) +
      row('Completed At', data.decidedAt) +
      (data.notes ? row('Notes', data.notes) : '')
    )}
    <p style="color:#555;line-height:1.6;">
      All affected teaching staff now have their cancellation counters reset to <strong>0</strong>. No further action is required from you.
    </p>`

  return {
    subject: `[ReserveIT] Bulk Score Reset — ${data.affectedCount} account${data.affectedCount === 1 ? '' : 's'} affected`,
    htmlBody: wrapEmailLayout('Bulk Score Reset Complete', body),
  }
}

// ── Building Admin: Violations Cleared ───────────────────────────────────────

export function violationsClearedEmail(data: {
  userName: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const roleSuffix = data.userRole ? ` (${data.userRole})` : ''
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}${roleSuffix}</strong>, your violation history has been <strong style="color:#27ae60;">cleared</strong> by the Building Admin.
    </p>
    ${tableWrap(
      row('Action', '<span style="color:#27ae60;font-weight:bold;">Violations Cleared</span>', true) +
      row('Account Status', 'Active — full standing') +
      row('Scoring Penalty', 'Removed')
    )}
    <p style="color:#555;line-height:1.6;">
      Your account is now in good standing and eligible for auto-approval on future booking requests. Past violation logs have been removed from the scoring engine.
    </p>
    <p style="color:#555;line-height:1.6;">
      Please continue to observe proper booking practices to maintain this standing.
    </p>`

  return {
    subject: '[ReserveIT] Your Violation Record Has Been Cleared',
    htmlBody: wrapEmailLayout('Violation Record Cleared', body),
  }
}

// ── Special Event — Review Request (to Academic Head + Building Admin) ────────

export function accountProbationEmail(data: {
  userName: string
  adminName: string
  reason: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your account has been placed on <strong style="color:#d97706;">probation</strong> by the Building Admin.
    </p>
    ${tableWrap(
      row('Action', '<span style="color:#d97706;font-weight:bold;">Account Placed on Probation</span>', true) +
      row('Imposed By', data.adminName) +
      row('Reason', data.reason)
    )}
    <p style="color:#555;line-height:1.6;">
      While on probation, <strong>all your booking requests will require manual administrator approval</strong> — they will not be auto-approved regardless of your score.
    </p>
    <p style="color:#555;line-height:1.6;">
      If you believe this is a mistake, please contact the Building Admin directly.
    </p>`

  return {
    subject: '[ReserveIT] Your Account Has Been Placed on Probation',
    htmlBody: wrapEmailLayout('Account Probation Notice', body),
  }
}

export function accountRestrictedEmail(data: {
  userName: string
  adminName: string
  reason: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your account has been <strong style="color:#e74c3c;">restricted</strong> by the Building Admin.
    </p>
    ${tableWrap(
      row('Action', '<span style="color:#e74c3c;font-weight:bold;">Account Restricted</span>', true) +
      row('Imposed By', data.adminName) +
      row('Reason', data.reason)
    )}
    <p style="color:#555;line-height:1.6;">
      While restricted, <strong>you are unable to submit any booking requests</strong>. This restriction will remain until it is manually lifted by the Building Admin.
    </p>
    <p style="color:#555;line-height:1.6;">
      If you believe this is a mistake, please contact the Building Admin directly.
    </p>`

  return {
    subject: '[ReserveIT] Your Account Has Been Restricted',
    htmlBody: wrapEmailLayout('Account Restriction Notice', body),
  }
}

// ── Schedule Email: Batch Decision (multi-outcome combined notice) ───────────
