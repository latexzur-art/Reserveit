import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useBuildingEquipment } from '@/hooks/admin/building/useBuildingEquipment'

function res(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

// Three grouped rows spanning every ownership scope, shaped exactly like the
// equipment API's grouped output.
const groups = [
  { id: 'a1', ids: ['a1'], quantity: 1, displayCode: 'PC-001', equipmentCode: 'PC-001', equipmentName: 'Dell Desktop', brand: 'Dell', equipmentTypeId: 't-pc', currentStatusId: 's-available', assignedFacilityId: 'f1', assignedFacilityName: 'Lab 1', managedBy: 'it' },
  { id: 'b1', ids: ['b1'], quantity: 1, displayCode: 'PROJ-001', equipmentCode: 'PROJ-001', equipmentName: 'Epson Projector', brand: 'Epson', equipmentTypeId: 't-proj', currentStatusId: 's-inuse', assignedFacilityId: 'f2', assignedFacilityName: 'Room 204', managedBy: 'pamo' },
  { id: 'c1', ids: ['c1'], quantity: 1, displayCode: 'AC-001', equipmentCode: 'AC-001', equipmentName: 'Carrier Aircon', brand: 'Carrier', equipmentTypeId: 't-hvac', currentStatusId: 's-available', assignedFacilityId: null, assignedFacilityName: null, managedBy: 'building' },
]

describe('useBuildingEquipment — client-side filtering', () => {
  const mockFetch = vi.fn()

  // Only the list endpoint carries a query string; /types, /stats, /facilities do not.
  const listCalls = () =>
    mockFetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/admin/building/equipment?'),
    ).length

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/equipment/types')) return Promise.resolve(res({ types: [], statusTypes: [] }))
      if (url.includes('/equipment/stats')) return Promise.resolve(res({ total: 3, available: 2, inUse: 1, maintenance: 0 }))
      if (url.includes('/facilities')) return Promise.resolve(res({ facilities: [] }))
      // List endpoint returns the full grouped set regardless of query params.
      if (url.includes('/api/admin/building/equipment?')) return Promise.resolve(res({ equipment: groups, total: groups.length }))
      return Promise.resolve(res({}))
    })
    global.fetch = mockFetch as any
  })

  afterEach(() => vi.restoreAllMocks())

  it('does not refetch the equipment list when a filter changes', async () => {
    const { result } = renderHook(() => useBuildingEquipment())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listCalls()).toBe(1)

    act(() => result.current.setScopeFilter('it'))
    await waitFor(() => expect(result.current.equipment).toHaveLength(1))

    // Still a single list fetch — the narrowing happened in memory.
    expect(listCalls()).toBe(1)
  })

  it('applies the scope filter to the returned groups client-side', async () => {
    const { result } = renderHook(() => useBuildingEquipment())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.equipment).toHaveLength(3)

    act(() => result.current.setScopeFilter('it'))
    await waitFor(() => expect(result.current.equipment).toHaveLength(1))
    expect(result.current.equipment[0].equipmentCode).toBe('PC-001')
  })

  it('applies the search filter client-side without a refetch', async () => {
    const { result } = renderHook(() => useBuildingEquipment())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSearch('room 204'))
    await waitFor(() => expect(result.current.equipment).toHaveLength(1))
    expect(result.current.equipment[0].equipmentCode).toBe('PROJ-001')
    expect(listCalls()).toBe(1)
  })
})
