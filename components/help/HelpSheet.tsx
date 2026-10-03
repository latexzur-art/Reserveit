'use client'

import React, { useEffect, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Search, HelpCircle, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  role_tags: string[]
}

interface HelpSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpSheet({ open, onOpenChange }: HelpSheetProps) {
  const [items, setItems] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/faq')
      .then(r => r.json())
      .then(data => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open])

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(i => i.category))].sort()
    return ['All', ...cats]
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory
      const matchesSearch =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [items, search, activeCategory])

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, FAQItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = []
      acc[item.category].push(item)
      return acc
    }, {})
  }, [filtered])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg p-0 flex flex-col bg-background border-l border-border shadow-2xl overflow-hidden"
      >
        <SheetHeader className="px-6 pt-6 pb-5 border-b border-border bg-card/40 shrink-0 space-y-4">
          <div className="flex flex-col gap-1">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
              <div className="p-2 rounded-xl bg-sti-blue/10 text-sti-blue dark:text-sky-400">
                <HelpCircle size={18} />
              </div>
              Help &amp; Resource Center
            </SheetTitle>
            <p className="text-xs font-medium text-muted-foreground ml-10">
              Knowledge base &amp; staff guidance for ReserveIT
            </p>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search questions or topic keywords..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-muted/50 border-border focus:bg-background transition-all text-xs font-medium"
            />
          </div>

          {/* Category filter pills - Horizontal Scrollable */}
          {!loading && categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar -mx-1 px-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border shrink-0 transition-all active:scale-95 ${
                    activeCategory === cat
                      ? 'bg-sti-blue text-white border-sti-blue shadow-sm dark:bg-sky-500 dark:border-sky-500'
                      : 'border-border text-muted-foreground bg-muted/30 hover:border-border/80 hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 size={22} className="animate-spin text-sti-blue dark:text-sky-400" />
              <span className="text-xs font-medium">Loading knowledge base...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3 border border-border">
                <Search size={24} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground">No Matching FAQs Found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Try searching for a different question or clear your category filter.
              </p>
            </div>
          )}

          {!loading &&
            Object.entries(grouped).map(([category, faqs]) => (
              <div key={category} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-sti-blue dark:text-sky-400">
                    {category}
                  </span>
                  <Badge variant="outline" className="text-[11px] font-semibold px-2 py-0.5 rounded-md border-border bg-muted/40 text-muted-foreground">
                    {faqs.length} {faqs.length === 1 ? 'article' : 'articles'}
                  </Badge>
                </div>

                <Accordion type="multiple" className="space-y-2.5">
                  {faqs.map(faq => (
                    <AccordionItem 
                      key={faq.id} 
                      value={faq.id} 
                      className="border border-border rounded-xl px-4 bg-card/60 hover:bg-card hover:border-border/80 transition-all overflow-hidden"
                    >
                      <AccordionTrigger className="text-xs font-semibold text-left hover:no-underline py-3.5 leading-snug group">
                        <span className="group-data-[state=open]:text-sti-blue dark:group-data-[state=open]:text-sky-400 transition-colors">
                          {faq.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3.5 pt-1">
                        <div className="prose prose-xs max-w-none text-muted-foreground leading-relaxed prose-headings:text-foreground prose-strong:text-foreground prose-a:text-sti-blue dark:prose-a:text-sky-400">
                          <ReactMarkdown>{faq.answer}</ReactMarkdown>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
        </ScrollArea>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-border bg-muted/20">
          <p className="text-[11px] font-medium text-muted-foreground/60 text-center">
            ReserveIT Help Center • STI College Lucena
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
