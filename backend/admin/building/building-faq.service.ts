import { createAdminClient } from '@/lib/supabase/server'

export interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  role_tags: string[]
  sort_order: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FAQFilters {
  role?: string
  search?: string
  category?: string
  includeInactive?: boolean
  page?: number
  pageSize?: number
}

export interface CreateFAQInput {
  question: string
  answer: string
  category: string
  role_tags: string[]
  sort_order?: number
  is_active?: boolean
  created_by?: string
}

export interface UpdateFAQInput {
  question?: string
  answer?: string
  category?: string
  role_tags?: string[]
  sort_order?: number
  is_active?: boolean
}

export const BuildingFAQService = {
  async getAll(filters: FAQFilters = {}): Promise<{ items: FAQItem[]; total: number }> {
    const supabase = createAdminClient()
    const { role, search, category, includeInactive = false, page = 1, pageSize = 100 } = filters

    let query = supabase
      .from('faq_items')
      .select('*', { count: 'exact' })
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (role) {
      query = query.or(`role_tags.cs.{"${role}"},role_tags.cs.{"all"}`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%,category.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)
    return { items: (data ?? []) as FAQItem[], total: count ?? 0 }
  },

  async getById(id: string): Promise<FAQItem> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)
    return data as FAQItem
  },

  async create(input: CreateFAQInput): Promise<FAQItem> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('faq_items')
      .insert({
        question: input.question,
        answer: input.answer,
        category: input.category,
        role_tags: input.role_tags,
        sort_order: input.sort_order ?? 0,
        is_active: input.is_active ?? true,
        created_by: input.created_by ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as FAQItem
  },

  async update(id: string, input: UpdateFAQInput): Promise<FAQItem> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('faq_items')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as FAQItem
  },

  async delete(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase.from('faq_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async getCategories(): Promise<string[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('faq_items')
      .select('category')
      .eq('is_active', true)
      .order('category', { ascending: true })

    if (error) throw new Error(error.message)
    return [...new Set((data ?? []).map((r: any) => r.category as string))]
  },
}
