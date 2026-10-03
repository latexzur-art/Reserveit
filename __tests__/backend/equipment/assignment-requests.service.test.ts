import { describe, it, expect, vi, beforeEach } from 'vitest'

// Minimal fake Supabase client tailored to updateStatus's call chain:
//   read:  from(t).select(..).eq(..).single()
//   write: from(t).update(payload).eq(..).select(..).single()
//   rpc:   rpc('assign_equipment_facility', args)
const box: { current: any } = { current: null }

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => box.current,
}))

function makeFake(opts: { currentRow: any; rpcError?: any }) {
  const rpcCalls: any[] = []
  const client = {
    from() {
      let isUpdate = false
      const b: any = {
        select: () => b,
        eq: () => b,
        update: (payload: any) => { isUpdate = true; b._payload = payload; return b },
        single: async () =>
          isUpdate
            ? { data: { id: 'req-1', ...opts.currentRow, ...b._payload }, error: null }
            : { data: opts.currentRow, error: null },
      }
      return b
    },
    rpc: async (name: string, args: any) => { rpcCalls.push({ name, args }); return { error: opts.rpcError ?? null } },
    rpcCalls,
  }
  return client
}

import { EquipmentAssignmentRequestsService } from '@/backend/equipment/assignment-requests.service'

describe('EquipmentAssignmentRequestsService.updateStatus transitions', () => {
  beforeEach(() => { box.current = null })

  it('rejects an illegal skip (pending -> completed)', async () => {
    box.current = makeFake({ currentRow: { equipment_id: 'eq-1', to_facility_id: 'fac-1', status: 'pending' } })
    await expect(
      EquipmentAssignmentRequestsService.updateStatus('req-1', { status: 'completed', handledByUserId: 'u-1' }),
    ).rejects.toThrow()
    // must not have performed the move on an illegal transition
    expect((box.current as any).rpcCalls).toHaveLength(0)
  })

  it('allows a legal transition (pending -> approved)', async () => {
    box.current = makeFake({ currentRow: { equipment_id: 'eq-1', to_facility_id: 'fac-1', status: 'pending' } })
    const result = await EquipmentAssignmentRequestsService.updateStatus('req-1', { status: 'approved', handledByUserId: 'u-1' })
    expect(result.status).toBe('approved')
    expect((box.current as any).rpcCalls).toHaveLength(0)
  })

  it('runs the assign RPC on completion (in_progress -> completed)', async () => {
    box.current = makeFake({ currentRow: { equipment_id: 'eq-1', to_facility_id: 'fac-1', status: 'in_progress' } })
    await EquipmentAssignmentRequestsService.updateStatus('req-1', { status: 'completed', handledByUserId: 'u-1' })
    expect((box.current as any).rpcCalls).toHaveLength(1)
    expect((box.current as any).rpcCalls[0].name).toBe('assign_equipment_facility')
  })
})
