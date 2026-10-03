import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserActionsMenu } from '@/components/admin/users/UserActionsMenu'
import type { User } from '@/backend/admin/admin.types'

const mockManualUser: User = {
  id: 'usr-manual-1',
  email: 'manual@example.com',
  notificationEmail: 'manual-notif@example.com',
  firstName: 'Manual',
  lastName: 'User',
  role: 'Building Admin',
  roleName: 'building_admin',
  roleId: 'role-1',
  departmentId: 'dept-1',
  status: 'Active',
  type: 'Internal',
  department: 'IT',
  bookingsCount: 0,
  createdAt: new Date('2026-01-01'),
}

const mockEntraUser: User = {
  ...mockManualUser,
  id: 'usr-entra-1',
  email: 'entra@example.com',
  entraObjectId: 'entra-guid-1234',
}

describe('UserActionsMenu Component', () => {
  it('renders "Reset Password" option for manual users (without entraObjectId)', async () => {
    const onResetPassword = vi.fn()
    render(
      <UserActionsMenu
        user={mockManualUser}
        onEdit={vi.fn()}
        onResetPassword={onResetPassword}
        onSendMessage={vi.fn()}
        onForceLogout={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Open dropdown menu via pointerDown / click
    const trigger = screen.getByRole('button', { name: /Actions for Manual User/i })
    fireEvent.pointerDown(trigger)

    // Verify Reset Password menu item is rendered
    const resetItem = await screen.findByText(/Reset Password/i)
    expect(resetItem).toBeInTheDocument()

    // Trigger click
    fireEvent.click(resetItem)
    expect(onResetPassword).toHaveBeenCalledTimes(1)
  })

  it('renders "Reset Password" option for Entra users (with entraObjectId)', async () => {
    const onResetPassword = vi.fn()
    render(
      <UserActionsMenu
        user={mockEntraUser}
        onEdit={vi.fn()}
        onResetPassword={onResetPassword}
        onSendMessage={vi.fn()}
        onForceLogout={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Open dropdown menu
    const trigger = screen.getByRole('button', { name: /Actions for Manual User/i })
    fireEvent.pointerDown(trigger)

    // Verify Reset Password menu item is rendered
    const resetItem = await screen.findByText(/Reset Password/i)
    expect(resetItem).toBeInTheDocument()

    // Trigger click
    fireEvent.click(resetItem)
    expect(onResetPassword).toHaveBeenCalledTimes(1)
  })
})
