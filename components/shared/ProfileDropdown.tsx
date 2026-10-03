'use client'

import { useRouter } from 'next/navigation'
import { User, Settings, LogOut, ChevronDown, Building2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'

interface ProfileDropdownProps {
  /** Where the Settings menu item navigates — role-specific. */
  settingsRoute?: string
}

export const ProfileDropdown = ({ settingsRoute = '/faculty/profile' }: ProfileDropdownProps) => {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  if (loading || !user) {
    return (
      <div className="flex items-center gap-2 px-2 h-auto py-1.5">
        <div className="text-right hidden sm:block">
          <div className="h-3 w-24 bg-muted rounded animate-pulse mb-1" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
        <Avatar className="h-9 w-9 border-2 border-primary/20">
          <AvatarFallback className="bg-muted animate-pulse" />
        </Avatar>
      </div>
    )
  }

  const displayName = user.fullName || user.email || ''
  const email = user.email || ''
  const primaryRole = user.roles?.[0]?.displayName || ''
  const departmentName = user.department?.name
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2 h-auto py-1.5 text-foreground hover:bg-muted">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{displayName}</p>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">{primaryRole}</Badge>
              {departmentName && (
                <p className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                  <Building2 className="h-2.5 w-2.5" />{departmentName}
                </p>
              )}
            </div>
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">{email}</span>
              {departmentName && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />{departmentName}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(settingsRoute)}>
            <User className="mr-2 h-4 w-4" /> My Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(settingsRoute)}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
