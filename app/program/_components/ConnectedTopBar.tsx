'use client'

import { RoleTopBar } from '@/components/shared/RoleTopBar'
import { UserProfile } from '@/components/layout/shared/UserProfile'
import { ROUTES } from '@/lib/routes'
import { useFacultyLayout } from './FacultyLayoutContext'
import { useNotifications } from '@/hooks/notifications/useNotifications'

interface ConnectedTopBarProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
}

/**
 * Wraps RoleTopBar with real notification data from the API.
 * Use this in every program-head page instead of manually passing notification props.
 */
export function ConnectedTopBar({ title, breadcrumbs = [] }: ConnectedTopBarProps) {
  const { toggleMobileMenu } = useFacultyLayout()
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications(15)

  return (
    <RoleTopBar
      title={title}
      portalTitle="Program Head Portal"
      breadcrumbs={breadcrumbs}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkNotificationRead={markRead}
      onMarkAllNotificationsRead={markAllRead}
      onClearAllNotifications={clearAll}
      onOpenMessageCenter={() => {}}
      onMobileMenuToggle={toggleMobileMenu}
      formRoute={ROUTES.program.form}
      calendarRoute={ROUTES.program.calendar}
      viewAllHref={ROUTES.program.notifications}
      profileMenu={<UserProfile settingsRoute={ROUTES.program.profile} />}
    />
  )
}
