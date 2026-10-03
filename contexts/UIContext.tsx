'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type TextSizeLevel = 'compact' | 'normal' | 'medium' | 'large' | 'xlarge'

export interface TextSizePreset {
  level: TextSizeLevel
  label: string
  scale: string
  percentage: number
}

export const TEXT_SIZE_PRESETS: TextSizePreset[] = [
  { level: 'compact', label: 'Compact', scale: '90%', percentage: 90 },
  { level: 'normal', label: 'Standard', scale: '100%', percentage: 100 },
  { level: 'medium', label: 'Medium', scale: '115%', percentage: 115 },
  { level: 'large', label: 'Large', scale: '130%', percentage: 130 },
  { level: 'xlarge', label: 'Maximum', scale: '145%', percentage: 145 },
]

interface UIContextValue {
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  textSizeLevel: TextSizeLevel
  setTextSizeLevel: (level: TextSizeLevel) => void
  textSizeEnlarged: boolean
  toggleTextSize: () => void
  increaseTextSize: () => void
  decreaseTextSize: () => void
  resetTextSize: () => void
}

const UIContext = createContext<UIContextValue | null>(null)

export const useUI = () => {
  const ctx = useContext(UIContext)
  if (!ctx) {
    throw new Error('useUI must be used within a UIProvider')
  }
  return ctx
}

const LEVEL_CLASSES: Record<TextSizeLevel, string> = {
  compact: 'text-size-compact',
  normal: 'text-size-normal',
  medium: 'text-size-medium',
  large: 'text-size-large',
  xlarge: 'text-size-xlarge',
}

const LEVEL_FONT_SIZES: Record<TextSizeLevel, string> = {
  compact: '90%',
  normal: '100%',
  medium: '115%',
  large: '130%',
  xlarge: '145%',
}

const LEVELS_ORDER: TextSizeLevel[] = ['compact', 'normal', 'medium', 'large', 'xlarge']

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [textSizeLevel, setTextSizeLevelState] = useState<TextSizeLevel>('normal')

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLevel = localStorage.getItem('text-size-level') as TextSizeLevel | null
      if (savedLevel && LEVELS_ORDER.includes(savedLevel)) {
        setTextSizeLevelState(savedLevel)
      } else {
        const legacyEnlarged = localStorage.getItem('text-enlarged') === 'true'
        if (legacyEnlarged) setTextSizeLevelState('medium')
      }
    }
  }, [])

  // Update HTML font size and classes dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const body = document.body

    // Clean up old classes
    Object.values(LEVEL_CLASSES).forEach(cls => {
      root.classList.remove(cls)
      body.classList.remove(cls)
    })
    root.classList.remove('text-enlarged')
    body.classList.remove('text-enlarged')

    // Apply new scale & class
    const scalePercentage = LEVEL_FONT_SIZES[textSizeLevel]
    root.style.fontSize = scalePercentage === '100%' ? '' : scalePercentage

    const currentClass = LEVEL_CLASSES[textSizeLevel]
    root.classList.add(currentClass)
    body.classList.add(currentClass)

    if (textSizeLevel !== 'normal') {
      root.classList.add('text-enlarged')
      body.classList.add('text-enlarged')
    }

    localStorage.setItem('text-size-level', textSizeLevel)
    localStorage.setItem('text-enlarged', String(textSizeLevel !== 'normal'))
  }, [textSizeLevel])

  const setTextSizeLevel = (level: TextSizeLevel) => {
    setTextSizeLevelState(level)
  }

  const increaseTextSize = () => {
    setTextSizeLevelState(prev => {
      const idx = LEVELS_ORDER.indexOf(prev)
      if (idx < LEVELS_ORDER.length - 1) return LEVELS_ORDER[idx + 1]
      return prev
    })
  }

  const decreaseTextSize = () => {
    setTextSizeLevelState(prev => {
      const idx = LEVELS_ORDER.indexOf(prev)
      if (idx > 0) return LEVELS_ORDER[idx - 1]
      return prev
    })
  }

  const resetTextSize = () => {
    setTextSizeLevelState('normal')
  }

  const toggleTextSize = () => {
    setTextSizeLevelState(prev => (prev === 'normal' ? 'large' : 'normal'))
  }

  const textSizeEnlarged = textSizeLevel !== 'normal'

  return (
    <UIContext.Provider
      value={{
        mobileMenuOpen,
        setMobileMenuOpen,
        toggleMobileMenu: () => setMobileMenuOpen(prev => !prev),
        textSizeLevel,
        setTextSizeLevel,
        textSizeEnlarged,
        toggleTextSize,
        increaseTextSize,
        decreaseTextSize,
        resetTextSize,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}
