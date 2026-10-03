import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EquipmentTable } from '@/app/admin/(building)/building/equipment/_components/EquipmentTable'

// A Building Admin sees every scope in one list. It may edit/delete its own HVAC
// (building) rows, directly Assign non-tech (PAMO) rows, and only Request-assign
// tech (IT) rows. This guards the scope gating wired to equipmentRowCapabilities.
const mkGroup = (managedBy: string, displayCode: string) => ({
  ids: [`${displayCode}-1`],
  displayCode,
  equipmentName: `${displayCode} name`,
  brand: 'Generic',
  currentStatusName: 'Available',
  equipmentTypeName: 'Type',
  assignedFacilityName: 'Room 1',
  quantity: 1,
  managedBy,
})

function renderTable(groups: any[]) {
  return render(
    <EquipmentTable
      equipment={groups}
      loading={false}
      stats={{ total: groups.length, available: 0, inUse: 0, maintenance: 0 } as any}
      selectedIds={[]}
      isAllPagesSelected={false}
      allVisibleIds={groups.flatMap((g) => g.ids)}
      isPageSelected={false}
      expandedGroups={new Set<string>()}
      toggleExpand={vi.fn()}
      handleSelectAll={vi.fn()}
      handleSelectGroup={vi.fn()}
      openEdit={vi.fn()}
      openAssign={vi.fn()}
      confirmDecommission={vi.fn()}
      setIsAllPagesSelected={vi.fn()}
      setSelectedIds={vi.fn()}
      currentPage={1}
      totalPages={1}
      setCurrentPage={vi.fn()}
    />,
  )
}

describe('EquipmentTable — Building Admin scope gating', () => {
  it('shows edit + deactivate controls for BA-owned HVAC (building) rows', () => {
    renderTable([mkGroup('building', 'HVAC-001')])
    expect(screen.getByRole('button', { name: /edit hvac-001/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deactivate hvac-001/i })).toBeInTheDocument()
  })

  it('gives IT-managed tech rows a Request-assign control but no edit/delete', () => {
    renderTable([mkGroup('it', 'TV-001')])
    expect(screen.getByRole('button', { name: /request assignment for tv-001/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit tv-001/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deactivate tv-001/i })).not.toBeInTheDocument()
  })

  it('gives PAMO-managed non-tech rows a direct Assign control but no edit/delete', () => {
    renderTable([mkGroup('pamo', 'PROJ-001')])
    expect(screen.getByRole('button', { name: /assign proj-001 to a facility/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit proj-001/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deactivate proj-001/i })).not.toBeInTheDocument()
  })

  it('calls openAssign when the Assign control is clicked', () => {
    const openAssign = vi.fn()
    render(
      <EquipmentTable
        equipment={[mkGroup('pamo', 'PROJ-002')]}
        loading={false}
        stats={{ total: 1, available: 0, inUse: 0, maintenance: 0 } as any}
        selectedIds={[]}
        isAllPagesSelected={false}
        allVisibleIds={['PROJ-002-1']}
        isPageSelected={false}
        expandedGroups={new Set<string>()}
        toggleExpand={vi.fn()}
        handleSelectAll={vi.fn()}
        handleSelectGroup={vi.fn()}
        openEdit={vi.fn()}
        openAssign={openAssign}
        confirmDecommission={vi.fn()}
        setIsAllPagesSelected={vi.fn()}
        setSelectedIds={vi.fn()}
        currentPage={1}
        totalPages={1}
        setCurrentPage={vi.fn()}
      />,
    )
    screen.getByRole('button', { name: /assign proj-002 to a facility/i }).click()
    expect(openAssign).toHaveBeenCalledTimes(1)
  })
})
