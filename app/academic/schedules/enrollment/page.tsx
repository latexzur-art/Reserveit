'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Trash2, AlertTriangle, Calendar, Building2, History, PlusCircle } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { SkeletonList } from "@/components/ui/SkeletonList";


// Define the shape of our facility data to select from
interface Facility {
    id: string
    name: string
    room_number: string
    code: string
}

// Define the shape of existing enrollment blocks
interface EnrollmentBlock {
    id: string
    facility_id: string
    block_type: string
    start_time: string
    end_time: string
    reason: string
    facilities: { name: string }
}

export default function EnrollmentPeriodsPage() {
    const [facilities, setFacilities] = useState<Facility[]>([])
    const [enrollmentBlocks, setEnrollmentBlocks] = useState<EnrollmentBlock[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [targetBlockId, setTargetBlockId] = useState<string | null>(null)

    // Form State
    const [selectedFacility, setSelectedFacility] = useState<string>('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [reason, setReason] = useState('Enrollment Period')

    const fetchInitialData = useCallback(async () => {
        setLoading(true)
        try {
            const [facRes, blocksRes] = await Promise.all([
                fetch('/api/facilities?all=true'),
                fetch('/api/admin/schedule-management/enrollment')
            ])

            if (!facRes.ok) throw new Error('Failed to fetch facilities')
            if (!blocksRes.ok) throw new Error('Failed to fetch enrollment blocks')

            const facData = await facRes.json()
            const blocksData = await blocksRes.json()

            setFacilities(facData.facilities || [])
            setEnrollmentBlocks(blocksData.blocks || [])
        } catch (error: any) {
            console.error('Load error:', error)
            toast.error(error.message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInitialData()
    }, [fetchInitialData])

    const handleDelete = async (blockId: string) => {
        setTargetBlockId(blockId)
        setConfirmOpen(true)
    }

    const executeDelete = async () => {
        if (!targetBlockId) return
        const blockId = targetBlockId
        setDeletingId(blockId)
        try {
            const res = await fetch(`/api/admin/schedule-management/enrollment/${blockId}`, {
                method: 'DELETE'
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to delete enrollment block')
            }

            toast.success('Enrollment block deleted successfully')
            fetchInitialData()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setDeletingId(null)
            setTargetBlockId(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFacility || !startDate || !endDate) {
            toast.error("Please fill all required fields")
            return
        }
        setSubmitting(true)
        try {
            const startDateTime = new Date(`${startDate}T00:00:00Z`).toISOString()
            const endDateTime = new Date(`${endDate}T23:59:59Z`).toISOString()

            const res = await fetch('/api/admin/schedule-management/enrollment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    facility_ids: [selectedFacility],
                    start_time: startDateTime,
                    end_time: endDateTime,
                    reason
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to create enrollment period')
            }

            toast.success('Enrollment period created successfully')
            setSelectedFacility('')
            setStartDate('')
            setEndDate('')
            setReason('Enrollment Period')
            fetchInitialData()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] transition-colors duration-300">
            <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
                
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">
                            Enrollment <span className="text-accent-brand">Periods</span>
                        </h1>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">
                            Schedule Management & Facility Blocking
                        </p>
                    </div>
                    <div>
                        <Badge variant="secondary" className="bg-slate-900 dark:bg-blue-600/10 text-white dark:text-blue-400 border-none px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                            {enrollmentBlocks.length} Active Blocks
                        </Badge>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1.2fr_2fr]">
                    
                    {/* Create Form Section */}
                    <Card className="h-fit bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-none overflow-hidden rounded-2xl">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 pb-6">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <PlusCircle className="w-5 h-5 text-blue-500" />
                                </div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Create Block</CardTitle>
                            </div>
                            <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Assign facilities to restricted use
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="facility" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Facility</Label>
                                    {loading ? (
                                        <div className="flex items-center justify-center p-3 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/50">
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing...</span>
                                        </div>
                                    ) : (
                                        <Select value={selectedFacility} onValueChange={setSelectedFacility} required>
                                            <SelectTrigger id="facility" className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-[12px] font-bold">
                                                <SelectValue placeholder="Select facility" />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-[#111827] dark:border-slate-800">
                                                {facilities.map((fac) => (
                                                    <SelectItem key={fac.id} value={fac.id} className="text-[12px] font-bold uppercase">
                                                        {fac.name} <span className="opacity-50 text-[10px]">({fac.room_number})</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</Label>
                                        <Input
                                            type="date"
                                            id="start-date"
                                            className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-[12px] font-bold"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</Label>
                                        <Input
                                            type="date"
                                            id="end-date"
                                            className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-[12px] font-bold"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="reason" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Label / Classification</Label>
                                    <Input
                                        id="reason"
                                        className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-[12px] font-bold"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="e.g. Enrollment Period"
                                    />
                                </div>

                                <Button 
                                    type="submit" 
                                    className="w-full h-14 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-lg transition-all"
                                    disabled={submitting || loading}
                                >
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                                    Initialize Block
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Existing Blocks List Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                            <History className="w-5 h-5 text-slate-400" />
                            <h2 className="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">
                                Scheduled Restrictions
                            </h2>
                        </div>

                        {loading ? (
                            <SkeletonList />
                        ) : enrollmentBlocks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-[#111827]/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center px-8">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                                    <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                                </div>
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">No Active Blocks</h3>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-xs">
                                    All facilities are currently available for regular booking schedules.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {enrollmentBlocks.map(block => (
                                    <Card key={block.id} className="group bg-white dark:bg-[#111827] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-105">
                                                    <Building2 className="w-7 h-7 text-slate-900 dark:text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-none uppercase tracking-tight">
                                                        {block.facilities?.name}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {new Date(block.start_time).toLocaleDateString()} — {new Date(block.end_time).toLocaleDateString()}
                                                        </div>
                                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-amber-500/10 text-amber-600 border-amber-500/20 px-2 py-0">
                                                            {block.reason}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(block.id)}
                                                disabled={deletingId === block.id}
                                                className="w-12 h-12 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                            >
                                                {deletingId === block.id ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-5 w-5" />
                                                )}
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-[#111827] max-w-[90vw] sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
                            <div className="p-2 bg-rose-500/10 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-rose-500" />
                            </div>
                            Confirm Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wide">
                            Are you sure you want to delete this restriction? This will make the facility available for regular student and faculty bookings immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 flex-col sm:flex-row gap-3">
                        <AlertDialogCancel className="h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-800 m-0">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDelete}
                            className="h-12 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 m-0"
                        >
                            Delete Block
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}