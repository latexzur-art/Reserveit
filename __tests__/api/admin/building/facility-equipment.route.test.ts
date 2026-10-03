import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAuthGuard, mockBuildingAdminUser } from '../../../mocks/auth'
import { BA_FACILITY_ASSIGN_SCOPE } from '@/lib/auth/equipment-scope'

// A Building Admin is authenticated for every case here.
vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser as any))

// Spy on the service so we can assert exactly which method the route calls and
// with what scope — the wiring under test.
const svc = vi.hoisted(() => ({
  getUnitsForFacility: vi.fn(),
  getAll: vi.fn(),
  assignToFacility: vi.fn(),
  unassignFromFacility: vi.fn(),
  syncInventoryAmenities: vi.fn(),
}))

vi.mock('@/backend/admin/building', () => ({ BuildingEquipmentService: svc }))

import { GET, POST, DELETE } from '@/app/api/admin/building/facilities/[id]/equipment/route'

const FACILITY_ID = '123e4567-e89b-42d3-a456-426614174000'
const params = Promise.resolve({ id: FACILITY_ID })

function makeRequest(url: string, method = 'GET', body?: any) {
  const init: ConstructorParameters<typeof NextRequest>[1] = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

beforeEach(() => {
  vi.clearAllMocks()
  svc.getUnitsForFacility.mockResolvedValue([])
  svc.getAll.mockResolvedValue({ equipment: [], total: 0 })
  svc.assignToFacility.mockResolvedValue(['unit-x'])
  svc.unassignFromFacility.mockResolvedValue(undefined)
  svc.syncInventoryAmenities.mockResolvedValue(undefined)
})

describe('GET /api/admin/building/facilities/[id]/equipment', () => {
  it('returns per-unit rows via getUnitsForFacility when ?units=1', async () => {
    svc.getUnitsForFacility.mockResolvedValue([{ id: 'u1', equipmentCode: 'AC-101-01' }])

    const res = await GET(makeRequest(`http://localhost:3000/api/x?units=1`), { params } as any)
    const data = await res.json()

    expect(svc.getUnitsForFacility).toHaveBeenCalledWith(FACILITY_ID)
    expect(svc.getAll).not.toHaveBeenCalled()
    expect(data.equipment).toEqual([{ id: 'u1', equipmentCode: 'AC-101-01' }])
  })

  it('returns the grouped shape via getAll when ?units is absent (protects room-availability)', async () => {
    svc.getAll.mockResolvedValue({ equipment: [{ ids: ['a'], quantity: 2 }], total: 1 })

    const res = await GET(makeRequest(`http://localhost:3000/api/x`), { params } as any)
    const data = await res.json()

    expect(svc.getAll).toHaveBeenCalledWith({ facilityId: FACILITY_ID })
    expect(svc.getUnitsForFacility).not.toHaveBeenCalled()
    expect(data.equipment).toEqual([{ ids: ['a'], quantity: 2 }])
  })
})

describe('POST /api/admin/building/facilities/[id]/equipment', () => {
  it('assigns using the BA facility scope (pamo + building), so HVAC is allowed', async () => {
    const res = await POST(
      makeRequest(`http://localhost:3000/api/x`, 'POST', {
        assignments: [{ equipmentTypeId: 'type-ac', quantity: 2 }],
      }),
      { params } as any,
    )

    expect(res.status).toBe(200)
    expect(svc.assignToFacility).toHaveBeenCalledWith(
      FACILITY_ID, 'type-ac', 2, [...BA_FACILITY_ASSIGN_SCOPE],
    )
  })
})

describe('DELETE /api/admin/building/facilities/[id]/equipment', () => {
  it('unassigns using the BA facility scope (pamo + building)', async () => {
    const res = await DELETE(
      makeRequest(`http://localhost:3000/api/x`, 'DELETE', { assignments: ['unit-1'] }),
      { params } as any,
    )

    expect(res.status).toBe(200)
    expect(svc.unassignFromFacility).toHaveBeenCalledWith(['unit-1'], [...BA_FACILITY_ASSIGN_SCOPE])
  })
})
