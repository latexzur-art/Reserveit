import { describe, it, expect } from "vitest";
import { getEquipmentIcon, hasHvacSystem } from "@/lib/equipment/equipment-icons";
import {
  Wind,
  Fan,
  Tv,
  Projector,
  Monitor,
  Laptop,
  Volume2,
  Mic,
  Wifi,
  Zap,
  Armchair,
  Package,
} from "lucide-react";

describe("getEquipmentIcon", () => {
  it("returns Wind icon for HVAC and Air Conditioner items", () => {
    expect(getEquipmentIcon("Split-type Air Conditioner 2.0HP")).toBe(Wind);
    expect(getEquipmentIcon("HVAC Unit")).toBe(Wind);
    expect(getEquipmentIcon("Aircon 1.5HP")).toBe(Wind);
    expect(getEquipmentIcon("Central Cooling System")).toBe(Wind);
  });

  it("returns Fan icon for standalone fans", () => {
    expect(getEquipmentIcon("Electric Fan")).toBe(Fan);
    expect(getEquipmentIcon("Exhaust Fan")).toBe(Fan);
  });

  it("returns Tv icon for televisions", () => {
    expect(getEquipmentIcon("Smart TV 55 inch")).toBe(Tv);
    expect(getEquipmentIcon("Television")).toBe(Tv);
  });

  it("returns Projector icon for projectors", () => {
    expect(getEquipmentIcon("Epson LCD Projector")).toBe(Projector);
  });

  it("returns Monitor icon for PC monitors", () => {
    expect(getEquipmentIcon("Dell 24 inch Desktop Monitor")).toBe(Monitor);
  });

  it("returns Laptop icon for laptops", () => {
    expect(getEquipmentIcon("MacBook Pro Laptop")).toBe(Laptop);
  });

  it("returns Volume2 icon for sound systems and speakers", () => {
    expect(getEquipmentIcon("PA Sound Speaker")).toBe(Volume2);
    expect(getEquipmentIcon("Audio Amplifier")).toBe(Volume2);
  });

  it("returns Mic icon for microphones", () => {
    expect(getEquipmentIcon("Wireless Microphone")).toBe(Mic);
  });

  it("returns Wifi icon for networking", () => {
    expect(getEquipmentIcon("Wi-Fi Router")).toBe(Wifi);
  });

  it("returns Zap icon for power outlets and UPS", () => {
    expect(getEquipmentIcon("UPS Power Backup")).toBe(Zap);
  });

  it("returns Armchair icon for chairs and tables", () => {
    expect(getEquipmentIcon("Conference Room Chair")).toBe(Armchair);
    expect(getEquipmentIcon("Executive Desk Table")).toBe(Armchair);
  });

  it("returns Package icon as default fallback for unknown items or empty strings", () => {
    expect(getEquipmentIcon("Miscellaneous Tool")).toBe(Package);
    expect(getEquipmentIcon("")).toBe(Package);
    expect(getEquipmentIcon(undefined)).toBe(Package);
  });
});

describe("hasHvacSystem", () => {
  it("returns true when room has HVAC/Aircon/AC in amenities or equipment", () => {
    expect(hasHvacSystem({ amenities: ["Wi-Fi", "Split-type Air Conditioner 2.0HP"] })).toBe(true);
    expect(hasHvacSystem({ equipment: ["HVAC Unit"] })).toBe(true);
    expect(hasHvacSystem({ amenities: ["Aircon"] })).toBe(true);
    expect(hasHvacSystem({ amenities: ["AC"] })).toBe(true);
    expect(hasHvacSystem({ roomNumber: "201", amenities: ["AC", "Whiteboard"] } as any)).toBe(true);
    expect(hasHvacSystem(null, [{ equipmentName: "Central AC" }])).toBe(true);
  });

  it("returns false when room has no HVAC/Aircon listed", () => {
    expect(hasHvacSystem({ amenities: ["Wi-Fi", "Whiteboard", "Projector"] })).toBe(false);
    expect(hasHvacSystem({ equipment: ["Chairs", "Tables"] })).toBe(false);
    expect(hasHvacSystem(null, [])).toBe(false);
    expect(hasHvacSystem(undefined)).toBe(false);
  });
});

