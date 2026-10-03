'use client'

import { useState, useRef, useEffect } from 'react'
import { Type, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react'
import { useUI, TEXT_SIZE_PRESETS, type TextSizeLevel } from '@/contexts/UIContext'
import { cn } from '@/lib/utils'

export function TextSizeControlMenu() {
  const {
    textSizeLevel,
    setTextSizeLevel,
    increaseTextSize,
    decreaseTextSize,
    resetTextSize,
  } = useUI()

  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const activePreset = TEXT_SIZE_PRESETS.find(p => p.level === textSizeLevel) || TEXT_SIZE_PRESETS[1]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
          isOpen || textSizeLevel !== 'normal'
            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
            : "text-muted-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10"
        )}
        title={`Text Size: ${activePreset.scale} (${activePreset.label})`}
        aria-expanded={isOpen}
        aria-label="Text sizing options"
      >
        <Type size={18} className={cn("transition-transform duration-200", textSizeLevel !== 'normal' && "scale-110")} />
        {textSizeLevel !== 'normal' && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white ring-2 ring-background">
            {textSizeLevel === 'compact' ? '-' : '+'}
          </span>
        )}
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] p-4 shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-150">
          {/* Menu Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Type size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                Text Sizing
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
              {activePreset.scale} • {activePreset.label}
            </span>
          </div>

          {/* Quick Steppers (Minimize / Enlarge) */}
          <div className="my-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={decreaseTextSize}
              disabled={textSizeLevel === 'compact'}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-slate-200 dark:border-white/5"
            >
              <ZoomOut size={14} className="text-slate-500" />
              Minimize (-)
            </button>
            <button
              type="button"
              onClick={increaseTextSize}
              disabled={textSizeLevel === 'xlarge'}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-slate-200 dark:border-white/5"
            >
              <ZoomIn size={14} className="text-blue-500" />
              Enlarge (+)
            </button>
          </div>

          {/* Level Selection List */}
          <div className="space-y-1 my-2">
            {TEXT_SIZE_PRESETS.map((preset) => {
              const isSelected = textSizeLevel === preset.level
              return (
                <button
                  key={preset.level}
                  type="button"
                  onClick={() => setTextSizeLevel(preset.level)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs font-bold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-7 text-left font-mono font-bold text-[11px]",
                      isSelected ? "text-white" : "text-slate-500 dark:text-slate-400"
                    )}>
                      {preset.scale}
                    </span>
                    <span>{preset.label}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-white" />}
                </button>
              )
            })}
          </div>

          {/* Reset Action */}
          {textSizeLevel !== 'normal' && (
            <div className="pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={resetTextSize}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <RotateCcw size={12} />
                Reset to Standard (100%)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
