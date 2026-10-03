"use client"

/**
 * Facility Aliases Management — Academic Head / Building Admin
 * View, add, and delete facility name aliases for schedule upload matching.
 */
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Building2,
    Plus,
    Trash2,
    Search,
    Loader2,
    Tag,
    CheckCircle2,
    AlertCircle,
    Fingerprint,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'


interface FacilityAlias {
    id: string
    facility_id: string
    alias: string
    alias_normalized: string
    is_primary: boolean
    facility_name: string
    room_number: string
}

export default function FacilityAliasesPage() {
    const [aliases, setAliases] = useState<FacilityAlias[]>([])
    const [facilities, setFacilities] = useState<{ id: string; name: string; room_number: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [newAlias, setNewAlias] = useState('')
    const [selectedFacility, setSelectedFacility] = useState('')
    const [adding, setAdding] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ id: string; text: string } | null>(null)

    const fetchAliases = useCallback(async () => {
        setLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('facility_aliases')
            .select('id, facility_id, alias, alias_normalized, is_primary, facilities(name, room_number)')
            .order('alias')

        const mapped = (data ?? []).map((a: any) => ({
            id: a.id,
            facility_id: a.facility_id,
            alias: a.alias,
            alias_normalized: a.alias_normalized,
            is_primary: a.is_primary,
            facility_name: a.facilities?.name ?? '',
            room_number: a.facilities?.room_number ?? '',
        }))
        setAliases(mapped)

        const { data: facs } = await supabase
            .from('facilities')
            .select('id, name, room_number')
            .eq('is_active', true)
            .order('name')
        setFacilities(facs ?? [])

        setLoading(false)
    }, [])

    useEffect(() => { fetchAliases() }, [fetchAliases])

    const filteredAliases = aliases.filter(a =>
        !search ||
        a.alias.toLowerCase().includes(search.toLowerCase()) ||
        a.facility_name.toLowerCase().includes(search.toLowerCase()) ||
        a.room_number.toLowerCase().includes(search.toLowerCase())
    )

    const grouped = new Map<string, FacilityAlias[]>()
    for (const a of filteredAliases) {
        const key = a.facility_id
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(a)
    }

    const handleAdd = async () => {
        if (!newAlias.trim() || !selectedFacility) return
        setAdding(true)

        const supabase = createClient()
        const { error } = await supabase
            .from('facility_aliases')
            .insert({
                facility_id: selectedFacility,
                alias: newAlias.trim(),
                is_primary: false,
            })

        if (error) {
            setToast({ message: error.message.includes('unique') ? 'This alias already exists' : error.message, type: 'error' })
        } else {
            setToast({ message: `Alias "${newAlias.trim()}" added successfully`, type: 'success' })
            setNewAlias('')
            setSelectedFacility('')
            await fetchAliases()
        }
        setAdding(false)
        setTimeout(() => setToast(null), 3000)
    }

    const handleDelete = async (aliasId: string) => {
        const supabase = createClient()
        const { error } = await supabase
            .from('facility_aliases')
            .delete()
            .eq('id', aliasId)

        if (error) {
            setToast({ message: error.message, type: 'error' })
        } else {
            setToast({ message: 'Alias deleted', type: 'success' })
            await fetchAliases()
        }
        setTimeout(() => setToast(null), 3000)
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 px-4 sm:px-6 py-8">
            {/* Toast Notification */}
            {toast && (
                <div className={cn(
                    'fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 border transition-all',
                    toast.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                )}>
                    {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase text-[#050d36] dark:text-white">
                        FACILITY <span className="text-accent-brand">ALIASES</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-[0.25em]">
                        Alternative Identifier Mapping & Resource Analytics
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white dark:bg-[#15181E] px-6 py-3 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm">
                    <Fingerprint className="h-4 w-4 text-blue-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                        {aliases.length} Active Mappings
                    </span>
                </div>
            </div>

            {/* Add New Alias Section */}
            <div className="group relative bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-3xl p-6 shadow-sm overflow-hidden">
                <div className="absolute -right-8 -top-8 w-24 h-24 blur-[50px] opacity-0 group-hover:opacity-10 bg-blue-500 transition-opacity duration-700 pointer-events-none" />
                
                <h2 className="text-[11px] font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Plus className="h-4 w-4 text-blue-500" strokeWidth={3} /> Register New Alias
                </h2>
                
                <div className="flex flex-wrap lg:flex-nowrap gap-4">
                    <div className="flex-1 min-w-[240px]">
                        <select
                            value={selectedFacility}
                            onChange={e => setSelectedFacility(e.target.value)}
                            className="w-full h-12 px-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.06] rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        >
                            <option value="">Target Facility...</option>
                            {facilities.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.room_number})</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex-1 min-w-[240px]">
                        <input
                            type="text"
                            placeholder="Alias (e.g. 'CL2', 'Comp Lab 2')"
                            value={newAlias}
                            onChange={e => setNewAlias(e.target.value)}
                            className="w-full h-12 px-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.06] rounded-xl text-[10px] font-black uppercase tracking-widest placeholder:text-slate-400 outline-none focus:ring-2 ring-blue-500/20 transition-all"
                        />
                    </div>

                    <Button
                        onClick={handleAdd}
                        disabled={adding || !newAlias.trim() || !selectedFacility}
                        className="h-12 px-8 bg-[#050d36] dark:bg-blue-600 hover:bg-[#050d36]/90 dark:hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50"
                    >
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" strokeWidth={3} />}
                        Append Alias
                    </Button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="SEARCH ALIASES OR ROOMS..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 ring-blue-500/20 shadow-sm"
                    />
                </div>
                <div className="hidden sm:block h-[1px] flex-1 bg-slate-200 dark:bg-white/5" />
            </div>

            {/* Grouped Facility List */}
            {loading ? (
                <SkeletonList />
            ) : grouped.size === 0 ? (
                <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-[2rem] p-24 text-center">
                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full w-fit mx-auto mb-6">
                        <Tag className="h-10 w-10 text-slate-400" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">No matching aliases found</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {Array.from(grouped.entries()).map(([facilityId, aliasGroup]) => (
                        <div 
                            key={facilityId} 
                            className="group relative bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-3xl overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/10"
                        >
                            <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                                        {aliasGroup[0].facility_name}
                                        <span className="text-slate-400 dark:text-slate-500 ml-2">/ {aliasGroup[0].room_number}</span>
                                    </h3>
                                </div>
                                <span className="text-[9px] font-black bg-slate-200 dark:bg-white/10 px-2.5 py-1 rounded-full text-slate-500 uppercase tracking-tighter">
                                    {aliasGroup.length} ENTRIES
                                </span>
                            </div>
                            
                            <div className="p-6 flex flex-wrap gap-3">
                                {aliasGroup.map(a => (
                                    <div
                                        key={a.id}
                                        className={cn(
                                            'inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                                            a.is_primary
                                                ? 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.08]',
                                        )}
                                    >
                                        <Tag className="h-3 w-3" strokeWidth={3} />
                                        <span>{a.alias}</span>
                                        
                                        {a.is_primary ? (
                                            <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-md">PRIMARY</span>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmAction({ id: a.id, text: a.alias })}
                                                className="ml-1 p-1 hover:bg-red-500/10 rounded-md transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-red-500/40 hover:text-red-500" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modern Confirmation Modal */}
            {confirmAction && (
                <AlertDialog open onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
                    <AlertDialogContent className="max-w-md p-8 bg-white dark:bg-[#15181E] border-slate-200 dark:border-white/[0.06] rounded-[2rem]">
                        <AlertDialogHeader className="flex-row items-center gap-4 space-y-0 mb-2 text-left">
                            <div className="p-3 bg-red-500/10 rounded-2xl">
                                <Trash2 className="h-6 w-6 text-red-500" />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Delete Mapping</AlertDialogTitle>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Destructive Action</p>
                            </div>
                        </AlertDialogHeader>

                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed uppercase tracking-tight">
                            Confirm removal of alias <span className="text-red-500 font-black">"{confirmAction.text}"</span>.
                            This may disrupt automated schedule synchronization for this facility.
                        </p>

                        <AlertDialogFooter className="items-center justify-end gap-3">
                            <AlertDialogCancel
                                onClick={() => setConfirmAction(null)}
                                className="m-0 px-6 py-3 bg-transparent border-transparent text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-transparent dark:hover:bg-transparent transition-colors"
                            >
                                Abort
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async (e) => {
                                    e.preventDefault()
                                    const id = confirmAction.id
                                    setConfirmAction(null)
                                    await handleDelete(id)
                                }}
                                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 active:scale-95"
                            >
                                Confirm Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}