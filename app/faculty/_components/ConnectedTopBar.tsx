'use client'

import { RoleTopBar } from '@/components/shared/RoleTopBar'
import { UserProfile } from '@/components/layout/shared/UserProfile'
import { ROUTES } from '@/lib/routes'
import { useFacultyLayout } from './FacultyLayoutContext'
import { useFacultyNotifications } from '@/hooks/faculty/useFacultyNotifications'

interface ConnectedTopBarProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
}

/**
 * Wraps RoleTopBar with real notification data from the API.
 * Use this in every faculty page instead of manually passing notification props.
 */
export function ConnectedTopBar({ title, breadcrumbs = [] }: ConnectedTopBarProps) {
  const { toggleMobileMenu } = useFacultyLayout()
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useFacultyNotifications(15)

  return (
    <RoleTopBar
      title={title}
      portalTitle="Faculty Portal"
      breadcrumbs={breadcrumbs}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkNotificationRead={markRead}
      onMarkAllNotificationsRead={markAllRead}
      onClearAllNotifications={clearAll}
      onOpenMessageCenter={() => {}}
      onMobileMenuToggle={toggleMobileMenu}
      formRoute={ROUTES.faculty.form}
      calendarRoute={ROUTES.faculty.calendar}
      viewAllHref={ROUTES.faculty.notifications}
      profileMenu={<UserProfile settingsRoute={ROUTES.faculty.profile} />}
    />
  )
}
