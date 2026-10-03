'use client'

import { ImageOff } from 'lucide-react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/app/faculty/_components/ui/carousel'
import type { FacilityPhoto } from '@/backend/admin/building/building.types'

export function FacilityPhotoCarousel({ photos, fallbackImage, alt }: { photos: FacilityPhoto[]; fallbackImage: string; alt: string }) {
  if (photos.length === 0) {
    return (
      <div className="relative">
        <img src={fallbackImage} alt={`${alt} — no photos uploaded yet`} className="w-full h-56 object-cover rounded-xl" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1.5 text-[11px] font-medium text-white/90 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
          <ImageOff className="w-3 h-3" aria-hidden="true" /> No photos yet
        </span>
      </div>
    )
  }

  return (
    <Carousel className="w-full">
      <CarouselContent>
        {photos.map(photo => (
          <CarouselItem key={photo.id}>
            <img src={photo.publicUrl} alt={photo.caption || alt} className="w-full h-56 object-cover rounded-xl" />
            {photo.caption && <p className="text-xs text-center text-muted-foreground mt-1">{photo.caption}</p>}
          </CarouselItem>
        ))}
      </CarouselContent>
      {photos.length > 1 && (
        <>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </>
      )}
    </Carousel>
  )
}
