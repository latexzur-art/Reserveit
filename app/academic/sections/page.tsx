'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Layers, Search, Info, BookOpen, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList"
import { SectionClassesModal } from '@/components/sections/SectionClassesModal'
import { SectionBadgeIcon } from '@/components/sections/SectionBadgeIcon'

interface Section {
  section: string
  department_name?: string
  department_code?: string
}

export default function AcademicHeadSectionsPage() {
  const { user, loading: authLoading } = useAuth()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchSections = useCallback(() => {
    if (authLoading) return
    setLoading(true)

    fetch(`/api/sections`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => {
        setSections(data.sections ?? [])
        setError(null)
      })
      .catch(() => setError('Failed to load sections'))
      .finally(() => setLoading(false))
  }, [authLoading])

  useEffect(() => { fetchSections() }, [fetchSections])
  
  const filteredSections = sections.filter(s => 
    s.section.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
    (s.department_code && s.department_code.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
    (s.department_name && s.department_name.toLowerCase().includes(debouncedSearch.toLowerCase()))
  )

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 px-4 sm:px-6 py-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Active <span className="text-accent-brand">Sections</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider flex items-center gap-2">
            <span>{sections.length} section{sections.length !== 1 ? 's' : ''} total</span>
          </p>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-white/10 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by section or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 dark:bg-black/20"
          />
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div>
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-white/10">
            <p className="font-semibold text-red-500">Failed to load sections</p>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
            <button
              onClick={fetchSections}
              className="mt-4 text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <Info className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No sections found</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              {search
                ? 'Try adjusting your search terms.'
                : 'No sections are currently scheduled.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSections.map((section) => (
              <div
                key={section.section}
                onClick={() => setSelectedSection(section)}
                className="flex flex-col justify-between p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F17] hover:border-blue-500 dark:hover:border-blue-500/50 hover:shadow-md transition-all group cursor-pointer space-y-4"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedSection(section)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <SectionBadgeIcon
                      departmentCode={section.department_code}
                      departmentName={section.department_name}
                      size="md"
                    />
                    <div className="flex flex-col">
                      <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {section.section}
                      </span>
                      {section.department_code && (
                        <span className="inline-flex items-center self-start px-2.5 py-0.5 mt-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                          {section.department_code}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>

                {section.department_name && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed" title={section.department_name}>
                    {section.department_name}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" /> View Class Schedule
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      <SectionClassesModal
        sectionName={selectedSection?.section ?? null}
        departmentCode={selectedSection?.department_code}
        departmentName={selectedSection?.department_name}
        isOpen={!!selectedSection}
        onClose={() => setSelectedSection(null)}
      />
    </div>
  )
}

