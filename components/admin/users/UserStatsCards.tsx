'use client'

import { Users, Building, Globe, GraduationCap } from 'lucide-react'
import { StatRibbon } from '@/components/admin/dashboard/StatRibbon'

interface StatsCardsProps {
  total: number
  internal: number
  external: number
  faculty: number
}

export const UserStatsCards = ({ total, internal, external, faculty }: StatsCardsProps) => {
  return (
    <StatRibbon
      items={[
        { label: 'Total', value: total, hint: 'All registered', icon: Users },
        { label: 'Internal', value: internal, hint: 'Staff & students', icon: Building },
        { label: 'External', value: external, hint: 'Organizations', icon: Globe },
        { label: 'Faculty', value: faculty, hint: 'Teaching staff', icon: GraduationCap },
      ]}
    />
  )
}
