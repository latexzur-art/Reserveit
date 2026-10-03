/**
 * Course Approval — decision mutations (approve/reject/send-back/rollback).
 * @module backend/course/courseApproval.decisions
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { NotificationService } from '@/backend/notifications/notification.service'
import {
  curriculumBatchApprovedEmail,
  curriculumBatchRejectedEmail,
  curriculumBatchSentBackEmail,
} from '@/backend/notifications/emailTemplates'
import { loadBatchMeta, getReviewerName, formatReviewedAt } from './courseApproval.shared'
import { onCourseApproved } from './courseActivation'

export async function approveBatch(
  supabase: SupabaseClient,
  batchId: string,
  reviewerId: string,
  options: { selfApproved?: boolean } = {}
): Promise<{ approvedCount: number }> {
  const now = new Date().toISOString()
  const isSelfApproved = options.selfApproved === true

  // Approve all pending courses in the batch
  const { data: courses, error } = await supabase
    .from('courses')
    .update({
      approval_status: 'approved',
      approved_by: reviewerId,
      approved_at: now,
      updated_at: now,
      rejection_reason: null,
    })
    .eq('batch_upload_id', batchId)
    .eq('approval_status', 'pending')
    .select('id, course_code, course_name')

  if (error) throw new Error(`Failed to approve batch: ${error.message}`)

  // Count the true totals — handles the idempotent-retry case where some courses
  // were already approved in a previous partial run (the UPDATE above returns only
  // the rows changed in this call, not the running total).
  const [{ count: totalApproved }, { count: totalRejected }] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true })
      .eq('batch_upload_id', batchId).eq('approval_status', 'approved'),
    supabase.from('courses').select('id', { count: 'exact', head: true })
      .eq('batch_upload_id', batchId).eq('approval_status', 'rejected'),
  ])
  const approvedCount = courses?.length ?? 0
  const finalApproved = totalApproved ?? approvedCount
  const finalRejected = totalRejected ?? 0

  // Update batch status — partially_rejected if any courses still have rejections
  await supabase
    .from('course_uploads')
    .update({
      upload_status: finalRejected > 0 ? 'partially_rejected' : 'approved',
      approved_count: finalApproved,
      rejected_count: finalRejected,
      pending_count: 0,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', batchId)

  // Trigger auto-resolution of pending schedule entries (parallel, fire-and-forget errors)
  await Promise.all((courses ?? []).map(course => onCourseApproved(supabase, course.id).catch(() => {})))

  const [meta, reviewerName] = await Promise.all([
    loadBatchMeta(supabase, batchId),
    getReviewerName(supabase, reviewerId),
  ])

  // Audit log — tag the action so self-publish can be distinguished from peer-approval
  try { await supabase.from('audit_logs').insert({
    actor_id: reviewerId,
    action: isSelfApproved ? 'batch_self_published' : 'batch_approved',
    target_type: 'course_upload',
    target_id: batchId,
    details: {
      approvedCount: finalApproved,
      rejectedCount: finalRejected,
      selfApproved: isSelfApproved,
      departmentName: meta?.departmentName,
      termName: meta?.termName,
      totalEntries: meta?.totalEntries,
      uploaderNotes: meta?.uploaderNotes || null,
      courses: (courses ?? []).map(c => ({ course_code: c.course_code, course_name: c.course_name })),
    },
  }) } catch {}

  // Notify submitter — skipped on self-approve since reviewer IS the uploader
  if (!isSelfApproved) {
    try {
      if (meta?.submitterEmail) {
        const { subject, htmlBody } = curriculumBatchApprovedEmail({
          submitterName: meta.submitterName,
          departmentName: meta.departmentName,
          termName: meta.termName,
          approvedCount: finalApproved,
          reviewedByName: reviewerName,
          reviewedAt: formatReviewedAt(now),
          dashboardUrl: '/program/curriculum',
        })
        await sendBrevoEmail({ to: meta.submitterNotificationEmail ?? meta.submitterEmail, subject, htmlBody })
      }

      if (meta?.uploadedBy) {
        await NotificationService.create({
          user_id: meta.uploadedBy,
          title: 'Curriculum Submission Approved',
          message: `Your ${meta.departmentName} curriculum for ${meta.termName} has been approved (${finalApproved} courses).`,
          type: 'success',
          source_type: 'course_upload',
          source_id: batchId,
          priority: 'normal',
          action_url: '/program/curriculum',
        })
      }
    } catch (notifErr) {
      console.error('[courseApproval] approveBatch notification failed:', notifErr)
    }
  }

  return { approvedCount: finalApproved }
}

/**
 * Privileged self-publish wrapper used by the Academic Head publish route.
 * Uploader == approver, so we skip the program-head notification email and
 * tag the audit log as `batch_self_published`.
 *
 * The Academic Head's own batch may sit in `draft`, `pending_submission`, or
 * `validation_failed` before publish (not yet `submitted`). Promote it to
 * `submitted` so `approveBatch` sees pending courses and can transition them
 * to `approved`.
 */
export async function selfApproveBatch(
  supabase: SupabaseClient,
  batchId: string,
  userId: string
): Promise<{ approvedCount: number }> {
  const now = new Date().toISOString()

  // Verify the batch exists, the caller owns it, and it's in a publishable state.
  const { data: batch, error: loadErr } = await supabase
    .from('course_uploads')
    .select('id, upload_status, uploaded_by')
    .eq('id', batchId)
    .single()

  if (loadErr || !batch) {
    throw new Error('Batch not found')
  }

  if (batch.uploaded_by !== userId) {
    throw new Error('You can only self-publish your own uploads')
  }

  const publishableStatuses = ['draft', 'pending_submission', 'validation_failed', 'submitted']
  if (!publishableStatuses.includes(batch.upload_status)) {
    throw new Error(`Cannot publish a batch in status "${batch.upload_status}"`)
  }

  // Surface any pending or sent_back rows back to pending so approveBatch picks them up.
  await supabase
    .from('courses')
    .update({ approval_status: 'pending', updated_at: now })
    .eq('batch_upload_id', batchId)
    .eq('approval_status', 'sent_back')

  // Promote the batch to `submitted` so the lifecycle is consistent (submitted -> approved).
  if (batch.upload_status !== 'submitted') {
    await supabase
      .from('course_uploads')
      .update({
        upload_status: 'submitted',
        submitted_at: now,
        updated_at: now,
      })
      .eq('id', batchId)
  }

  return approveBatch(supabase, batchId, userId, { selfApproved: true })
}

export async function rejectBatchRows(
  supabase: SupabaseClient,
  batchId: string,
  courseIds: string[],
  reason: string,
  reviewerId: string
): Promise<{ rejectedCount: number }> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('courses')
    .update({
      approval_status: 'rejected',
      rejection_reason: reason,
      approved_by: reviewerId,
      approved_at: now,
      updated_at: now,
    })
    .eq('batch_upload_id', batchId)
    .in('id', courseIds)
    .select('id, course_code, course_name')

  if (error) throw new Error(`Failed to reject courses: ${error.message}`)

  // Check if all courses are now resolved
  const { count: pendingCount } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('batch_upload_id', batchId)
    .eq('approval_status', 'pending')

  const rejectedCount = data?.length ?? 0

  // Update batch
  await supabase
    .from('course_uploads')
    .update({
      upload_status: (pendingCount ?? 0) === 0 ? 'partially_rejected' : 'submitted',
      rejected_count: rejectedCount,
      pending_count: pendingCount ?? 0,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', batchId)

  const [meta, reviewerName] = await Promise.all([
    loadBatchMeta(supabase, batchId),
    getReviewerName(supabase, reviewerId),
  ])

  // Audit log
  try { await supabase.from('audit_logs').insert({
    actor_id: reviewerId,
    action: 'batch_rows_rejected',
    target_type: 'course_upload',
    target_id: batchId,
    details: {
      rejectedCount,
      reason,
      departmentName: meta?.departmentName,
      termName: meta?.termName,
      totalEntries: meta?.totalEntries,
      uploaderNotes: meta?.uploaderNotes || null,
      courses: (data ?? []).map(c => ({ course_code: c.course_code, course_name: c.course_name })),
    },
  }) } catch {}

  // Notify submitter
  try {
    if (meta?.submitterEmail) {
      const { subject, htmlBody } = curriculumBatchRejectedEmail({
        submitterName: meta.submitterName,
        departmentName: meta.departmentName,
        termName: meta.termName,
        rejectedCount,
        reason,
        reviewedByName: reviewerName,
        reviewedAt: formatReviewedAt(now),
        dashboardUrl: '/program/curriculum',
      })
      await sendBrevoEmail({ to: meta.submitterNotificationEmail ?? meta.submitterEmail, subject, htmlBody })
    }

    if (meta?.uploadedBy) {
      await NotificationService.create({
        user_id: meta.uploadedBy,
        title: 'Courses Rejected in Your Submission',
        message: `${rejectedCount} course(s) in your ${meta.departmentName} submission were rejected. Reason: ${reason}`,
        type: 'error',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'high',
        action_url: '/program/curriculum',
      })
    }
  } catch (notifErr) {
    console.error('[courseApproval] rejectBatchRows notification failed:', notifErr)
  }

  return { rejectedCount }
}

export async function rejectBatch(
  supabase: SupabaseClient,
  batchId: string,
  reason: string,
  reviewerId: string
): Promise<void> {
  const now = new Date().toISOString()

  const { data: courses } = await supabase
    .from('courses')
    .update({
      approval_status: 'rejected',
      rejection_reason: reason,
      approved_by: reviewerId,
      approved_at: now,
      updated_at: now,
    })
    .eq('batch_upload_id', batchId)
    .eq('approval_status', 'pending')
    .select('id, course_code, course_name')

  const rejectedCount = courses?.length ?? 0

  await supabase
    .from('course_uploads')
    .update({
      upload_status: 'rejected',
      rejected_count: rejectedCount,
      pending_count: 0,
      reviewed_by: reviewerId,
      reviewed_at: now,
      review_notes: reason,
      updated_at: now,
    })
    .eq('id', batchId)

  const [meta, reviewerName] = await Promise.all([
    loadBatchMeta(supabase, batchId),
    getReviewerName(supabase, reviewerId),
  ])

  // Audit log
  try { await supabase.from('audit_logs').insert({
    actor_id: reviewerId,
    action: 'batch_rejected',
    target_type: 'course_upload',
    target_id: batchId,
    details: {
      rejectedCount,
      reason,
      departmentName: meta?.departmentName,
      termName: meta?.termName,
      totalEntries: meta?.totalEntries,
      uploaderNotes: meta?.uploaderNotes || null,
      courses: (courses ?? []).map(c => ({ course_code: c.course_code, course_name: c.course_name })),
    },
  }) } catch {}

  // Notify submitter
  try {
    if (meta?.submitterEmail) {
      const { subject, htmlBody } = curriculumBatchRejectedEmail({
        submitterName: meta.submitterName,
        departmentName: meta.departmentName,
        termName: meta.termName,
        rejectedCount,
        reason,
        reviewedByName: reviewerName,
        reviewedAt: formatReviewedAt(now),
        dashboardUrl: '/program/curriculum',
      })
      await sendBrevoEmail({ to: meta.submitterNotificationEmail ?? meta.submitterEmail, subject, htmlBody })
    }

    if (meta?.uploadedBy) {
      await NotificationService.create({
        user_id: meta.uploadedBy,
        title: 'Curriculum Submission Rejected',
        message: `Your ${meta.departmentName} curriculum submission for ${meta.termName} was rejected. Reason: ${reason}`,
        type: 'error',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'high',
        action_url: '/program/curriculum',
      })
    }
  } catch (notifErr) {
    console.error('[courseApproval] rejectBatch notification failed:', notifErr)
  }
}

export async function sendBackBatch(
  supabase: SupabaseClient,
  batchId: string,
  notes: string,
  reviewerId: string
): Promise<void> {
  const now = new Date().toISOString()

  const { data: sentBack } = await supabase
    .from('courses')
    .update({
      approval_status: 'sent_back',
      rejection_reason: notes,
      updated_at: now,
    })
    .eq('batch_upload_id', batchId)
    .eq('approval_status', 'pending')
    .select('id, course_code, course_name')

  await supabase
    .from('course_uploads')
    .update({
      upload_status: 'draft',
      review_notes: notes,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', batchId)

  const [meta, reviewerName] = await Promise.all([
    loadBatchMeta(supabase, batchId),
    getReviewerName(supabase, reviewerId),
  ])

  // Audit log
  try { await supabase.from('audit_logs').insert({
    actor_id: reviewerId,
    action: 'batch_sent_back',
    target_type: 'course_upload',
    target_id: batchId,
    details: {
      notes,
      sentBackCount: sentBack?.length ?? 0,
      departmentName: meta?.departmentName,
      termName: meta?.termName,
      totalEntries: meta?.totalEntries,
      uploaderNotes: meta?.uploaderNotes || null,
      courses: (sentBack ?? []).map(c => ({ course_code: c.course_code, course_name: c.course_name })),
    },
  }) } catch {}

  // Notify submitter
  try {
    if (meta?.submitterEmail) {
      const { subject, htmlBody } = curriculumBatchSentBackEmail({
        submitterName: meta.submitterName,
        departmentName: meta.departmentName,
        termName: meta.termName,
        notes,
        reviewedByName: reviewerName,
        reviewedAt: formatReviewedAt(now),
        revisionsUrl: '/program/curriculum',
      })
      await sendBrevoEmail({ to: meta.submitterNotificationEmail ?? meta.submitterEmail, subject, htmlBody })
    }

    if (meta?.uploadedBy) {
      await NotificationService.create({
        user_id: meta.uploadedBy,
        title: 'Curriculum Submission Returned for Revisions',
        message: `Your ${meta.departmentName} submission for ${meta.termName} was returned. Please revise and resubmit.`,
        type: 'warning',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'high',
        action_url: '/program/curriculum',
      })
    }
  } catch (notifErr) {
    console.error('[courseApproval] sendBackBatch notification failed:', notifErr)
  }
}

export async function rollbackBatch(
  supabase: SupabaseClient,
  batchId: string,
  reviewerId: string
): Promise<{ rolledBackCount: number }> {
  const now = new Date().toISOString()

  // Verify the batch exists and is in a rollback-eligible status
  const { data: batch } = await supabase
    .from('course_uploads')
    .select('upload_status, uploaded_by')
    .eq('id', batchId)
    .single()

  if (!batch) throw new Error('Batch not found')
  if (!['approved', 'partially_rejected'].includes(batch.upload_status)) {
    throw new Error(`Cannot roll back a batch with status "${batch.upload_status}"`)
  }

  // Reset approved courses back to pending
  const { data: rolledBack, error } = await supabase
    .from('courses')
    .update({
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      updated_at: now,
    })
    .eq('batch_upload_id', batchId)
    .eq('approval_status', 'approved')
    .select('id')

  if (error) throw new Error(`Failed to roll back courses: ${error.message}`)
  const rolledBackCount = rolledBack?.length ?? 0

  if (rolledBack && rolledBack.length > 0) {
    const courseIds = rolledBack.map(c => c.id)
    const { error: deleteErr } = await supabase
      .from('term_course_activations')
      .delete()
      .in('course_id', courseIds)
    if (deleteErr) console.error('[courseApproval] failed to cleanup activations during rollback:', deleteErr)
  }

  // Revert batch to submitted so it re-enters the approval queue
  await supabase
    .from('course_uploads')
    .update({
      upload_status: 'submitted',
      approved_count: 0,
      pending_count: rolledBackCount,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: now,
    })
    .eq('id', batchId)

  // Audit log
  try { await supabase.from('audit_logs').insert({
    actor_id: reviewerId,
    action: 'batch_rolled_back',
    target_type: 'course_upload',
    target_id: batchId,
    details: { rolledBackCount },
  }) } catch {}

  // Notify the submitter
  try {
    const [meta, reviewerName] = await Promise.all([
      loadBatchMeta(supabase, batchId),
      getReviewerName(supabase, reviewerId),
    ])
    if (meta?.uploadedBy) {
      await NotificationService.create({
        user_id: meta.uploadedBy,
        title: 'Curriculum Approval Rolled Back',
        message: `The approval of your ${meta.departmentName} curriculum for ${meta.termName} was rolled back by ${reviewerName}. It is now back in the review queue.`,
        type: 'warning',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'high',
        action_url: '/program/curriculum',
      })
    }
  } catch (notifErr) {
    console.error('[courseApproval] rollbackBatch notification failed:', notifErr)
  }

  return { rolledBackCount }
}
