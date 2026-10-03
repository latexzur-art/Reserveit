import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "../_components/ui/carousel";

interface FacilityItem {
  id: string
  name: string
  capacity: number
  facility_types?: { name: string }
  floors?: { floor_number: number; buildings?: { name: string } }
}

interface FacilityCarouselProps {
  facilities?: FacilityItem[]
}

const GRADIENT_CLASSES = [
  'from-teal-700 to-teal-500',
  'from-blue-700 to-blue-500',
  'from-indigo-700 to-indigo-500',
  'from-emerald-700 to-emerald-500',
  'from-cyan-700 to-cyan-500',
]

export function FacilityCarousel({ facilities }: FacilityCarouselProps) {
  const items = facilities && facilities.length > 0
    ? facilities
    : [
        { id: '1', name: 'Gymnasium', capacity: 500, facility_types: { name: 'Sports' } },
        { id: '2', name: 'Multi-Purpose Hall 1', capacity: 300, facility_types: { name: 'Event Hall' } },
        { id: '3', name: 'Multi-Purpose Hall 2', capacity: 200, facility_types: { name: 'Event Hall' } },
      ]

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-lg">
      <Carousel opts={{ loop: true }}>
        <CarouselContent>
          {items.map((facility, i) => (
            <CarouselItem key={facility.id}>
              <div className={`relative h-64 md:h-72 w-full bg-gradient-to-br ${GRADIENT_CLASSES[i % GRADIENT_CLASSES.length]} flex flex-col justify-end p-6`}>
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }}
                />
                <div className="relative z-10">
                  {facility.facility_types && (
                    <span className="inline-block px-2 py-0.5 mb-2 rounded-full bg-white/20 text-white text-xs font-medium">
                      {facility.facility_types.name}
                    </span>
                  )}
                  <h3 className="text-2xl font-bold text-white mb-1">{facility.name}</h3>
                  <p className="text-white/80 text-sm">
                    Capacity: {facility.capacity} people
                    {facility.floors?.buildings?.name ? ` · ${facility.floors.buildings.name}` : ''}
                  </p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white" />
        <CarouselNext className="right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white" />
      </Carousel>
    </div>
  );
}
