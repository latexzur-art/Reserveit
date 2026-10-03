import { createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'payment-qr-codes'

export function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const marker = `/object/public/${bucket}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return url.slice(idx + marker.length) || null
  } catch {
    return null
  }
}

export interface PaymentQrCode {
  id: string
  label: string
  image_url: string
  account_name: string | null
  account_number: string | null
  category: string
  is_active: boolean
  display_order: number
  created_at: string
}

export const QrCodeService = {
  async listActive(): Promise<PaymentQrCode[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('payment_qr_codes')
      .select('id, label, image_url, account_name, account_number, category, is_active, display_order, created_at')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async listAll(): Promise<PaymentQrCode[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('payment_qr_codes')
      .select('id, label, image_url, account_name, account_number, category, is_active, display_order, created_at')
      .order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async create(input: { label: string; imageUrl: string; uploadedBy: string; accountName?: string; accountNumber?: string; category?: string }): Promise<PaymentQrCode> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('payment_qr_codes')
      .insert({
        label: input.label,
        image_url: input.imageUrl,
        uploaded_by: input.uploadedBy,
        account_name: input.accountName ?? null,
        account_number: input.accountNumber ?? null,
        category: input.category ?? 'other',
      })
      .select('id, label, image_url, account_name, account_number, category, is_active, display_order, created_at')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Failed to create QR code')
    return data
  },

  async update(id: string, patch: { label?: string; isActive?: boolean; displayOrder?: number; imageUrl?: string; category?: string }): Promise<void> {
    const supabase = createAdminClient()
    const updatePayload: Record<string, unknown> = {}
    if (patch.label !== undefined) updatePayload.label = patch.label
    if (patch.isActive !== undefined) updatePayload.is_active = patch.isActive
    if (patch.displayOrder !== undefined) updatePayload.display_order = patch.displayOrder
    if (patch.imageUrl !== undefined) updatePayload.image_url = patch.imageUrl
    if (patch.category !== undefined) updatePayload.category = patch.category

    const { error } = await supabase.from('payment_qr_codes').update(updatePayload).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async remove(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { data: inUse } = await supabase.from('payments').select('id').eq('qr_code_id', id).limit(1)
    if (inUse && inUse.length > 0) throw new Error('has_history')

    // Fetch image_url before deleting the row
    const { data: qrCode } = await supabase.from('payment_qr_codes').select('image_url').eq('id', id).single()

    const { error } = await supabase.from('payment_qr_codes').delete().eq('id', id)
    if (error) throw new Error(error.message)

    // Best-effort storage cleanup — don't fail the delete if this errors
    if (qrCode?.image_url) {
      const storagePath = extractStoragePath(qrCode.image_url, BUCKET)
      if (storagePath) {
        await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      }
    }
  },
}
