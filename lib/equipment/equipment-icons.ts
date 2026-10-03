import type { ComponentType } from "react";
import {
  Wind,
  Fan,
  Tv,
  Projector,
  Monitor,
  Laptop,
  Volume2,
  Mic,
  Camera,
  Wifi,
  Zap,
  Plug,
  Presentation,
  Armchair,
  Printer,
  Lightbulb,
  Package,
  Wrench,
} from "lucide-react";

/**
 * Returns an appropriate Lucide icon component based on equipment/amenity name or type.
 * Ensures HVAC / Air Conditioners show wind/climate icons instead of computer monitors.
 */
export function getEquipmentIcon(nameOrType?: string): ComponentType<{ className?: string; size?: number }> {
  if (!nameOrType) return Package;

  const text = nameOrType.toLowerCase().trim();

  // HVAC / Air Conditioning / Cooling / Ventilation
  if (
    text.includes("hvac") ||
    text.includes("air conditioner") ||
    text.includes("aircon") ||
    text.includes("air-con") ||
    text.includes("air conditioning") ||
    text.includes("split-type") ||
    text.includes("split type") ||
    text.includes("ac unit") ||
    text.includes("cooling") ||
    text.includes("ventilation") ||
    text.includes("climate") ||
    text === "ac" ||
    text === "a/c" ||
    text.startsWith("ac ") ||
    text.endsWith(" ac") ||
    text.includes(" ac ")
  ) {
    return Wind;
  }

  if (text.includes("fan") || text.includes("blower")) {
    return Fan;
  }

  // Television / Smart TV
  if (text.includes("tv") || text.includes("television")) {
    return Tv;
  }

  // Projectors / Displays
  if (text.includes("projector") || text.includes("lcd") || text.includes("projection")) {
    return Projector;
  }

  // Laptops
  if (text.includes("laptop") || text.includes("macbook") || text.includes("notebook")) {
    return Laptop;
  }

  // Computers / PC Monitors
  if (
    text.includes("monitor") ||
    text.includes("desktop") ||
    text.includes("computer") ||
    text.includes("pc") ||
    text.includes("screen")
  ) {
    return Monitor;
  }

  // Audio & Speakers
  if (
    text.includes("speaker") ||
    text.includes("sound") ||
    text.includes("audio") ||
    text.includes("amplifier") ||
    text.includes("soundbar")
  ) {
    return Volume2;
  }

  // Microphones
  if (text.includes("mic") || text.includes("microphone")) {
    return Mic;
  }

  // Cameras & Video
  if (text.includes("camera") || text.includes("webcam") || text.includes("cctv")) {
    return Camera;
  }

  // Wi-Fi / Networking
  if (text.includes("wifi") || text.includes("wi-fi") || text.includes("internet") || text.includes("router")) {
    return Wifi;
  }

  // Power & Outlets
  if (text.includes("power") || text.includes("outlet") || text.includes("charging") || text.includes("ups")) {
    return Zap;
  }
  if (text.includes("plug") || text.includes("extension")) {
    return Plug;
  }

  // Whiteboards / Presentation Boards
  if (text.includes("board") || text.includes("whiteboard") || text.includes("flipchart")) {
    return Presentation;
  }

  // Furniture / Seating
  if (
    text.includes("chair") ||
    text.includes("seat") ||
    text.includes("table") ||
    text.includes("desk") ||
    text.includes("podium") ||
    text.includes("furniture")
  ) {
    return Armchair;
  }

  // Printers / Scanners
  if (text.includes("printer") || text.includes("scanner") || text.includes("copier")) {
    return Printer;
  }

  // Lighting
  if (text.includes("light") || text.includes("lamp") || text.includes("lighting")) {
    return Lightbulb;
  }

  // Default neutral asset icon
  return Package;
}

/**
 * Checks whether a room or facility has an active HVAC / Air Conditioning system.
 */
export function hasHvacSystem(
  room?: { amenities?: string[]; equipment?: string[] } | null,
  roomEquipment?: any[]
): boolean {
  if (!room && (!roomEquipment || roomEquipment.length === 0)) return false;

  const allItems: string[] = [
    ...(room?.amenities || []),
    ...(room?.equipment || []),
    ...(roomEquipment ? roomEquipment.map((e: any) => e.equipmentName || e.equipmentTypeName || "") : [])
  ];

  return allItems.some(item => {
    if (!item) return false;
    const text = item.toLowerCase().trim();
    return (
      text.includes("hvac") ||
      text.includes("air conditioner") ||
      text.includes("aircon") ||
      text.includes("air-con") ||
      text.includes("air conditioning") ||
      text.includes("split-type") ||
      text.includes("split type") ||
      text.includes("ac unit") ||
      text.includes("central ac") ||
      text.includes("climate control") ||
      text.includes("cooling") ||
      text === "ac" ||
      text === "a/c" ||
      text.startsWith("ac ") ||
      text.endsWith(" ac") ||
      text.includes(" ac ")
    );
  });
}

