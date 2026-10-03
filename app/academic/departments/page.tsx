"use client"

import { useState, useMemo } from 'react'
import { useAcademicReservations } from '@/hooks/academic-head/useAcademicReservations'
import { useAcademicStaff } from '@/hooks/academic-head/useAcademicStaff'
import { Badge } from '@/components/ui/badge'
import {
    Users,
    MapPin,
    Calendar,
    ChevronRight,
    Search,
    Building,
    ArrowLeft,
    Mail,
    UserCircle,
    ShieldCheck,
    LayoutGrid,
    Contact
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'
import { StaffScheduleDrawer, type DrawerStaff } from '@/components/academic/departments/StaffScheduleDrawer'

export default function DepartmentsPage() {
    const { departments, loading: deptsLoading } = useAcademicReservations()
    const [viewMode, setViewMode] = useState<'grid' | 'directory' | 'detail'>('grid')
    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
    const [staffSearch, setStaffSearch] = useState('')
    const [selectedStaff, setSelectedStaff] = useState<DrawerStaff | null>(null)

    const selectedDept = useMemo(() => 
        departments.find(d => d.id === selectedDeptId),
        [departments, selectedDeptId]
    )

    const { staff, loading: staffLoading } = useAcademicStaff(
        viewMode === 'detail' ? selectedDeptId ?? undefined : undefined
    )

    const filteredStaff = useMemo(() => {
        if (!staffSearch) return staff
        const s = staffSearch.toLowerCase()
        return staff.filter(m => 
            m.name.toLowerCase().includes(s) || 
            m.email.toLowerCase().includes(s) ||
            m.departmentName.toLowerCase().includes(s) ||
            m.departmentCode.toLowerCase().includes(s)
        )
    }, [staff, staffSearch])

    const handleViewDetail = (deptId: string) => {
        setSelectedDeptId(deptId)
        setViewMode('detail')
    }

    const handleBack = () => {
        setViewMode('grid')
        setSelectedDeptId(null)
    }

    const renderStaffCard = (member: any) => (
        <div
            key={member.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedStaff({
                id: member.id,
                name: member.name,
                email: member.email,
                departmentCode: member.departmentCode,
                roles: member.roles,
                isProgramHead: member.isProgramHead,
                avatarUrl: member.avatarUrl ?? null,
            })}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedStaff({
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        departmentCode: member.departmentCode,
                        roles: member.roles,
                        isProgramHead: member.isProgramHead,
                        avatarUrl: member.avatarUrl ?? null,
                    })
                }
            }}
            className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-xl hover:border-blue-500/40 transition-all cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12 border-2 border-slate-100 dark:border-slate-800 shrink-0">
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                    <AvatarFallback className="bg-slate-900 dark:bg-slate-800 text-white font-bold">
                        {member.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{member.name}</h4>
                        {member.isProgramHead && (
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/10 px-2 py-0 h-5 text-[9px] uppercase font-black shrink-0">
                                <ShieldCheck className="w-3 h-3 mr-1 shrink-0" />
                                Head
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3 min-w-0">
                        <Mail className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        <span className="truncate">{member.email}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[9px] font-bold border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 uppercase tracking-tight">
                            {member.departmentCode}
                        </Badge>
                        {member.roles.map((r: string) => (
                            <Badge key={r} variant="secondary" className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none capitalize">
                                {formatEnumLabel(r)}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="flex-1 flex flex-col space-y-6 sm:space-y-8 p-4 sm:p-0">
            {/* Header section - Console Style */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    {viewMode !== 'grid' && (
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={handleBack}
                            className="rounded-lg border-slate-200 dark:border-slate-800 dark:bg-[#0B0F17] hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
                            {viewMode === 'grid' && (
                                <>Academic <span className="text-accent-brand">Departments</span></>
                            )}
                            {viewMode === 'directory' && (
                                <>Staff <span className="text-accent-brand">Directory</span></>
                            )}
                            {viewMode === 'detail' && (
                                <>{selectedDept?.code} <span className="text-accent-brand">Oversight</span></>
                            )}
                        </h1>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                            {viewMode === 'grid' && "Oversight and facility allocation for colleges."}
                            {viewMode === 'directory' && "Complete directory of faculty and program heads."}
                            {viewMode === 'detail' && `Managing staff and resources for ${selectedDept?.name}.`}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {viewMode === 'grid' ? (
                        <Button 
                            onClick={() => setViewMode('directory')}
                            className="w-full sm:w-auto bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-6 h-11 rounded-lg font-bold transition-all shadow-sm"
                        >
                            <Contact className="w-4 h-4 mr-2" />
                            Staff Directory
                        </Button>
                    ) : (
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search staff..." 
                                value={staffSearch}
                                onChange={(e) => setStaffSearch(e.target.value)}
                                className="pl-10 h-11 rounded-lg bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-slate-800 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Content section */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {deptsLoading ? (
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-48 bg-slate-100 dark:bg-[#0B0F17]/50 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800" />
                        ))
                    ) : departments.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white dark:bg-[#0B0F17] rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No Departments Found</p>
                        </div>
                    ) : (
                        departments.map(dept => (
                            <div 
                                key={dept.id} 
                                onClick={() => handleViewDetail(dept.id)}
                                className="group relative bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-500/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    {/* Top Row: Prominent Program Code Badge (Dynamic Width to prevent overflow) */}
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={cn(
                                                "h-9 px-2.5 rounded-lg bg-[#003087] dark:bg-blue-600 flex items-center justify-center text-white font-black tracking-wider shadow-sm shrink-0 min-w-[2.5rem]",
                                                dept.code.length > 5 ? "text-[10px]" : "text-xs"
                                            )}>
                                                {dept.code}
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 uppercase tracking-wider px-2 py-0.5 truncate">
                                                Academic Program
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Full Department Degree Title — 2-line natural wrap without cutoff */}
                                    <div className="min-h-[2.5rem] flex items-center">
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                                            {dept.name}
                                        </h3>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                            Active Bookings
                                        </span>
                                        <span className="text-slate-900 dark:text-white font-bold font-mono">{dept.activeBookings ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                            Assigned Rooms
                                        </span>
                                        <span className="text-slate-900 dark:text-white font-bold font-mono">{dept.primaryRooms ?? 0}</span>
                                    </div>

                                    <div className="pt-2">
                                        <Button variant="ghost" className="w-full justify-between h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-[#003087] hover:text-white dark:hover:bg-blue-600 transition-all group/btn">
                                            Manage Oversight
                                            <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setViewMode('directory')}
                                className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest h-8 px-4 rounded-md",
                                    viewMode === 'directory' 
                                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                                        : 'text-slate-500'
                                )}
                            >
                                <LayoutGrid className="w-3.5 h-3.5 mr-2" />
                                All Staff
                            </Button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {filteredStaff.length} Members Found
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {staffLoading ? (
                            [1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-32 bg-slate-100 dark:bg-[#0B0F17]/50 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800" />
                            ))
                        ) : filteredStaff.length === 0 ? (
                            <div className="col-span-full py-20 text-center">
                                <UserCircle className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold">No Staff Members Found</p>
                            </div>
                        ) : (
                            filteredStaff.map(renderStaffCard)
                        )}
                    </div>
                </div>
            )}

            {/* Footer section */}
            <StaffScheduleDrawer
                staff={selectedStaff}
                onClose={() => setSelectedStaff(null)}
            />

            {/* Footer section (only on grid view) */}
            {viewMode === 'grid' && (
                <section className="bg-slate-900 dark:bg-[#0B0F17] rounded-xl p-6 sm:p-10 text-white shadow-xl border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full translate-x-32 -translate-y-32"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 sm:gap-10">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                            <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
                        </div>
                        <div className="text-center md:text-left">
                            <h4 className="text-xl sm:text-2xl font-black mb-2 uppercase tracking-tighter">Global Departmental Oversight</h4>
                            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                                As the Academic Head, you have full visibility into the resource utilization of every department.
                                Use the oversight panel to resolve cross-department scheduling conflicts.
                            </p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}