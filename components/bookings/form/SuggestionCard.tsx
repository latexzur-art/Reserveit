"use client"

import { MapPin, Clock, ArrowRight } from 'lucide-react'
import type { AlternativeSuggestion } from '@/backend/booking/booking.types'

export function SuggestionCard({ suggestion, onSelect }: { suggestion: AlternativeSuggestion; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          {suggestion.type === 'room'
            ? <MapPin className="w-4 h-4 text-primary" />
            : <Clock className="w-4 h-4 text-primary" />}
        </div>
        <div className="flex-1">
          {suggestion.type === 'room' && (
            <>
              <p className="font-medium text-sm">{suggestion.facility_name}</p>
              <p className="text-xs text-muted-foreground">
                Capacity: {suggestion.capacity} · Floor {suggestion.floor_number} · {suggestion.building_name}
              </p>
            </>
          )}
          {suggestion.type === 'time_slot' && (
            <>
              <p className="font-medium text-sm">Different Time Slot</p>
              <p className="text-xs text-muted-foreground">
                {suggestion.date} · {suggestion.start_time} – {suggestion.end_time}
              </p>
            </>
          )}
          {suggestion.type === 'date' && (
            <>
              <p className="font-medium text-sm">Different Date</p>
              <p className="text-xs text-muted-foreground">
                {suggestion.date} · {suggestion.start_time} – {suggestion.end_time}
              </p>
            </>
          )}
          {suggestion.reason && (
            <p className="text-xs text-muted-foreground mt-1 italic">{suggestion.reason}</p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground mt-1" />
      </div>
    </button>
  )
}
