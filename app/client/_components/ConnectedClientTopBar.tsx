'use client'

import { RoleTopBar } from '@/components/shared/RoleTopBar'
import { UserProfile } from '@/components/layout/shared/UserProfile'
import { useClientLayout } from './ClientLayoutContext'
import { useNotifications } from '@/hooks/notifications/useNotifications'
import { ROUTES } from '@/lib/routes'

interface ConnectedClientTopBarProps {
  title?: string
  breadcrumbs?: { label: string; href?: string }[]
}

export function ConnectedClientTopBar({ title = 'ReserveIT', breadcrumbs = [] }: ConnectedClientTopBarProps) {
  const { toggleMobileMenu } = useClientLayout()
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications(15)

  return (
    <RoleTopBar
      title={title}
      breadcrumbs={breadcrumbs}
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkNotificationRead={markRead}
      onMarkAllNotificationsRead={markAllRead}
      onClearAllNotifications={clearAll}
      onOpenMessageCenter={() => {}}
      onMobileMenuToggle={toggleMobileMenu}
      formRoute={ROUTES.client.booking}
      calendarRoute={ROUTES.client.calendar}
      viewAllHref={ROUTES.client.notifications}
      profileMenu={<UserProfile />}
    />
  )
}
