import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssignedEquipmentList } from '@/app/admin/(building)/building/facility-management/_components/AssignedEquipmentList'

// The facility editor's "Managed Assets" list must show each aircon/HVAC unit as
// its own row — asset code, brand + model, and per-unit status — plus how many
// units of that type are still available in storage. This is the payoff of the
// per-unit request: no more anonymous "N Units".
const unit = (o: Record<string, any>) => ({
  id: 'u1',
  equipmentCode: 'AC-101-01',
  equipmentName: 'Split-type Aircon',
  equipmentTypeId: 'type-ac',
  equipmentTypeName: 'Air Conditioning',
  brand: 'Carrier',
  model: '1.5HP',
  serialNumber: 'SN-1',
  currentStatusName: 'Available',
  ...o,
})

describe('AssignedEquipmentList', () => {
  it('renders each physical unit with its own asset code, brand + model, and status', () => {
    render(
      <AssignedEquipmentList
        assignedUnits={[
          unit({ id: 'u1', equipmentCode: 'AC-101-01', brand: 'Carrier', model: '1.5HP', currentStatusName: 'Available' }),
          unit({ id: 'u2', equipmentCode: 'AC-101-02', brand: 'Daikin', model: '2.0HP', currentStatusName: 'Under Maintenance' }),
        ]}
        availableCountByType={{ 'type-ac': 5 }}
        onUnassign={vi.fn()}
      />,
    )

    // Two units of the same type stay as two distinct rows (not collapsed).
    expect(screen.getByText('AC-101-01')).toBeInTheDocument()
    expect(screen.getByText('AC-101-02')).toBeInTheDocument()
    expect(screen.getByText(/Carrier/)).toBeInTheDocument()
    expect(screen.getByText(/Daikin/)).toBeInTheDocument()
    expect(screen.getByText(/Under Maintenance/i)).toBeInTheDocument()
  })

  it('shows how many units of that type are available in storage, and the assigned count', () => {
    render(
      <AssignedEquipmentList
        assignedUnits={[unit({ id: 'u1', equipmentTypeId: 'type-ac' })]}
        availableCountByType={{ 'type-ac': 5 }}
        onUnassign={vi.fn()}
      />,
    )

    expect(screen.getByText(/5 available in storage/i)).toBeInTheDocument()
    expect(screen.getByText(/1 assigned/i)).toBeInTheDocument()
  })

  it('calls onUnassign with the unit id when that unit’s remove control is clicked', () => {
    const onUnassign = vi.fn()
    render(
      <AssignedEquipmentList
        assignedUnits={[unit({ id: 'u1', equipmentCode: 'AC-101-01' })]}
        availableCountByType={{}}
        onUnassign={onUnassign}
      />,
    )

    screen.getByRole('button', { name: /unassign ac-101-01/i }).click()
    expect(onUnassign).toHaveBeenCalledWith('u1')
  })

  it('renders nothing when there are no assigned units (parent owns the empty state)', () => {
    const { container } = render(
      <AssignedEquipmentList assignedUnits={[]} availableCountByType={{}} onUnassign={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
